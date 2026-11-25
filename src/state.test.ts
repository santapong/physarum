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

const stateV3: SharedState = {
  version: 3,
  domain: 'optimization',
  dynamicsMode: 'linear-lp',
  nodes: [
    { id: 0, x: 110, y: 215, flow: 0.6, label: 'Supply A' },
    { id: 1, x: 795, y: 215, flow: -0.6, label: 'Demand X' },
  ],
  mode: 'delaunay',
  flowMode: 'source-sink',
  mu: 1.0,
  dt: 0.05,
  speed: 8,
  seed: 4102,
  maxRadiusMm: 1.5,
  capacities: [{ i: 0, j: 1, capacity: 0.55 }],
};

describe('share state', () => {
  it('round-trips a valid v1 scenario', () => {
    expect(decodeState(encodeState(state))).toEqual(state);
  });

  it('round-trips a valid v2 multi-terminal scenario with labels', () => {
    expect(decodeState(encodeState(stateV2))).toEqual(stateV2);
  });

  it('round-trips a valid v3 domain scenario with capacities and preserves fractional flows', () => {
    expect(decodeState(encodeState(stateV3))).toEqual(stateV3);
  });

  it('round-trips a valid v3 fjsp explicit factory scenario with presetId', () => {
    const stateFjsp: SharedState = {
      version: 3,
      domain: 'fjsp',
      dynamicsMode: 'linear-lp',
      nodes: [
        { id: 0, x: 45, y: 300, flow: 1, label: 'Intake' },
        { id: 1, x: 860, y: 300, flow: -1, label: 'QC Pass' },
      ],
      mode: 'explicit',
      flowMode: 'source-sink',
      mu: 1.0,
      dt: 0.05,
      speed: 8,
      seed: 5101,
      presetId: 'fjsp-jewelry-atelier',
    };
    expect(decodeState(encodeState(stateFjsp))).toEqual(stateFjsp);
  });

  it('sanitizes malformed v3 fields cleanly without throwing', () => {
    const cleaned = sanitizeState({
      ...stateV3,
      domain: 'unknown',
      dynamicsMode: 'invalid',
      maxRadiusMm: 99,
      capacities: [
        { i: 0, j: 0, capacity: 0.5 },
        { i: 0, j: 9, capacity: 0.5 },
        { i: 1, j: 0, capacity: -1 },
        null,
      ],
    });
    expect(cleaned).toMatchObject({
      version: 3,
      domain: 'transport',
      dynamicsMode: 'tero',
      maxRadiusMm: 5.0,
    });
    if (cleaned?.version === 3) {
      expect(cleaned.capacities).toBeUndefined();
    }
  });

  it('rejects malformed state and clamps unsafe values', () => {
    expect(sanitizeState({ nodes: 'wrong' })).toBeNull();
    const result = sanitizeState({ ...state, mu: 99, dt: -5, speed: 100 });
    expect(result).toMatchObject({ mu: 2, dt: 0.01, speed: 24 });
  });

  it('returns null for invalid encoded data', () => {
    expect(decodeState('%not-json')).toBeNull();
  });

  it.each([null, undefined, false, 42, 'node', {}, { x: 1, y: 2 }])(
    'rejects malformed node entry %j without throwing',
    (entry) => {
      expect(sanitizeState({ ...state, nodes: [state.nodes[0], entry] })).toBeNull();
    },
  );
});
