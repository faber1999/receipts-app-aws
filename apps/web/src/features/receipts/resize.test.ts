import { describe, expect, it } from 'vitest';
import { fitWithin, RECEIPT_MAX_EDGE } from './resize';

describe('fitWithin', () => {
  it('scales a tall phone photo so its height is the max edge', () => {
    expect(fitWithin({ width: 3024, height: 4032 })).toEqual({ width: 1176, height: RECEIPT_MAX_EDGE });
  });

  it('scales a wide photo so its width is the max edge', () => {
    expect(fitWithin({ width: 4000, height: 3000 })).toEqual({ width: RECEIPT_MAX_EDGE, height: 1176 });
  });

  it('scales a square photo on both edges', () => {
    expect(fitWithin({ width: 2000, height: 2000 }, 1000)).toEqual({ width: 1000, height: 1000 });
  });

  it('never upscales a photo that already fits', () => {
    expect(fitWithin({ width: 800, height: 1200 })).toEqual({ width: 800, height: 1200 });
    expect(fitWithin({ width: RECEIPT_MAX_EDGE, height: 900 })).toEqual({ width: RECEIPT_MAX_EDGE, height: 900 });
  });

  it('keeps a very thin strip at least 1 px wide', () => {
    expect(fitWithin({ width: 2, height: 10000 }, 1000)).toEqual({ width: 1, height: 1000 });
  });

  it('keeps the aspect ratio within rounding', () => {
    const { width, height } = fitWithin({ width: 3000, height: 7000 });
    expect(height).toBe(RECEIPT_MAX_EDGE);
    expect(Math.abs(width / height - 3000 / 7000)).toBeLessThan(0.001);
  });

  it('rejects sizes that are not positive and finite', () => {
    expect(() => fitWithin({ width: 0, height: 100 })).toThrow(RangeError);
    expect(() => fitWithin({ width: 100, height: Number.NaN })).toThrow(RangeError);
    expect(() => fitWithin({ width: 100, height: 100 }, 0)).toThrow(RangeError);
  });
});
