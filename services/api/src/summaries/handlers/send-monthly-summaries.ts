import { Logger } from '@aws-lambda-powertools/logger';
import { CognitoIdentityProviderClient, paginateListUsers } from '@aws-sdk/client-cognito-identity-provider';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { MessageRejected, SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { DeleteCommand, PutCommand, paginateQuery } from '@aws-sdk/lib-dynamodb';
import type { Expense } from '@receipts-app/contracts';
import { z } from 'zod';
import { dateSk, fromItem, userPk } from '../../expenses/expense-repository';
import { db } from '../../shared/db';
import {
  buildMonthlySummary,
  isEmptySummary,
  type MonthlySummary,
  previousMonth,
  renderSummaryEmail,
} from '../monthly-summary';

const logger = new Logger({ serviceName: 'monthly-summary' });
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

const env = z
  .object({
    TABLE_NAME: z.string().min(1),
    USER_POOL_ID: z.string().min(1),
    SENDER_EMAIL: z.email(),
  })
  .parse(process.env);

/** The schedule sends {}; a manual invocation can pass { "month": "2026-10" } to summarize another month. */
const inputSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
});

/** Idempotency markers outlive any retry, then the table's TTL removes them. */
const MARKER_TTL_SECONDS = 90 * 24 * 60 * 60;

interface Recipient {
  userId: string;
  email: string;
}

export interface SendSummariesResult {
  month: string;
  sent: number;
  skipped: number;
  failed: number;
}

/** Enabled, confirmed users with a verified email. The user id is the Cognito sub, as in the API. */
async function* listRecipients(): AsyncGenerator<Recipient> {
  const pages = paginateListUsers(
    { client: cognito },
    { UserPoolId: env.USER_POOL_ID, AttributesToGet: ['sub', 'email', 'email_verified'] },
  );

  for await (const page of pages) {
    for (const user of page.Users ?? []) {
      const attribute = (name: string): string | undefined =>
        user.Attributes?.find((item) => item.Name === name)?.Value;
      const userId = attribute('sub');
      const email = attribute('email');

      if (
        user.Enabled &&
        user.UserStatus === 'CONFIRMED' &&
        userId &&
        email &&
        attribute('email_verified') === 'true'
      ) {
        yield { userId, email };
      }
    }
  }
}

/** Same query as GET /expenses: GSI1 by user and month, every page. */
async function listMonthExpenses(userId: string, month: string): Promise<Expense[]> {
  const pages = paginateQuery(
    { client: db },
    {
      TableName: env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :month)',
      ExpressionAttributeValues: { ':pk': userPk(userId), ':month': dateSk(month) },
    },
  );

  const expenses: Expense[] = [];
  for await (const page of pages) {
    expenses.push(...(page.Items ?? []).map(fromItem));
  }
  return expenses;
}

const markerKey = (userId: string, month: string): { PK: string; SK: string } => ({
  PK: userPk(userId),
  SK: `SUMMARY#${month}`,
});

/**
 * Records that this user's summary for the month is being sent. Returns false if it already was:
 * Scheduler and Lambda deliver at least once, so a retry must not email the same person twice.
 */
async function claimSummary(userId: string, month: string): Promise<boolean> {
  try {
    await db.send(
      new PutCommand({
        TableName: env.TABLE_NAME,
        Item: {
          ...markerKey(userId, month),
          sentAt: new Date().toISOString(),
          expiresAt: Math.floor(Date.now() / 1000) + MARKER_TTL_SECONDS,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    );
    return true;
  } catch (error: unknown) {
    if (error instanceof ConditionalCheckFailedException) return false;
    throw error;
  }
}

/** Gives the claim back when the email could not be sent, so a retry can try again. */
async function releaseSummary(userId: string, month: string): Promise<void> {
  await db.send(new DeleteCommand({ TableName: env.TABLE_NAME, Key: markerKey(userId, month) }));
}

async function sendSummary(email: string, summary: MonthlySummary): Promise<void> {
  const { subject, text } = renderSummaryEmail(summary);
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: env.SENDER_EMAIL,
      Destination: { ToAddresses: [email] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: { Text: { Data: text, Charset: 'UTF-8' } },
        },
      },
    }),
  );
}

export async function handler(event: unknown): Promise<SendSummariesResult> {
  const month = inputSchema.parse(event ?? {}).month ?? previousMonth(new Date());
  logger.appendKeys({ month });
  const result: SendSummariesResult = { month, sent: 0, skipped: 0, failed: 0 };

  for await (const recipient of listRecipients()) {
    const { userId } = recipient;
    try {
      const summary = buildMonthlySummary(month, await listMonthExpenses(userId, month));
      if (isEmptySummary(summary) || !(await claimSummary(userId, month))) {
        result.skipped += 1;
        continue;
      }

      try {
        await sendSummary(recipient.email, summary);
      } catch (error: unknown) {
        await releaseSummary(userId, month);
        throw error;
      }
      result.sent += 1;
    } catch (error: unknown) {
      if (error instanceof MessageRejected) {
        // SES sandbox: the address isn't verified. Retrying won't help, so it doesn't fail the run.
        // Only the error name is logged: SES puts the address in the message.
        logger.warn('SES rejected the summary', { userId, errorName: error.name });
        result.skipped += 1;
        continue;
      }
      logger.error('Could not send the summary', { userId, error });
      result.failed += 1;
    }
  }

  logger.info('Monthly summaries done', { ...result });
  // Failing makes the run retry; the markers keep people who already got it from a second email.
  if (result.failed > 0) throw new Error(`${result.failed} monthly summaries failed`);
  return result;
}
