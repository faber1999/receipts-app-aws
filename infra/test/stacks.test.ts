import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { createStacks } from '../lib/create-stacks';

// A fixed account keeps synthesis offline: no AWS credentials or lookups needed.
const stacks = createStacks(new App(), { account: '123456789012', region: 'us-east-2' });
const data = Template.fromStack(stacks.data);
const api = Template.fromStack(stacks.api);
const processing = Template.fromStack(stacks.processing);
const web = Template.fromStack(stacks.web);

const privateBucket = {
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  },
};

/** Every IAM statement of a stack, flattened from all its policies. */
function statementsOf(template: Template): { Action: string | string[]; Resource: unknown }[] {
  return Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
    (policy) => policy.Properties.PolicyDocument.Statement,
  );
}

describe('DataStack', () => {
  it('uses an on-demand table with the GSI1 index', () => {
    data.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: Match.arrayWith([Match.objectLike({ IndexName: 'GSI1' })]),
    });
  });

  it('keeps the receipts bucket private and only allows browser POST uploads', () => {
    data.hasResourceProperties('AWS::S3::Bucket', {
      ...privateBucket,
      CorsConfiguration: { CorsRules: [Match.objectLike({ AllowedMethods: ['POST'] })] },
    });
  });

  it('sends receipts bucket events to EventBridge', () => {
    data.hasResourceProperties('Custom::S3BucketNotifications', {
      NotificationConfiguration: { EventBridgeConfiguration: {} },
    });
  });

  it('tags resources with the project name', () => {
    data.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'project', Value: 'receipts-app' }]),
    });
  });
});

// Rules every stack with Lambdas follows.
describe.each([
  ['ApiStack', api],
  ['ProcessingStack', processing],
])('%s Lambdas', (_stack, template) => {
  it('run on Node.js 24 and arm64', () => {
    const functions = Object.values(template.findResources('AWS::Lambda::Function'));

    expect(functions.length).toBeGreaterThan(0);
    for (const fn of functions) {
      expect(fn.Properties.Runtime).toBe('nodejs24.x');
      expect(fn.Properties.Architectures).toEqual(['arm64']);
    }
  });

  it('keep their logs for one week', () => {
    template.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
  });

  it('are never granted a permission on every resource (*)', () => {
    for (const statement of statementsOf(template)) {
      expect([statement.Resource].flat()).not.toContain('*');
    }
  });
});

describe('ApiStack', () => {
  it('protects every route with the Cognito JWT authorizer', () => {
    const routes = Object.values(api.findResources('AWS::ApiGatewayV2::Route'));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.Properties.AuthorizationType).toBe('JWT');
    }
  });

  it('has the receipt routes', () => {
    for (const routeKey of ['POST /receipts', 'GET /expenses/{id}/receipt', 'POST /expenses/{id}/confirm']) {
      api.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: routeKey });
    }
  });
});

describe('ProcessingStack', () => {
  it('starts the workflow for photos uploaded under receipts/', () => {
    processing.hasResourceProperties('AWS::Events::Rule', {
      EventPattern: {
        source: ['aws.s3'],
        'detail-type': ['Object Created'],
        detail: Match.objectLike({ object: { key: [{ prefix: 'receipts/' }] } }),
      },
    });
  });

  it('runs a Standard workflow, which keeps each execution history', () => {
    processing.hasResourceProperties('AWS::StepFunctions::StateMachine', { StateMachineType: 'STANDARD' });
  });

  it('keeps the dead-letter queue encrypted for 14 days', () => {
    processing.hasResourceProperties('AWS::SQS::Queue', {
      SqsManagedSseEnabled: true,
      MessageRetentionPeriod: 14 * 24 * 60 * 60,
    });
  });

  it('only writes to the table with UpdateItem', () => {
    const tableActions = statementsOf(processing)
      .flatMap((statement) => [statement.Action].flat())
      .filter((action) => action.startsWith('dynamodb:'));

    expect(tableActions.length).toBeGreaterThan(0);
    expect(new Set(tableActions)).toEqual(new Set(['dynamodb:UpdateItem']));
  });

  it('reads only the Anthropic API key parameter from SSM', () => {
    const ssmStatements = statementsOf(processing).filter((statement) =>
      [statement.Action].flat().some((action) => action.startsWith('ssm:')),
    );

    expect(ssmStatements).toHaveLength(1);
    expect(JSON.stringify(ssmStatements[0]?.Resource)).toContain('parameter/receipts-app/anthropic-api-key');
  });
});

describe('WebStack', () => {
  it('keeps the site bucket private', () => {
    web.hasResourceProperties('AWS::S3::Bucket', privateBucket);
  });

  it('redirects HTTP to HTTPS', () => {
    web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });

  it('sends the security headers (CSP and HSTS)', () => {
    web.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        SecurityHeadersConfig: Match.objectLike({
          ContentSecurityPolicy: Match.objectLike({ Override: true }),
          StrictTransportSecurity: Match.objectLike({ AccessControlMaxAgeSec: 31_536_000 }),
        }),
      }),
    });
  });
});
