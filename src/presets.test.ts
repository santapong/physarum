import { describe, expect, it } from 'vitest';
import {
  applyCapacitiesToGraph,
  buildCompleteGraph,
  buildDelaunayGraph,
  buildExplicitGraph,
  hasActiveTerminals,
} from './graph';
import { PRESETS } from './presets';
import { createRandom } from './random';

describe('presets', () => {
  it('provides twenty-six valid, runnable scenarios across all six lab domains', () => {
    expect(PRESETS).toHaveLength(26);
    const domains = new Set(PRESETS.map((p) => p.domain));
    expect(domains).toEqual(new Set(['transport', 'vascular', 'optimization', 'fjsp', 'graphrag', 'systems']));

    for (const preset of PRESETS) {
      expect(new Set(preset.nodes.map((node) => node.id)).size).toBe(preset.nodes.length);
      expect(preset.nodes.every((node) => node.x >= 0 && node.x <= 900 && node.y >= 0 && node.y <= 600)).toBe(true);
      const random = createRandom(preset.seed);
      const graph = preset.mode === 'explicit'
        ? buildExplicitGraph(preset.nodes, preset.explicitEdges ?? [], random)
        : preset.mode === 'delaunay'
          ? buildDelaunayGraph(preset.nodes, random)
          : buildCompleteGraph(preset.nodes, random);
      expect(hasActiveTerminals(graph, preset.flowMode ?? 'source-sink')).toBe(true);
      expect(graph.edges.length).toBeGreaterThan(0);

      if (preset.explicitEdges) {
        expect(graph.edges.length).toBe(preset.explicitEdges.length);
      }

      if (preset.capacities) {
        applyCapacitiesToGraph(graph, preset.capacities);
        const cappedCount = graph.edges.filter((e) => e.capacity !== undefined).length;
        expect(cappedCount).toBe(preset.capacities.length);
      }
    }
  });
});
