import { type Expense, expenseSchema, type UpdateExpenseInput } from '@receipts-app/contracts';

export const userPk = (userId: string): string => `USER#${userId}`;
export const receiptSk = (expenseId: string): string => `RECEIPT#${expenseId}`;
export const dateSk = (date: string): string => `DATE#${date}`;

interface ExpenseKeys {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

/**
 * An expense as stored in the single table: the contract plus the key attributes.
 * A type intersection (not `interface extends`) because Expense is a union of statuses.
 */
export type ExpenseItem = Expense & ExpenseKeys;

export function toItem(userId: string, expense: Expense): ExpenseItem {
  return {
    ...expense,
    PK: userPk(userId),
    SK: receiptSk(expense.id),
    GSI1PK: userPk(userId),
    GSI1SK: dateSk(expense.date),
  };
}

/** Validates an item read from DynamoDB; Zod drops the key attributes the client never sees. */
export function fromItem(item: Record<string, unknown>): Expense {
  return expenseSchema.parse(item);
}

export function expenseKey(userId: string, expenseId: string): { PK: string; SK: string } {
  return { PK: userPk(userId), SK: receiptSk(expenseId) };
}

/**
 * Builds a DynamoDB SET expression for the provided fields.
 * Every name goes through ExpressionAttributeNames because `date` and `status` are reserved words.
 * Changing the date also moves the item in GSI1, so GSI1SK is updated with it.
 */
export function toUpdateExpression(input: UpdateExpenseInput): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const fields: Record<string, unknown> = { ...input };
  if (input.date) {
    fields.GSI1SK = dateSk(input.date);
  }

  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);

  return {
    UpdateExpression: `SET ${entries.map(([name]) => `#${name} = :${name}`).join(', ')}`,
    ExpressionAttributeNames: Object.fromEntries(entries.map(([name]) => [`#${name}`, name])),
    ExpressionAttributeValues: Object.fromEntries(entries.map(([name, value]) => [`:${name}`, value])),
  };
}
