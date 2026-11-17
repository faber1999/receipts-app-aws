# @receipts-app/api

Lambda handlers for the Receipts App HTTP API, written in TypeScript and bundled per function with esbuild (`NodejsFunction` in `infra`). Each function runs on Node.js 24 (arm64).

## Routes

Every route requires a Cognito **access token** (`Authorization: Bearer <token>`), validated by the API Gateway JWT authorizer before the Lambda runs.

| Method and path | Handler | Response |
|---|---|---|
| `GET /expenses?month=YYYY-MM` | `expenses/handlers/list-expenses.ts` | `200` with the month's expenses, newest first |
| `POST /expenses` | `expenses/handlers/create-expense.ts` | `201` with the created expense (manual entry, `PROCESSED`) |
| `PATCH /expenses/{id}` | `expenses/handlers/update-expense.ts` | `200` with the updated expense. Only `PROCESSED` expenses: `409` otherwise, `404` if it doesn't exist or isn't yours |
| `POST /expenses/{id}/confirm` | `expenses/handlers/confirm-expense.ts` | `200` with the `PROCESSED` expense. Takes every field and confirms a `REVIEW` or `FAILED` expense: `409` in any other status, `404` if it doesn't exist |
| `DELETE /expenses/{id}` | `expenses/handlers/delete-expense.ts` | `204`, and its photo is deleted from S3; `404` if it doesn't exist or isn't yours |
| `GET /expenses/{id}/receipt` | `receipts/handlers/get-receipt-photo.ts` | `200` with a presigned GET URL to the photo, valid for 5 minutes; `404` if the expense doesn't exist or has no photo |
| `POST /receipts` | `receipts/handlers/create-receipt-upload.ts` | `201` with a `PENDING` expense and a presigned POST to upload the photo to S3. The item gets `expiresAt` one day ahead, so the table's TTL deletes it if the photo never arrives |

Invalid input returns `400` with the Zod field errors.

### Status rules

Every write is conditioned on the expense status, so the API and the workflow never step on each other:

| Writer | Condition |
|---|---|
| Processing workflow (`save-extraction`, `MarkFailed`) | `PENDING` |
| `POST /expenses/{id}/confirm` | `REVIEW` or `FAILED` |
| `PATCH /expenses/{id}` | `PROCESSED` |

On a failed condition, `ReturnValuesOnConditionCheckFailure: 'ALL_OLD'` returns the current item inside the error, so the handler answers `404` (no item) or `409` (wrong status) without reading first.

Leaving `PENDING` (`save-extraction` or `MarkFailed`) also runs `REMOVE expiresAt`, so the TTL only ever deletes abandoned uploads. The attribute is called `expiresAt` because `TTL` is a DynamoDB reserved word, and `fromItem` drops it (Zod strips unknown keys), so it never reaches the API.

## Receipt processing

Two Lambdas are not HTTP handlers: the processing workflow (Step Functions) invokes them in turn.

**`receipts/handlers/extract-receipt.ts`** gets the uploaded object (`{ bucket, key }`):

1. It parses the S3 key to learn the owner, the receipt id and the content type (`receipts/receipt-key.ts`). Keys the app didn't create throw `NotAReceiptError`.
2. It downloads the photo and sends it to Claude Haiku 5.5 (`receipts/receipt-extractor.ts`), with structured outputs bound to `receiptExtractionSchema`. Each field can come back `null` when the model can't read it with confidence.
3. It returns `{ userId, receiptId, expense }`. It doesn't write to DynamoDB: that is the next step, so a failed write is retried without paying for the model call again.

**`receipts/handlers/save-extraction.ts`** gets that result, validates it again with Zod and saves it with `toExtractionUpdate` (`receipts/extraction-update.ts`): only the fields that were read, `status = REVIEW`, and `GSI1SK` when the date was read. The update is conditioned on `PENDING`; if the receipt is no longer pending (a duplicate event, or the expense was deleted), it returns `{ saved: false }` and the workflow ends normally. It logs which fields were missing, never their values.

| Error (`errorType` in Step Functions) | Meaning | Workflow reaction |
|---|---|---|
| `UnreadableReceiptError` | The image is not a receipt; the model said why | Mark `FAILED`, no retry |
| `ReceiptExtractionError` | Refusal, truncated or invalid model output | Mark `FAILED`, dead-letter queue |
| `NotAReceiptError` | Object outside the app's key format | Ignore |
| `ReceiptDeletedError` | The expense and its photo were deleted before the photo was read | Ignore |
| Lambda service errors | Transient | Retry (added by CDK); the Anthropic SDK also retries network errors and 429s |
| Anything else | Unexpected | Mark `FAILED`, dead-letter queue |

