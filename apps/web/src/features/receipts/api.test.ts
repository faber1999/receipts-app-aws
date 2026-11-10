import { afterEach, describe, expect, it, vi } from 'vitest';
import { postReceiptToStorage } from './api';

// The real client configures Amplify from the environment; this test only exercises the S3 request.
vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }));

describe('postReceiptToStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends Content-Type once, even though the signed fields already include it, and the file last', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await postReceiptToStorage(
      { url: 'https://bucket.example.com/', fields: { key: 'receipts/u/r.jpg', 'Content-Type': 'image/jpeg' } },
      new Blob(['photo'], { type: 'image/jpeg' }),
      'image/jpeg',
    );

    const form = fetchMock.mock.calls[0]?.[1]?.body;
    if (!(form instanceof FormData)) throw new Error('Expected a FormData body');
    expect(form.getAll('Content-Type')).toEqual(['image/jpeg']);
    expect([...form.keys()].at(-1)).toBe('file');
  });
});
