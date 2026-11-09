/**
 * Uploads a real receipt photo through the deployed API and waits for the processing workflow.
 *
 * Usage (from the repo root):  pnpm --filter @receipts-app/api exec tsx scripts/upload-receipt.ts <photo.jpg|png>
 * Needs `aws login` (API URL) and a Cognito access token (API_TOKEN or prompt), like the smoke test.
 * The expense is kept, so it shows up in the web app.
 */
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { createReceiptUploadResponseSchema, listExpensesResponseSchema } from '@receipts-app/contracts';
import { postToS3, resolveApiUrl, resolveToken } from './script-helpers';

const path = process.argv[2];
if (!path) {
  console.error('Usage: tsx scripts/upload-receipt.ts <photo.jpg|png>');
  process.exit(1);
}
const contentType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

const apiUrl = await resolveApiUrl();
const token = await resolveToken();
const auth = { authorization: `Bearer ${token}` };

// 1. Ask the API for an upload: it creates the PENDING expense and signs the S3 POST.
const created = await fetch(`${apiUrl}/receipts`, {
  method: 'POST',
  headers: { ...auth, 'content-type': 'application/json' },
  body: JSON.stringify({ contentType }),
});
if (created.status !== 201) {
  throw new Error(`POST /receipts returned ${created.status}: ${await created.text()}`);
}
const { expense, upload } = createReceiptUploadResponseSchema.parse(await created.json());
console.log(`Created pending expense ${expense.id}`);

// 2. Upload the photo straight to S3, as the browser will. S3 then emits "Object Created".
const photo = new Blob([await readFile(path)], { type: contentType });
const uploaded = await postToS3(upload.url, upload.fields, photo, contentType);
if (uploaded.status !== 204) {
  throw new Error(`S3 upload returned ${uploaded.status}: ${String(uploaded.data)}`);
}
console.log('Uploaded the photo, waiting for the workflow');

// 3. Poll until the workflow has handled the receipt.
const month = expense.date.slice(0, 7);
for (let attempt = 1; attempt <= 20; attempt++) {
  await sleep(3000);
  const listed = await fetch(`${apiUrl}/expenses?month=${month}`, { headers: auth });
  const { items } = listExpensesResponseSchema.parse(await listed.json());
  const current = items.find((item) => item.id === expense.id);

  if (!current) {
    console.log(`\nThe expense left ${month}: the receipt date is in another month. Check the web app.`);
    process.exit(0);
  }
  if (current.status !== 'PENDING') {
    console.log('\n', current);
    process.exit(current.status === 'PROCESSED' ? 0 : 1);
  }
  process.stdout.write('.');
}

console.error('\nStill PENDING after 60 seconds. Check the execution in the Step Functions console.');
process.exit(1);
