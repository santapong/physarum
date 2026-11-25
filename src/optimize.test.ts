import { describe, expect, it } from 'vitest';
import { applyCapacitiesToGraph, buildDelaunayGraph, type Graph } from './graph';
import {
  computeOptimizationMetrics,
  exportSpiceNetlist,
  solveExactMinCostFlow,
} from './optimize';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';

describe('mathematical optimization & analog crossbar', () => {
  it('monotonically decreases Lyapunov energy and finds exact shortest path around obstacle', () => {
    // 0 -> 1 direct length 100, blocked with costFactor=2 (eff 200) vs 0 -> 2 -> 1 (70 + 70 = 140)
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 50, flow: 1, label: 'S' },
        { id: 1, x: 100, y: 50, flow: -1, label: 'T' },
        { id: 2, x: 50, y: 0, flow: 0, label: 'Bypass' },
      ],
      edges: [
        { i: 0, j: 1, length: 100, D: 0.5, costFactor: 2.0, flow: 0 },
        { i: 0, j: 2, length: 70, D: 0.5, costFactor: 1.0, flow: 0 },
        { i: 2, j: 1, length: 70, D: 0.5, costFactor: 1.0, flow: 0 },
      ],
      adj: [[0, 1], [0, 2], [1, 2]],
    };

    const exact = solveExactMinCostFlow(graph);
    expect(exact.feasible).toBe(true);
    expect(exact.optimalCost).toBeCloseTo(140, 6);
    expect(exact.optimalEdgeIndices).toEqual([1, 2]);

    const energies: number[] = [];
    let lastPressures: number[] = [];
    for (let i = 0; i < 350; i++) {
      const m = step(graph, 1.0, 0.05, {
        dynamicsMode: 'linear-lp',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
      const optMetrics = computeOptimizationMetrics(graph, lastPressures, exact);
      energies.push(optMetrics.lyapunovEnergy);
    }

    for (let i = 1; i < energies.length; i++) {
      expect(energies[i]).toBeLessThanOrEqual(energies[i - 1] + 1e-6);
    }

    const finalMetrics = computeOptimizationMetrics(graph, lastPressures, exact);
    expect(finalMetrics.optimalityGapPct).toBeLessThan(1.0);
    expect(finalMetrics.primalFlowCost).toBeCloseTo(140, 0);
  });

  it('solves capacitated min-cost flow via predictive-damped primal-dual LP', () => {
    // 0 -> 1 direct (L=100, cap=0.55) + 0 -> 2 -> 1 (L=70+70=140, uncapacitated)
    // Exact OPT = 0.55*100 + 0.45*140 = 118.0
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 50, flow: 1 },
        { id: 1, x: 100, y: 50, flow: -1 },
        { id: 2, x: 50, y: 0, flow: 0 },
      ],
      edges: [
        { i: 0, j: 1, length: 100, D: 0.5, costFactor: 1.0, flow: 0, capacity: 0.55, congestion: 0 },
        { i: 0, j: 2, length: 70, D: 0.5, costFactor: 1.0, flow: 0 },
        { i: 2, j: 1, length: 70, D: 0.5, costFactor: 1.0, flow: 0 },
      ],
      adj: [[0, 1], [0, 2], [1, 2]],
    };

    const exact = solveExactMinCostFlow(graph);
    expect(exact.feasible).toBe(true);
    expect(exact.optimalCost).toBeCloseTo(118, 6);

    let lastPressures: number[] = [];
    for (let i = 0; i < 600; i++) {
      const m = step(graph, 1.0, 0.05, {
        dynamicsMode: 'linear-lp',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    const finalMetrics = computeOptimizationMetrics(graph, lastPressures, exact);
    expect(Math.abs(finalMetrics.primalFlowCost - 118)).toBeLessThan(0.5);
    expect(finalMetrics.maxCapacityViolation).toBeLessThan(0.015);
    expect(graph.edges[0].congestion).toBeGreaterThan(0.2);
  });

  it('exports a valid SPICE netlist with grounded node, current sources, and OFF resistors', () => {
    const graph: Graph = {
      nodes: [
        { id: 0, x: 0, y: 0, flow: 1, label: 'In' },
        { id: 1, x: 50, y: 0, flow: 0 },
        { id: 2, x: 100, y: 0, flow: -1, label: 'Out' },
      ],
      edges: [
        { i: 0, j: 1, length: 50, D: 0.9, costFactor: 1, flow: 1 },
        { i: 1, j: 2, length: 50, D: 0.002, costFactor: 1, flow: 0 },
      ],
      adj: [[0], [0, 1], [1]],
    };

    const spice = exportSpiceNetlist(graph, [0, -55, -100], { seed: 42, iteration: 100 });
    expect(spice).toContain('V_GND n0 0 DC 0');
    expect(spice).toContain('I_node_0 0 n0 DC 1.000000 ; In');
    expect(spice).toContain('I_node_2 0 n2 DC -1.000000 ; Out');
    expect(spice).toContain('R_0 n0 n1');
    expect(spice).toContain('1.000000e+09 ; OFF / pruned');
    expect(spice).toContain('.op');
    expect(spice).toContain('.end');
  });

  it('converges within 2% of exact OPT on opt-mincost-flow preset', () => {
    const preset = getPreset('opt-mincost-flow');
    const rand = createRandom(preset.seed);
    const graph = buildDelaunayGraph(preset.nodes, rand);
    applyCapacitiesToGraph(graph, preset.capacities);

    const exact = solveExactMinCostFlow(graph);
    expect(exact.feasible).toBe(true);

    let lastPressures: number[] = [];
    for (let i = 0; i < 650; i++) {
      const m = step(graph, preset.mu ?? 1.0, 0.05, {
        dynamicsMode: 'linear-lp',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    const metrics = computeOptimizationMetrics(graph, lastPressures, exact);
    expect(metrics.optimalityGapPct).toBeLessThan(2.0);
    expect(metrics.maxCapacityViolation).toBeLessThan(0.02);
  });
});
