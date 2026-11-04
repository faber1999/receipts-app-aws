import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { createStacks } from '../lib/create-stacks';

// A fixed account keeps synthesis offline: no AWS credentials or lookups needed.
const stacks = createStacks(new App(), { account: '123456789012', region: 'us-east-2' });
const data = Template.fromStack(stacks.data);
const api = Template.fromStack(stacks.api);
const web = Template.fromStack(stacks.web);

const privateBucket = {
  PublicAccessBlockConfiguration: {
    BlockPublicAcls: true,
    BlockPublicPolicy: true,
    IgnorePublicAcls: true,
    RestrictPublicBuckets: true,
  },
};

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

describe('ApiStack', () => {
  it('protects every route with the Cognito JWT authorizer', () => {
    const routes = Object.values(api.findResources('AWS::ApiGatewayV2::Route'));

    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(route.Properties.AuthorizationType).toBe('JWT');
    }
  });

  it('runs every Lambda on Node.js 24 and arm64', () => {
    for (const fn of Object.values(api.findResources('AWS::Lambda::Function'))) {
      expect(fn.Properties.Runtime).toBe('nodejs24.x');
      expect(fn.Properties.Architectures).toEqual(['arm64']);
    }
  });

  it('keeps Lambda logs for one week', () => {
    api.allResourcesProperties('AWS::Logs::LogGroup', { RetentionInDays: 7 });
  });

  it('never grants a permission on every resource (*)', () => {
    for (const policy of Object.values(api.findResources('AWS::IAM::Policy'))) {
      for (const statement of policy.Properties.PolicyDocument.Statement) {
        expect([statement.Resource].flat()).not.toContain('*');
      }
    }
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
