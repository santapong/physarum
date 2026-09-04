import { describe, expect, it } from 'vitest';
import { buildCompleteGraph } from './graph';
import { step } from './sim';

describe('simulation step', () => {
  it('updates conductivity while preserving numeric bounds', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 50, y: 30, flow: 0 },
      { id: 2, x: 100, y: 0, flow: -1 },
    ], () => 0.5);
    const before = graph.edges.map((edge) => edge.D);
    const metrics = step(graph, 1.2, 0.05);
    expect(graph.edges.map((edge) => edge.D)).not.toEqual(before);
    expect(graph.edges.every((edge) => Number.isFinite(edge.D) && edge.D >= 0 && edge.D <= 1)).toBe(true);
    expect(metrics.maxChange).toBeGreaterThanOrEqual(0);
    expect(metrics.meanChange).toBeGreaterThanOrEqual(0);
  });
});
