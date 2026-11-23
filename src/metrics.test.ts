import { describe, expect, it } from 'vitest';
import type { Graph } from './graph';
import { computeMst, computeNetworkMetrics } from './metrics';

describe('network metrics', () => {
  it('computes Kruskal MST length and detects zero fault tolerance on a tree', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0, flow: 1 },
        { id: 1, x: 30, y: 0, flow: 0 },
        { id: 2, x: 70, y: 0, flow: -1 },
      ],
      edges: [
        { i: 0, j: 1, length: 30, D: 0.8, costFactor: 1, flow: 0.5 },
        { i: 1, j: 2, length: 40, D: 0.8, costFactor: 1, flow: 0.5 },
        { i: 0, j: 2, length: 70, D: 0.01, costFactor: 1, flow: 0 },
      ],
      adj: [[0, 2], [0, 1], [1, 2]],
    };
    const mst = computeMst(graph);
    expect(mst.edgeIndices).toEqual([0, 1]);
    expect(mst.totalLength).toBeCloseTo(70, 6);

    const metrics = computeNetworkMetrics(graph, 'source-sink', 0.05);
    expect(metrics.connected).toBe(true);
    expect(metrics.activeEdges).toBe(2);
    expect(metrics.tlRatio).toBeCloseTo(1, 6);
    expect(metrics.faultTolerance).toBe(0);
  });

  it('reports faultTolerance = 1 on a 3-node redundant cycle', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0, flow: 1 },
        { id: 1, x: 50, y: 0, flow: 1 },
        { id: 2, x: 25, y: 40, flow: 1 },
      ],
      edges: [
        { i: 0, j: 1, length: 50, D: 0.6, costFactor: 1, flow: 0.2 },
        { i: 1, j: 2, length: 47, D: 0.6, costFactor: 1, flow: 0.2 },
        { i: 0, j: 2, length: 47, D: 0.6, costFactor: 1, flow: 0.2 },
      ],
      adj: [[0, 2], [0, 1], [1, 2]],
    };
    const metrics = computeNetworkMetrics(graph, 'multi-terminal', 0.05);
    expect(metrics.connected).toBe(true);
    expect(metrics.faultTolerance).toBeCloseTo(1, 6);
    expect(metrics.efficiencyScore).toBeGreaterThan(0);
  });

  it('reports connected = false when active edges are below threshold', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0, flow: 1 },
        { id: 1, x: 50, y: 0, flow: -1 },
      ],
      edges: [{ i: 0, j: 1, length: 50, D: 0.01, costFactor: 1, flow: 0 }],
      adj: [[0], [0]],
    };
    const metrics = computeNetworkMetrics(graph, 'source-sink', 0.05);
    expect(metrics.connected).toBe(false);
    expect(metrics.faultTolerance).toBe(0);
    expect(metrics.efficiencyScore).toBe(0);
  });
});