The Anthropic API key is read from the SSM `SecureString` named by `ANTHROPIC_API_KEY_PARAMETER`, through Powertools Parameters with a 5-minute cache, so a rotated key is picked up without a redeploy. Logs never include the merchant or the total.

Bedrock was the original choice; see the root README for why the Anthropic API is used instead.

## Monthly summary

**`summaries/handlers/send-monthly-summaries.ts`** runs on a schedule (the 1st of each month) and is not an HTTP handler. The month comes from the input (`{ "month": "YYYY-MM" }`) or defaults to the previous month.

For each enabled, confirmed Cognito user with a verified email (`ListUsers`; the user id is the `sub`, as in the API):

1. It queries the month through `GSI1` and builds the summary with `summaries/monthly-summary.ts`: `PROCESSED` totals per currency and category, and a count of `REVIEW` and `FAILED` receipts. `PENDING` receipts are left out. An empty month sends nothing.
2. It writes `USER#<sub>` / `SUMMARY#<yyyy-mm>` with `attribute_not_exists(PK)`. If the marker exists, the summary was already sent and the user is skipped.
3. It sends the plain-text email through SES. If SES fails, it deletes the marker so a retry can send it.

| Outcome | Counted as | Run |
|---|---|---|
| Sent | `sent` | — |
| Empty month, or marker already there | `skipped` | — |
| SES `MessageRejected` (unverified address in the sandbox) | `skipped`, logged with the error name only, since the message contains the address | Retrying won't help |
| Anything else | `failed` | The run throws at the end so it is retried; the markers protect people who already got it |

Email addresses are never logged, only the `sub`.

## Design

- **Thin handlers:** each one parses and validates input, calls the domain code, and shapes the HTTP response. DynamoDB mapping lives in `expenses/expense-repository.ts`, as pure functions that are unit-tested.
- **Ownership:** the user id is always the JWT `sub` (`shared/auth.ts`), never a path, query or body value. Keys are `USER#<sub>` / `RECEIPT#<id>`, so another user's item simply isn't found.
- **Conditional writes:**
  - create uses `attribute_not_exists(PK)`
  - delete uses `attribute_exists(PK)` and `ReturnValues: 'ALL_OLD'`, which gives the deleted item's `imageKey` without an extra read; a failed condition maps to `404`
  - update, confirm and the workflow check the status (see [Status rules](#status-rules))
- **Reserved words:** every attribute in update expressions goes through `ExpressionAttributeNames`, because `date` and `status` are DynamoDB reserved words.
- **Monthly listing:** a query on `GSI1` with `begins_with(GSI1SK, 'DATE#YYYY-MM')`, read through `paginateQuery`, so results are complete even past the 1 MB page limit.
- **Receipt uploads:**
  - The presigned POST policy limits the file to JPEG or PNG and at most 10 MB, and S3 enforces it.
  - The object key `receipts/<sub>/<id>.<ext>` carries the owner, so the processing pipeline can tell whose receipt it is from the S3 event alone.
- **Receipt photos:** signing a GET URL is a local computation with the Lambda's credentials, so the photo Lambda only needs `GetItem` and `s3:GetObject`; the browser downloads the photo straight from S3. Deleting an expense deletes its photo after the item; if S3 fails, the request still succeeds and a warning is logged.
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
│  ├─ handlers/                  Upload and photo (HTTP); extract and save (workflow) Lambdas
│  ├─ receipt-key.ts             Builds and parses receipts/<userId>/<id>.<ext>
│  ├─ receipt-extractor.ts       Claude extraction behind the ReceiptExtractor type
│  └─ extraction-update.ts       What an extraction saves: the fields read, status REVIEW
├─ summaries/
│  ├─ handlers/                  The scheduled monthly summary Lambda
│  └─ monthly-summary.ts         Totals per currency and category, and the email text
└─ shared/                       auth (JWT sub), db client, env, HTTP helpers
scripts/smoke-test.ts            End-to-end test against the deployed API
scripts/upload-receipt.ts        Uploads a real photo through the API and waits for the workflow
scripts/try-extraction.ts        Runs the extractor on a local photo
scripts/script-helpers.ts        API URL, token and S3 POST helpers shared by the scripts
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm test` | Unit tests (Vitest) |
| `pnpm smoke` | Smoke test against the deployed API |
| `pnpm exec tsx scripts/try-extraction.ts <photo>` | Extracts one local receipt photo with Claude. Reads the API key from SSM (needs `aws login`) and costs a fraction of a cent per run |
| `pnpm exec tsx scripts/upload-receipt.ts <photo>` | Uploads a real photo through the deployed API and S3, then polls until the workflow leaves `PENDING`. Asks for an access token like the smoke test |

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
- Removes the expenses it creates, and their photos with them. The tiny test image also starts the processing workflow, which ends as unreadable (or does nothing when the expense is already gone).
