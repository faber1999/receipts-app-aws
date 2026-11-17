import { type App, type Environment, Tags } from 'aws-cdk-lib';
import { ApiStack } from './stacks/api-stack';
import { AuthStack } from './stacks/auth-stack';
import { CiStack } from './stacks/ci-stack';
import { DataStack } from './stacks/data-stack';
import { NotificationsStack } from './stacks/notifications-stack';
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
  notifications: NotificationsStack;
}

export interface StacksOptions {
  alarmEmail?: string;
  senderEmail?: string;
}

/** Creates and wires every stack. Used by bin/app.ts and by the infra tests, so both see the same app. */
export function createStacks(app: App, env: Environment, options: StacksOptions = {}): ReceiptsStacks {
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
    alarmEmail: options.alarmEmail,
  });
  const web = new WebStack(app, 'WebStack', { env, apiUrl: api.apiUrl, receiptsBucket: data.receiptsBucket });
  const ci = new CiStack(app, 'CiStack', { env });

  if (!options.senderEmail) {
    throw new Error('SENDER_EMAIL is required: the monthly summary needs a verified SES sender');
  }
  const notifications = new NotificationsStack(app, 'NotificationsStack', {
    env,
    senderEmail: options.senderEmail,
  });

  return { auth, data, api, processing, web, ci, notifications };
}
