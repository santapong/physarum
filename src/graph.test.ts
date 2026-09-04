import { describe, expect, it } from 'vitest';
import { buildCompleteGraph, buildDelaunayGraph, hasSourceAndSink, type Node } from './graph';
import { createRandom } from './random';

const nodes: Node[] = [
  { id: 0, x: 0, y: 0, flow: 1 },
  { id: 1, x: 100, y: 0, flow: 0 },
  { id: 2, x: 100, y: 100, flow: -1 },
  { id: 3, x: 0, y: 100, flow: 0 },
];

describe('graph builders', () => {
  it('builds every complete-graph edge with deterministic conductivities', () => {
    const graph = buildCompleteGraph(nodes, createRandom(99));
    const repeated = buildCompleteGraph(nodes, createRandom(99));
    expect(graph.edges).toHaveLength(6);
    expect(graph.edges.map((edge) => edge.D)).toEqual(repeated.edges.map((edge) => edge.D));
    expect(graph.adj.every((edges) => edges.length === 3)).toBe(true);
    expect(hasSourceAndSink(graph)).toBe(true);
  });

  it('builds a valid Delaunay substrate without duplicate edges', () => {
    const graph = buildDelaunayGraph(nodes, createRandom(4));
    const keys = graph.edges.map((edge) => `${edge.i}_${edge.j}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(graph.edges.length).toBeGreaterThanOrEqual(4);
    expect(graph.edges.every((edge) => edge.i < edge.j && edge.length > 0)).toBe(true);
  });

  it('falls back to a connected chain for collinear nodes', () => {
    const line = nodes.map((node, index) => ({ ...node, x: index * 10, y: 20 }));
    const graph = buildDelaunayGraph(line, createRandom(1));
    expect(graph.edges.length).toBeGreaterThanOrEqual(line.length - 1);
    expect(graph.adj.every((edges) => edges.length > 0)).toBe(true);
  });
});
