import { App, Tags } from 'aws-cdk-lib';
import { ApiStack } from '../lib/stacks/api-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { WebStack } from '../lib/stacks/web-stack';

const app = new App();
Tags.of(app).add('project', 'receipts-app');

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };
const allowedOrigins = ['http://localhost:3000', 'https://d320g8bknug8ck.cloudfront.net'];

const auth = new AuthStack(app, 'AuthStack', { env });
const data = new DataStack(app, 'DataStack', { env, allowedOrigins });
const api = new ApiStack(app, 'ApiStack', {
  env,
  userPool: auth.userPool,
  userPoolClient: auth.webClient,
  table: data.table,
  allowedOrigins,
});

new WebStack(app, 'WebStack', { env, apiUrl: api.apiUrl });
