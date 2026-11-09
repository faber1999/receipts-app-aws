# @receipts-app/api

Lambda handlers for the Receipts App HTTP API, written in TypeScript and bundled per function with esbuild (`NodejsFunction` in `infra`). Each function runs on Node.js 24 (arm64).

## Routes

Every route requires a Cognito **access token** (`Authorization: Bearer <token>`), validated by the API Gateway JWT authorizer before the Lambda runs.

| Method and path | Handler | Response |
|---|---|---|
| `GET /expenses?month=YYYY-MM` | `expenses/handlers/list-expenses.ts` | `200` with the month's expenses, newest first |
| `POST /expenses` | `expenses/handlers/create-expense.ts` | `201` with the created expense (manual entry, `PROCESSED`) |
| `PATCH /expenses/{id}` | `expenses/handlers/update-expense.ts` | `200` with the updated expense; `404` if it doesn't exist or isn't yours |
| `DELETE /expenses/{id}` | `expenses/handlers/delete-expense.ts` | `204`; `404` if it doesn't exist or isn't yours |
| `POST /receipts` | `receipts/handlers/create-receipt-upload.ts` | `201` with a `PENDING` expense and a presigned POST to upload the photo to S3 |

Invalid input returns `400` with the Zod field errors.

## Receipt processing

`receipts/handlers/extract-receipt.ts` is not an HTTP handler: the processing workflow (Step Functions) invokes it with the uploaded object (`{ bucket, key }`).

1. It parses the S3 key to learn the owner, the receipt id and the content type (`receipts/receipt-key.ts`). Keys the app didn't create throw `NotAReceiptError`.
2. It downloads the photo and sends it to Claude Haiku 5.5 (`receipts/receipt-extractor.ts`), with structured outputs bound to `receiptExtractionSchema`.
3. It returns `{ userId, receiptId, expense }`. It doesn't write to DynamoDB: that is a separate workflow step, so a failed write is retried without paying for the model call again.

| Error (`errorType` in Step Functions) | Meaning | Workflow reaction |
|---|---|---|
| `UnreadableReceiptError` | The photo is not a readable receipt; the model said why | Mark `FAILED`, no retry |
| `ReceiptExtractionError` | Refusal, truncated or invalid model output | Mark `FAILED` |
| `NotAReceiptError` | Object outside the app's key format | Ignore |
| Others (network, throttling) | Transient | Retry |

The Anthropic API key is read from the SSM `SecureString` named by `ANTHROPIC_API_KEY_PARAMETER`, through Powertools Parameters with a 5-minute cache, so a rotated key is picked up without a redeploy. Logs never include the merchant or the total.

Bedrock was the original choice; see the root README for why the Anthropic API is used instead.

## Design

- **Thin handlers:** each one parses and validates input, calls the domain code, and shapes the HTTP response. DynamoDB mapping lives in `expenses/expense-repository.ts`, as pure functions that are unit-tested.
- **Ownership:** the user id is always the JWT `sub` (`shared/auth.ts`), never a path, query or body value. Keys are `USER#<sub>` / `RECEIPT#<id>`, so another user's item simply isn't found.
- **Conditional writes:**
  - create uses `attribute_not_exists(PK)`
  - update and delete use `attribute_exists(PK)`; a failed condition maps to `404`
- **Reserved words:** every attribute in update expressions goes through `ExpressionAttributeNames`, because `date` and `status` are DynamoDB reserved words.
- **Monthly listing:** a query on `GSI1` with `begins_with(GSI1SK, 'DATE#YYYY-MM')`, read through `paginateQuery`, so results are complete even past the 1 MB page limit.
- **Receipt uploads:**
  - The presigned POST policy limits the file to JPEG or PNG and at most 10 MB, and S3 enforces it.
  - The object key `receipts/<sub>/<id>.<ext>` carries the owner, so the processing pipeline can tell whose receipt it is from the S3 event alone.
- **Warm starts:** SDK clients and the logger are created outside the handler, so warm invocations reuse them.
- **Validated environment:** `shared/env.ts` validates the Lambda environment at cold start: `TABLE_NAME` and `RECEIPTS_BUCKET`.

## Layout

```
src/
├─ expenses/
│  ├─ handlers/                  One file per Lambda
│  ├─ expense-repository.ts      Contract ↔ DynamoDB item mapping
│  └─ expense-repository.test.ts
├─ receipts/
│  ├─ handlers/                  Receipt upload (HTTP) and extraction (workflow) Lambdas
│  ├─ receipt-key.ts             Builds and parses receipts/<userId>/<id>.<ext>
│  └─ receipt-extractor.ts       Claude extraction behind the ReceiptExtractor type
└─ shared/                       auth (JWT sub), db client, env, HTTP helpers
scripts/smoke-test.ts            End-to-end test against the deployed API
scripts/try-extraction.ts        Runs the extractor on a local photo
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (Vitest) |
| `pnpm smoke` | Smoke test against the deployed API |
| `pnpm exec tsx scripts/try-extraction.ts <photo>` | Extracts one local receipt photo with Claude. Reads the API key from SSM (needs `aws login`) and costs a fraction of a cent per run |

### Smoke test

```bash
pnpm --filter @receipts-app/api smoke
```

- Reads the API URL from the `ApiStack` output (needs `aws login`), or from `API_URL`.
- Asks for a Cognito access token, or reads it from `API_TOKEN`. To get one, sign in on the web app and copy the `…accessToken` value from Local Storage. Tokens last one hour.
- Covers:
  - authorization (401)
  - validation (400)
  - create, list by month, update, delete and not-found cases
  - a real presigned upload to S3, including a rejected upload with a mismatched content type
- Removes the expenses it creates. The tiny test image stays in the receipts bucket.
