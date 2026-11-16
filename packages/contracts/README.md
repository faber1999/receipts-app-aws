# @receipts-app/contracts

Zod schemas and the TypeScript types inferred from them (`z.infer`), shared by the web app, the API and the tests. A change to a contract shows up as a type error everywhere it matters.

The package exports TypeScript source directly (`exports: ./src/index.ts`), with no build step: esbuild compiles it into each Lambda, and Next.js compiles it through `transpilePackages`.

## Schemas

### `expenses/expense.ts`

| Export | Describes |
|---|---|
| `expenseSchema` / `Expense` | An expense: a discriminated union on `status` |
| `processedExpenseSchema` / `ProcessedExpense` | `status: 'PROCESSED'`: a complete, confirmed expense with merchant, total, currency (ISO 4217), category and date |
| `reviewExpenseSchema` / `ReviewExpense` | `status: 'REVIEW'`: what the AI read, waiting for the person. Merchant, total, currency and category are each optional; `date` is the receipt date when read, otherwise the upload date |
| `unprocessedExpenseSchema` / `UnprocessedExpense` | `status: 'PENDING' \| 'FAILED'`: an uploaded receipt with only `imageKey`, the upload date and `createdAt` |
| `expenseStatusSchema` / `ExpenseStatus` | `PENDING`, `REVIEW`, `PROCESSED`, `FAILED` |
| `createExpenseInputSchema` | Body of `POST /expenses` and of `POST /expenses/{id}/confirm` (every field required) |
| `updateExpenseInputSchema` | Body of `PATCH /expenses/{id}` (a non-empty subset of the editable fields; `PROCESSED` expenses only) |
| `listExpensesQuerySchema` | Query of `GET /expenses` (`month=YYYY-MM`) |
| `listExpensesResponseSchema` | Response of `GET /expenses` |
| `EXPENSE_CATEGORIES`, `expenseCategorySchema` | Category codes. The web translates them; they are stored in English. |

### `receipts/receipt-upload.ts`

| Export | Describes |
|---|---|
| `createReceiptUploadInputSchema` | Body of `POST /receipts`: `contentType` (JPEG or PNG) |
| `createReceiptUploadResponseSchema` | The pending expense and the presigned POST (`url` and `fields`) |
| `MAX_RECEIPT_BYTES`, `RECEIPT_CONTENT_TYPES` | Upload limits, also enforced by the S3 POST policy |

### `receipts/receipt-extraction.ts`

| Export | Describes |
|---|---|
| `extractedExpenseSchema` / `ExtractedExpense` | The fields of a manual entry (`createExpenseInputSchema`), each one `nullable`: `null` when the AI couldn't read it with confidence |
| `receiptExtractionSchema` / `ReceiptExtraction` | What the AI returns for a receipt photo: `expense` (an `ExtractedExpense`), or `null` with an `unreadableReason` when the image is not a receipt |

The API passes `receiptExtractionSchema` to Claude as a structured output. Constraints the model API doesn't support (the currency regex, string lengths, `nonnegative`) are removed from what is sent and checked by Zod on the response.

### `receipts/receipt-photo.ts`

| Export | Describes |
|---|---|
| `receiptPhotoResponseSchema` / `ReceiptPhotoResponse` | Response of `GET /expenses/{id}/receipt`: a presigned `url` and its `expiresAt` |

## Usage

```ts
import { type Expense, expenseSchema } from '@receipts-app/contracts';

const expense: Expense = expenseSchema.parse(json);

if (expense.status === 'PROCESSED') {
  expense.total; // always present once the expense is confirmed
} else if (expense.status === 'REVIEW') {
  expense.total; // number | undefined: the AI may not have read it
}
```

Things that stay out of this package:

- DynamoDB key attributes (`PK`, `SK`, `GSI1PK`, `GSI1SK`) are an API implementation detail and are never part of a contract.
- Validation messages for forms live in the web app's dictionaries.

## Adding a feature

Create `src/<feature>/<name>.ts` and re-export it from `src/index.ts`.
