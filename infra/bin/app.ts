import { App } from 'aws-cdk-lib';
import { createStacks } from '../lib/create-stacks';

createStacks(new App(), { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' });
