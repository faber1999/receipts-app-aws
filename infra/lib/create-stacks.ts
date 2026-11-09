import { type App, type Environment, Tags } from 'aws-cdk-lib';
import { ApiStack } from './stacks/api-stack';
import { AuthStack } from './stacks/auth-stack';
import { CiStack } from './stacks/ci-stack';
import { DataStack } from './stacks/data-stack';
import { ProcessingStack } from './stacks/processing-stack';
import { WebStack } from './stacks/web-stack';

export const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://d320g8bknug8ck.cloudfront.net'];

export interface ReceiptsStacks {
  auth: AuthStack;
  data: DataStack;
  api: ApiStack;
  processing: ProcessingStack;
  web: WebStack;
  ci: CiStack;
}

/** Creates and wires every stack. Used by bin/app.ts and by the infra tests, so both see the same app. */
export function createStacks(app: App, env: Environment): ReceiptsStacks {
  Tags.of(app).add('project', 'receipts-app');

  const auth = new AuthStack(app, 'AuthStack', { env });
  const data = new DataStack(app, 'DataStack', { env, allowedOrigins: ALLOWED_ORIGINS });
  const api = new ApiStack(app, 'ApiStack', {
    env,
    userPool: auth.userPool,
    userPoolClient: auth.webClient,
    table: data.table,
    receiptsBucket: data.receiptsBucket,
    allowedOrigins: ALLOWED_ORIGINS,
  });
  const processing = new ProcessingStack(app, 'ProcessingStack', {
    env,
    table: data.table,
    receiptsBucket: data.receiptsBucket,
  });
  const web = new WebStack(app, 'WebStack', { env, apiUrl: api.apiUrl });
  const ci = new CiStack(app, 'CiStack', { env });

  return { auth, data, api, processing, web, ci };
}
