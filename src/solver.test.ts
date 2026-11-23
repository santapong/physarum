import { describe, expect, it } from 'vitest';
import { buildCompleteGraph, type Graph } from './graph';
import { solvePressures, solvePressuresDetailed } from './solver';

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

  it('converges cleanly on stiff conductivities (1e6 contrast)', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 50, y: 0, flow: 0 },
      { id: 2, x: 50, y: 40, flow: 0 },
      { id: 3, x: 100, y: 0, flow: -1 },
    ], () => 0.5);
    graph.edges[0].D = 1.0;
    graph.edges[1].D = 1e-6;
    graph.edges[2].D = 1e-6;
    graph.edges[3].D = 1e-5;
    const res = solvePressuresDetailed(graph);
    expect(res.converged).toBe(true);
    expect(res.residual).toBeLessThan(1e-6);
    expect(res.pressures.every(Number.isFinite)).toBe(true);
  });

  it('handles disconnected node 0 without singular NaN', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0, flow: 0 },
        { id: 1, x: 20, y: 0, flow: 1 },
        { id: 2, x: 40, y: 0, flow: -1 },
      ],
      edges: [
        { i: 0, j: 1, length: 20, D: 0, costFactor: 1, flow: 0, severed: true },
        { i: 1, j: 2, length: 20, D: 0.5, costFactor: 1, flow: 0, severed: false },
      ],
      adj: [[0], [0, 1], [1]],
    };
    const res = solvePressuresDetailed(graph);
    expect(res.converged).toBe(true);
    expect(res.pressures[0]).toBe(0);
    expect(res.pressures[1]).toBe(0);
    expect(res.pressures[2]).toBeCloseTo(-40, 5);
  });

  it('reduces CG iterations when warm-started', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 30, y: 20, flow: 0 },
      { id: 2, x: 60, y: -15, flow: 0 },
      { id: 3, x: 90, y: 10, flow: 0 },
      { id: 4, x: 120, y: 0, flow: -1 },
    ], () => 0.5);
    const cold = solvePressuresDetailed(graph);
    const warm = solvePressuresDetailed(graph, undefined, cold.pressures);
    expect(warm.iterations).toBeLessThanOrEqual(cold.iterations);
    expect(warm.iterations).toBeLessThanOrEqual(1);
  });
});
