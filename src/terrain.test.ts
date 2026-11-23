import { describe, expect, it } from 'vitest';
import { buildCompleteGraph } from './graph';
import {
  applyTerrainToGraph,
  clearTerrain,
  createTerrain,
  paintTerrainDisk,
  paintTerrainPolygon,
  sampleTerrain,
} from './terrain';

describe('terrain field', () => {
  it('increases edge costFactor across painted disk obstacles', () => {
    const field = createTerrain();
    paintTerrainDisk(field, 150, 150, 40, 1);
    expect(sampleTerrain(field, 150, 150)).toBeGreaterThan(0.9);
    expect(sampleTerrain(field, 500, 500)).toBe(0);

    const graph = buildCompleteGraph([
      { id: 0, x: 50, y: 150, flow: 1 },
      { id: 1, x: 250, y: 150, flow: -1 },
      { id: 2, x: 50, y: 450, flow: 0 },
    ], () => 0.5);
    applyTerrainToGraph(graph, field, 4.0);
    const blockedEdge = graph.edges.find((e) => e.i === 0 && e.j === 1)!;
    const clearEdge = graph.edges.find((e) => e.i === 0 && e.j === 2)!;
    expect(blockedEdge.costFactor).toBeGreaterThan(1.5);
    expect(clearEdge.costFactor).toBe(1);

    clearTerrain(field);
    applyTerrainToGraph(graph, field, 4.0);
    expect(blockedEdge.costFactor).toBe(1);
  });

  it('rasterizes polygon masks accurately', () => {
    const field = createTerrain();
    paintTerrainPolygon(field, [
      [300, 200],
      [400, 200],
      [400, 300],
      [300, 300],
    ], 0.9);
    expect(sampleTerrain(field, 350, 250)).toBeCloseTo(0.9, 5);
    expect(sampleTerrain(field, 100, 100)).toBe(0);
  });
});
