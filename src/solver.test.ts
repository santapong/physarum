import { describe, expect, it } from 'vitest';
import { buildCompleteGraph } from './graph';
import { solvePressures } from './solver';

describe('pressure solver', () => {
  it('solves the two-node grounded network', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 10, y: 0, flow: -1 },
    ], () => 0.5);
    const pressure = solvePressures(graph);
    expect(pressure).toHaveLength(2);
    expect(pressure[0]).toBe(0);
    expect(pressure[1]).toBeCloseTo(-20, 6);
  });

  it('keeps all pressure values finite', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 20, y: 0, flow: 0 },
      { id: 2, x: 40, y: 0, flow: -1 },
    ], () => 0.5);
    expect(solvePressures(graph).every(Number.isFinite)).toBe(true);
  });
});
