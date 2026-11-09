import { readFile } from 'node:fs/promises';
import Anthropic from '@anthropic-ai/sdk';
import { getParameter } from '@aws-lambda-powertools/parameters/ssm';
import { createClaudeExtractor } from '../src/receipts/receipt-extractor';

// Usage: pnpm --filter @receipts-app/api exec tsx scripts/try-extraction.ts <image.jpg|png>
const path = process.argv[2];
if (!path) {
  console.error('Usage: tsx scripts/try-extraction.ts <image.jpg|png>');
  process.exit(1);
}

const apiKey = await getParameter('/receipts-app/anthropic-api-key', { decrypt: true });
if (!apiKey) throw new Error('Parameter /receipts-app/anthropic-api-key not found');

const extract = createClaudeExtractor(new Anthropic({ apiKey }));
const contentType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

console.log(await extract({ data: await readFile(path), contentType }));
