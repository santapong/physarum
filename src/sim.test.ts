import { describe, expect, it } from 'vitest';
import { buildCompleteGraph, buildDelaunayGraph, severEdgeNear } from './graph';
import { computeNetworkMetrics } from './metrics';
import { getPreset } from './presets';
import { createRandom } from './random';
import { D_LIVING_FLOOR, step } from './sim';
import { applyTerrainToGraph, createTerrain, paintTerrainPolygon } from './terrain';

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

  it('remains bounded and stable under semi-implicit step at large dt = 0.5', () => {
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 0, flow: 1 },
      { id: 1, x: 50, y: 40, flow: 0 },
      { id: 2, x: 100, y: 0, flow: -1 },
    ], createRandom(42));
    for (let i = 0; i < 20; i++) {
      const m = step(graph, 1.5, 0.5);
      expect(m.converged).toBe(true);
    }
    expect(graph.edges.every((e) => Number.isFinite(e.D) && e.D >= D_LIVING_FLOOR && e.D <= 1)).toBe(true);
  });

  it('regrows a severed shortcut along an alternative path (self-healing)', () => {
    // Node 0 -> Node 1 (direct 100px) vs detour 0 -> 2 -> 1 (70 + 70 = 140px)
    const graph = buildCompleteGraph([
      { id: 0, x: 0, y: 50, flow: 1 },
      { id: 1, x: 100, y: 50, flow: -1 },
      { id: 2, x: 50, y: 0, flow: 0 },
    ], () => 0.5);
    for (let i = 0; i < 80; i++) step(graph, 1.5, 0.1);
    const directIdx = graph.edges.findIndex((e) => e.i === 0 && e.j === 1);
    const detourEdge = graph.edges.find((e) => e.i === 0 && e.j === 2)!;
    expect(graph.edges[directIdx].D).toBeGreaterThan(0.4);
    expect(detourEdge.D).toBeLessThan(0.15);

    // Cut the direct edge near midpoint (50, 50)
    const severed = severEdgeNear(graph, 50, 50, 10);
    expect(severed).toBe(directIdx);
    expect(graph.edges[directIdx].D).toBe(0);

    for (let i = 0; i < 60; i++) step(graph, 1.5, 0.1);
    expect(detourEdge.D).toBeGreaterThan(0.4);
    expect(graph.edges[directIdx].D).toBe(0);
  });

  it('converges to a connected multi-terminal network on Tokyo Rail preset', () => {
    const preset = getPreset('tokyo-rail');
    const rand = createRandom(preset.seed);
    const graph = buildDelaunayGraph(preset.nodes, rand);
    const terrain = createTerrain();
    for (const poly of preset.terrainPolygons ?? []) paintTerrainPolygon(terrain, poly, 0.9);
    applyTerrainToGraph(graph, terrain);

    for (let i = 0; i < 300; i++) {
      step(graph, preset.mu ?? 1.35, 0.05, {
        flowMode: 'multi-terminal',
        random: rand,
      });
    }
    const metrics = computeNetworkMetrics(graph, 'multi-terminal', 0.05);
    const bayCrossings = graph.edges.filter((e) => e.costFactor > 2 && e.D >= 0.05);
    expect(metrics.connected).toBe(true);
    expect(metrics.activeEdges).toBeGreaterThanOrEqual(preset.nodes.length - 1);
    expect(metrics.tlRatio).toBeGreaterThan(1.1);
    expect(metrics.tlRatio).toBeLessThan(2.3);
    expect(metrics.faultTolerance).toBeGreaterThan(0.5);
    expect(bayCrossings).toHaveLength(0);
  });
});
