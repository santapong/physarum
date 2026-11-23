import { describe, expect, it } from 'vitest';
import { buildCompleteGraph, buildDelaunayGraph, hasActiveTerminals } from './graph';
import { PRESETS } from './presets';
import { createRandom } from './random';

describe('presets', () => {
  it('provides six valid, runnable scenarios', () => {
    expect(PRESETS).toHaveLength(6);
    for (const preset of PRESETS) {
      expect(new Set(preset.nodes.map((node) => node.id)).size).toBe(preset.nodes.length);
      expect(preset.nodes.every((node) => node.x >= 0 && node.x <= 900 && node.y >= 0 && node.y <= 600)).toBe(true);
      const random = createRandom(preset.seed);
      const graph = preset.mode === 'delaunay'
        ? buildDelaunayGraph(preset.nodes, random)
        : buildCompleteGraph(preset.nodes, random);
      expect(hasActiveTerminals(graph, preset.flowMode ?? 'source-sink')).toBe(true);
      expect(graph.edges.length).toBeGreaterThan(0);
    }
  });
});
