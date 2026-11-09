import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EXPENSE_CATEGORIES, receiptExtractionSchema } from '@receipts-app/contracts';
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPT } from './receipt-extractor';

describe('receipt extractor', () => {
  it('turns the extraction contract into an output format', () => {
    expect(() => zodOutputFormat(receiptExtractionSchema)).not.toThrow();
  });

  it('lists every category in the prompt', () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(SYSTEM_PROMPT).toContain(category);
    }
  });
});
