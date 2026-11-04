/**
 * End-to-end smoke test for the deployed expenses API.
 *
 * Usage (from the repo root):  pnpm --filter @receipts-app/api smoke
 * - The API URL is read from the ApiStack CloudFormation output (needs `aws login`),
 *   or from the API_URL environment variable.
 * - The Cognito access token is read from API_TOKEN, or asked for interactively.
 *
 * It creates its own expense and receipt and deletes them at the end. The tiny test photo stays in
 * the receipts bucket until expenses delete their image (later phase).
 */
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';
import { createReceiptUploadResponseSchema, expenseSchema, listExpensesResponseSchema } from '@receipts-app/contracts';

const run = promisify(execFile);

/** A valid 1×1 transparent PNG, small enough to keep the test cheap. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Sends a presigned POST to S3: the signed fields first, the file last (S3 requires that order). */
async function postToS3(
  url: string,
  fields: Record<string, string>,
  file: Blob,
  contentType: string,
): Promise<Response> {
  const form = new FormData();
  for (const [name, value] of Object.entries({ ...fields, 'Content-Type': contentType })) {
    form.append(name, value);
  }
  form.append('file', file);
  const response = await fetch(url, { method: 'POST', body: form });
  return { status: response.status, data: await response.text() };
}

interface Response {
  status: number;
  data: unknown;
}

interface CheckResult {
  name: string;
  expected: number;
  actual: number | null;
  passed: boolean;
}

const results: CheckResult[] = [];

async function resolveApiUrl(): Promise<string> {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/$/, '');
  }
  const { stdout } = await run('aws', [
    'cloudformation',
    'describe-stacks',
    '--stack-name',
    'ApiStack',
    '--query',
    "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue",
    '--output',
    'text',
  ]);
  return stdout.trim().replace(/\/$/, '');
}

async function resolveToken(): Promise<string> {
  if (process.env.API_TOKEN) {
    return process.env.API_TOKEN.trim();
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const token = await prompt.question('Cognito access token: ');
  prompt.close();
  return token.trim();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const apiUrl = await resolveApiUrl();
  const token = await resolveToken();
  console.log(`\nTesting ${apiUrl}\n`);

  async function call(
    method: string,
    path: string,
    options: { auth?: boolean; body?: unknown } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (options.auth !== false) {
      headers.authorization = `Bearer ${token}`;
    }
    if (options.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const response = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : undefined };
  }

  /** Runs a request, records whether the status matches, and returns the response for further checks. */
  async function check(name: string, expected: number, request: () => Promise<Response>): Promise<Response | null> {
    try {
      const response = await request();
      results.push({ name, expected, actual: response.status, passed: response.status === expected });
      return response;
    } catch (error: unknown) {
      results.push({ name, expected, actual: null, passed: false });
      console.error(`  ${name}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  function assert(name: string, condition: boolean): void {
    results.push({ name, expected: 1, actual: condition ? 1 : 0, passed: condition });
  }

  const month = today().slice(0, 7);
  const listPath = `/expenses?month=${month}`;

  await check('GET /expenses without token is rejected', 401, () => call('GET', listPath, { auth: false }));

  await check('GET /expenses without month is rejected', 400, () => call('GET', '/expenses'));

  await check('POST /expenses with invalid body is rejected', 400, () =>
    call('POST', '/expenses', { body: { merchant: '', total: -5, currency: 'pesos', date: 'ayer', category: 'x' } }),
  );

  const created = await check('POST /expenses creates an expense', 201, () =>
    call('POST', '/expenses', {
      body: { merchant: 'Smoke test', total: 1000, currency: 'COP', date: today(), category: 'other' },
    }),
  );
  const expense = expenseSchema.safeParse(created?.data);

  if (!expense.success) {
    assert('created expense matches the contract', false);
  } else {
    const id = expense.data.id;

    const listed = await check('GET /expenses?month lists the month', 200, () => call('GET', listPath));
    const list = listExpensesResponseSchema.safeParse(listed?.data);
    assert('month list contains the new expense', list.success && list.data.items.some((item) => item.id === id));

    const otherMonth = await check('GET /expenses for another month', 200, () =>
      call('GET', '/expenses?month=2000-01'),
    );
    const otherList = listExpensesResponseSchema.safeParse(otherMonth?.data);
    assert(
      'another month does not include it',
      otherList.success && !otherList.data.items.some((item) => item.id === id),
    );

    const updated = await check('PATCH /expenses/{id} updates fields', 200, () =>
      call('PATCH', `/expenses/${id}`, { body: { total: 2500 } }),
    );
    const updatedExpense = expenseSchema.safeParse(updated?.data);
    assert(
      'updated total is returned',
      updatedExpense.success && updatedExpense.data.status === 'PROCESSED' && updatedExpense.data.total === 2500,
    );

    await check('PATCH /expenses/{id} with empty body is rejected', 400, () =>
      call('PATCH', `/expenses/${id}`, { body: {} }),
    );

    await check('PATCH unknown expense returns 404', 404, () =>
      call('PATCH', '/expenses/00000000-0000-4000-8000-000000000000', { body: { total: 1 } }),
    );

    await check('DELETE /expenses/{id} deletes it', 204, () => call('DELETE', `/expenses/${id}`));
    await check('DELETE again returns 404', 404, () => call('DELETE', `/expenses/${id}`));

    const after = await check('GET /expenses after delete', 200, () => call('GET', listPath));
    const afterList = listExpensesResponseSchema.safeParse(after?.data);
    assert('deleted expense is gone', afterList.success && !afterList.data.items.some((item) => item.id === id));
  }

  // --- Receipt upload: pending expense + presigned POST straight to S3 ---

  await check('POST /receipts with an unsupported type is rejected', 400, () =>
    call('POST', '/receipts', { body: { contentType: 'application/pdf' } }),
  );

  const receipt = await check('POST /receipts creates a pending receipt', 201, () =>
    call('POST', '/receipts', { body: { contentType: 'image/png' } }),
  );
  const upload = createReceiptUploadResponseSchema.safeParse(receipt?.data);

  if (!upload.success) {
    assert('receipt upload response matches the contract', false);
  } else {
    const { expense: pending, upload: target } = upload.data;
    assert('new receipt starts as PENDING', pending.status === 'PENDING');

    await check('S3 rejects a file whose type differs from the signed one', 403, () =>
      postToS3(target.url, target.fields, new Blob([TINY_PNG], { type: 'image/jpeg' }), 'image/jpeg'),
    );

    await check('S3 accepts the photo with the presigned POST', 204, () =>
      postToS3(target.url, target.fields, new Blob([TINY_PNG], { type: 'image/png' }), 'image/png'),
    );

    const withReceipt = await check('GET /expenses shows the pending receipt', 200, () => call('GET', listPath));
    const receiptList = listExpensesResponseSchema.safeParse(withReceipt?.data);
    assert(
      'month list contains the PENDING receipt',
      receiptList.success &&
        receiptList.data.items.some((item) => item.id === pending.id && item.status !== 'PROCESSED'),
    );

    await check('DELETE the pending receipt', 204, () => call('DELETE', `/expenses/${pending.id}`));
  }

  for (const result of results) {
    const detail = result.passed ? '' : `  (expected ${result.expected}, got ${result.actual ?? 'error'})`;
    console.log(`${result.passed ? '✔' : '✘'} ${result.name}${detail}`);
  }

  const failed = results.filter((result) => !result.passed).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) {
    console.log('Hint: a 401 on every authenticated check usually means the access token expired (they last 1 hour).');
    process.exitCode = 1;
  }
}

await main();
