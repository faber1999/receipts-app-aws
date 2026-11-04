import { type Expense, expenseSchema } from '@receipts-app/contracts';

export const userPk = (userId: string): string => `USER#${userId}`;
export const receiptSk = (expenseId: string): string => `RECEIPT#${expenseId}`;
export const dateSk = (date: string): string => `DATE#${date}`;

/** An expense as stored in the single table: the contract plus the key attributes. */
export interface ExpenseItem extends Expense {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
}

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
