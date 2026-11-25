import { describe, expect, it } from 'vitest';
import { buildDelaunayGraph, type Graph } from './graph';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';
import { applyTerrainToGraph, createTerrain, paintTerrainDisk, paintTerrainPolygon } from './terrain';
import {
  computeVascularMetrics,
  edgeRadiusMm,
  exportVascularOpenScad,
  exportVascularSvg,
} from './vascular';

describe('vascular & microfluidics adaptation', () => {
  it('converges an asymmetric 1-to-3 bifurcation to Murray Law (r_p^3 = sum r_c^3) and uniform shear', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 100, y: 300, flow: 1.0, label: 'Inlet' },
        { id: 1, x: 300, y: 300, flow: 0, label: 'Bifurcation' },
        { id: 2, x: 500, y: 150, flow: -0.5, label: 'Cap A' },
        { id: 3, x: 500, y: 300, flow: -0.3, label: 'Cap B' },
        { id: 4, x: 500, y: 450, flow: -0.2, label: 'Cap C' },
      ],
      edges: [
        { i: 0, j: 1, length: 200, D: 0.5, costFactor: 1, flow: 0 },
        { i: 1, j: 2, length: 250, D: 0.5, costFactor: 1, flow: 0 },
        { i: 1, j: 3, length: 200, D: 0.5, costFactor: 1, flow: 0 },
        { i: 1, j: 4, length: 250, D: 0.5, costFactor: 1, flow: 0 },
      ],
      adj: [[0], [0, 1, 2, 3], [1], [2], [3]],
    };

    let lastPressures: number[] = [];
    for (let i = 0; i < 320; i++) {
      const m = step(graph, 4 / 3, 0.05, {
        dynamicsMode: 'murray',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    const metrics = computeVascularMetrics(graph, lastPressures, { maxRadiusMm: 2.0 });
    expect(metrics.bifurcationCount).toBe(1);
    expect(metrics.murrayRatio).toBeCloseTo(1.0, 2);
    expect(metrics.murrayCompliancePct).toBeGreaterThan(98);
    expect(metrics.shearUniformityCv).toBeLessThan(0.05);
    expect(metrics.hydraulicPower).toBeGreaterThan(0);
    expect(metrics.fluidVolumeMm3).toBeGreaterThan(0);
    expect(edgeRadiusMm(graph.edges[0].D, 2.0)).toBeCloseTo(2.0, 3);
  });

  it('exports valid millimeter-scaled SVG and parametric OpenSCAD CAD files', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 100, y: 300, flow: 1, label: 'In' },
        { id: 1, x: 450, y: 300, flow: 0 },
        { id: 2, x: 800, y: 300, flow: -1, label: 'Out' },
      ],
      edges: [
        { i: 0, j: 1, length: 350, D: 0.9, costFactor: 1, flow: 1 },
        { i: 1, j: 2, length: 350, D: 0.9, costFactor: 1, flow: 1 },
      ],
      adj: [[0], [0, 1], [1]],
    };
    const terrain = createTerrain();
    paintTerrainDisk(terrain, 450, 120, 40, 1);

    const svg = exportVascularSvg(graph, terrain, {
      maxRadiusMm: 1.5,
      seed: 123,
      iteration: 50,
    });
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="60mm"');
    expect(svg).toContain('id="keepout-zones"');
    expect(svg).toContain('id="microfluidic-channels"');
    expect(svg).toContain('data-label="In"');

    const scad = exportVascularOpenScad(graph, {
      maxRadiusMm: 1.5,
      seed: 123,
      iteration: 50,
    });
    expect(scad).toContain('module vascular_channel');
    expect(scad).toContain('difference()');
    expect(scad).toContain('manifold_port(');
  });

  it('forms connected branching scaffold around avascular obstacle on vascular-scaffold preset', () => {
    const preset = getPreset('vascular-scaffold');
    const rand = createRandom(preset.seed);
    const graph = buildDelaunayGraph(preset.nodes, rand);
    const terrain = createTerrain();
    for (const poly of preset.terrainPolygons ?? []) {
      paintTerrainPolygon(terrain, poly, 0.9);
    }
    applyTerrainToGraph(graph, terrain);

    let lastPressures: number[] = [];
    for (let i = 0; i < 240; i++) {
      const m = step(graph, preset.mu ?? 1.33, 0.05, {
        dynamicsMode: 'murray',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    const metrics = computeVascularMetrics(graph, lastPressures, {
      maxRadiusMm: preset.maxRadiusMm ?? 0.6,
    });
    const obstacleCrossings = graph.edges.filter((e) => e.costFactor > 2 && e.D >= 0.05);
    expect(metrics.activeChannels).toBeGreaterThanOrEqual(8);
    expect(metrics.pressureDrop).toBeGreaterThan(0);
    expect(metrics.fluidVolumeMm3).toBeGreaterThan(0);
    expect(obstacleCrossings).toHaveLength(0);
  });
});
