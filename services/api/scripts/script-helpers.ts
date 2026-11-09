/** Helpers shared by the scripts that call the deployed API (smoke test, receipt upload). */
import { execFile } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface Response {
  status: number;
  data: unknown;
}

/** API base URL: API_URL, or the ApiStack CloudFormation output (needs `aws login`). */
export async function resolveApiUrl(): Promise<string> {
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

/** Cognito access token: API_TOKEN, or asked for interactively. */
export async function resolveToken(): Promise<string> {
  if (process.env.API_TOKEN) {
    return process.env.API_TOKEN.trim();
  }
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const token = await prompt.question('Cognito access token: ');
  prompt.close();
  return token.trim();
}

/** Sends a presigned POST to S3: the signed fields first, the file last (S3 requires that order). */
export async function postToS3(
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
