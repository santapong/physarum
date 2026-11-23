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

const stateV2: SharedState = {
  version: 2,
  nodes: [
    { id: 0, x: 450, y: 290, flow: -1, label: 'Tokyo' },
    { id: 1, x: 390, y: 418, flow: 1, label: 'Yokohama' },
  ],
  mode: 'delaunay',
  flowMode: 'multi-terminal',
  mu: 1.35,
  dt: 0.05,
  speed: 8,
  seed: 2010,
};

describe('share state', () => {
  it('round-trips a valid v1 scenario', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('round-trips a valid v2 multi-terminal scenario with labels', () => {
    expect(decodeState(encodeState(stateV2))).toEqual(stateV2);
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
