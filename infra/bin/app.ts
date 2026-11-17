import { existsSync } from 'node:fs';
import { App } from 'aws-cdk-lib';
import { createStacks } from '../lib/create-stacks';

if (existsSync('.env')) process.loadEnvFile('.env');

createStacks(
  new App(),
  { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-2' },
  { alarmEmail: process.env.ALARM_EMAIL },
);
