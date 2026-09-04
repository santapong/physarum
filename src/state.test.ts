import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, sanitizeState, type SharedState } from './state';

const state: SharedState = {
  version: 1,
  nodes: [
    { id: 0, x: 10, y: 20, flow: 1 },
    { id: 1, x: 800, y: 500, flow: -1 },
  ],
  mode: 'delaunay',
  mu: 1.25,
  dt: 0.04,
  speed: 9,
  seed: 404,
};

describe('share state', () => {
  it('round-trips a valid scenario', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('rejects malformed state and clamps unsafe values', () => {
    expect(sanitizeState({ nodes: 'wrong' })).toBeNull();
    const result = sanitizeState({ ...state, mu: 99, dt: -5, speed: 100 });
    expect(result).toMatchObject({ mu: 2, dt: 0.01, speed: 24 });
  });

  it('returns null for invalid encoded data', () => {
    expect(decodeState('%not-json')).toBeNull();
  });
});
