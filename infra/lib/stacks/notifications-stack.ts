import { join } from 'node:path';
import { Duration, RemovalPolicy, Stack, type StackProps, TimeZone } from 'aws-cdk-lib';
import type { IUserPool } from 'aws-cdk-lib/aws-cognito';
import type { ITableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Schedule, ScheduleExpression, ScheduleTargetInput } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';
import { EmailIdentity, Identity } from 'aws-cdk-lib/aws-ses';
import type { Construct } from 'constructs';

export interface NotificationsStackProps extends StackProps {
  table: ITableV2;
  userPool: IUserPool;
  /** Sender of the monthly summary. In the SES sandbox, recipients must be verified too. */
  senderEmail: string;
}

const API_SRC_DIR = join(import.meta.dirname, '../../../services/api/src');

export class NotificationsStack extends Stack {
  constructor(scope: Construct, id: string, props: NotificationsStackProps) {
    super(scope, id, props);

    // SES emails a verification link to this address on the first deploy.
    const senderIdentity = new EmailIdentity(this, 'SenderIdentity', {
      identity: Identity.email(props.senderEmail),
    });

    // --- Monthly summary Lambda ------------------------------------------------------------
    const sendMonthlySummaries = new NodejsFunction(this, 'SendMonthlySummariesFunction', {
      entry: join(API_SRC_DIR, 'summaries/handlers/send-monthly-summaries.ts'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      // One query, one put and one email per user; the SES sandbox sends one email per second.
      timeout: Duration.minutes(2),
      environment: {
        TABLE_NAME: props.table.tableName,
        USER_POOL_ID: props.userPool.userPoolId,
        SENDER_EMAIL: props.senderEmail,
      },
      bundling: { minify: true },
      logGroup: new LogGroup(this, 'SendMonthlySummariesLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    // Query (GSI1) for the month, Put/Delete for the idempotency marker.
    props.table.grant(sendMonthlySummaries, 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:DeleteItem');
    props.userPool.grant(sendMonthlySummaries, 'cognito-idp:ListUsers');
    senderIdentity.grantSendEmail(sendMonthlySummaries);

    // --- Schedule: 8:00 in Bogotá on the 1st, for the month that just ended ----------------
    new Schedule(this, 'MonthlySummarySchedule', {
      description: "Emails each user last month's expense summary",
      schedule: ScheduleExpression.cron({ minute: '0', hour: '8', day: '1', timeZone: TimeZone.AMERICA_BOGOTA }),
      target: new LambdaInvoke(sendMonthlySummaries, {
        input: ScheduleTargetInput.fromObject({}),
        retryAttempts: 2,
        maxEventAge: Duration.hours(1),
      }),
    });
  }
}
