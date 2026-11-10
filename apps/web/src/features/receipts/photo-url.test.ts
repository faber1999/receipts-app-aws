import type { ReceiptPhotoResponse } from '@receipts-app/contracts';
import { describe, expect, it, vi } from 'vitest';
import { isPhotoUrlFresh, msUntilRenewal, PHOTO_URL_RENEW_MARGIN_MS, withPhotoUrlCache } from './photo-url';

const NOW = Date.parse('2026-11-09T12:00:00.000Z');
const FIVE_MINUTES = 5 * 60_000;

function photo(expiresInMs: number, url = 'https://bucket.example.com/r.jpg?sig=1'): ReceiptPhotoResponse {
  return { url, expiresAt: new Date(NOW + expiresInMs).toISOString() };
}

function loadMock() {
  return vi.fn<(expenseId: string) => Promise<ReceiptPhotoResponse>>(async () => photo(FIVE_MINUTES));
}

describe('isPhotoUrlFresh', () => {
  it('accepts a URL with more than the safety margin left', () => {
    expect(isPhotoUrlFresh(photo(FIVE_MINUTES), NOW)).toBe(true);
  });

  it('treats a URL inside the margin, or past expiry, as stale', () => {
    expect(isPhotoUrlFresh(photo(PHOTO_URL_RENEW_MARGIN_MS), NOW)).toBe(false);
    expect(isPhotoUrlFresh(photo(10_000), NOW)).toBe(false);
    expect(isPhotoUrlFresh(photo(-1_000), NOW)).toBe(false);
  });

  it('treats an unparseable expiry as stale', () => {
    expect(isPhotoUrlFresh({ expiresAt: 'soon' }, NOW)).toBe(false);
  });
});

describe('msUntilRenewal', () => {
  it('schedules the renewal one margin before expiry', () => {
    expect(msUntilRenewal(photo(FIVE_MINUTES), NOW)).toBe(FIVE_MINUTES - PHOTO_URL_RENEW_MARGIN_MS);
  });

  it('never returns a negative delay', () => {
    expect(msUntilRenewal(photo(-60_000), NOW)).toBe(0);
    expect(msUntilRenewal({ expiresAt: 'soon' }, NOW)).toBe(0);
  });
});

describe('withPhotoUrlCache', () => {
  it('reuses a fresh URL for the same expense', async () => {
    const load = loadMock();
    const loader = withPhotoUrlCache(load, () => NOW);

    await loader('a');
    await loader('a');

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('requests a new URL once the cached one is stale', async () => {
    let now = NOW;
    const load = loadMock();
    const loader = withPhotoUrlCache(load, () => now);

    await loader('a');
    now = NOW + FIVE_MINUTES - PHOTO_URL_RENEW_MARGIN_MS;
    await loader('a');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache when forced', async () => {
    const load = loadMock();
    const loader = withPhotoUrlCache(load, () => NOW);

    await loader('a');
    await loader('a', { force: true });

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const load = loadMock();
    const loader = withPhotoUrlCache(load, () => NOW);

    const [first, second] = await Promise.all([loader('a'), loader('a')]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('keeps expenses apart', async () => {
    const load = vi.fn<(expenseId: string) => Promise<ReceiptPhotoResponse>>(async (expenseId) =>
      photo(FIVE_MINUTES, `https://bucket.example.com/${expenseId}.jpg`),
    );
    const loader = withPhotoUrlCache(load, () => NOW);

    expect((await loader('a')).url).toBe('https://bucket.example.com/a.jpg');
    expect((await loader('b')).url).toBe('https://bucket.example.com/b.jpg');
  });

  it('never caches a failure', async () => {
    const load = vi
      .fn<(expenseId: string) => Promise<ReceiptPhotoResponse>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(photo(FIVE_MINUTES));
    const loader = withPhotoUrlCache(load, () => NOW);

    await expect(loader('a')).rejects.toThrow('Failed to fetch');
    await expect(loader('a')).resolves.toEqual(photo(FIVE_MINUTES));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
