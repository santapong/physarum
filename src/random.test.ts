import { describe, expect, it } from 'vitest';
import { createRandom, normalizeSeed } from './random';

describe('seeded random generator', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = createRandom(42);
    const b = createRandom(42);
    expect(Array.from({ length: 8 }, a)).toEqual(Array.from({ length: 8 }, b));
  });

  it('returns values in the unit interval', () => {
    const random = createRandom(7);
    for (let index = 0; index < 100; index++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('normalizes zero and fractional seeds', () => {
    expect(normalizeSeed(0)).toBe(1);
    expect(normalizeSeed(12.9)).toBe(12);
  });
});
