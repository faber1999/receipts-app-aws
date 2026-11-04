import { App, Tags } from 'aws-cdk-lib';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { WebStack } from '../lib/web-stack';

const app = new App();
Tags.of(app).add('project', 'receipts-app');

const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' };

new AuthStack(app, 'AuthStack', { env });
new WebStack(app, 'WebStack', { env });
new DataStack(app, 'DataStack', { env });
