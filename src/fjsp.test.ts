import { describe, expect, it } from 'vitest';
import {
  exportFjspCpSatPython,
  getJewelryJobsForPreset,
  solveTwoLevelFjsp,
} from './fjsp';
import { buildExplicitGraph, severEdgeNear } from './graph';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';

describe('two-level multi-cell jewelry FJSP', () => {
  it('converges upper Physarum flow with positive bottleneck shadow prices and beats Greedy ECT', () => {
    const preset = getPreset('fjsp-jewelry-atelier');
    const rand = createRandom(preset.seed);
    const graph = buildExplicitGraph(preset.nodes, preset.explicitEdges ?? [], rand);
    const jobs = getJewelryJobsForPreset(preset.id);

    let lastPressures: number[] = [];
    for (let i = 0; i < 360; i++) {
      const m = step(graph, preset.mu ?? 1.0, 0.05, {
        dynamicsMode: 'linear-lp',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    // All explicit factory links must maintain forward directed flow (no reversal).
    expect(graph.edges.every((e) => e.flow >= -1e-5)).toBe(true);

    const cmp = solveTwoLevelFjsp(graph, jobs, { physarumWeight: 0.9, refine: true });
    expect(cmp.upperSignals['set-pave'].shadowPriceLambda).toBeGreaterThan(0);
    expect(cmp.upperSignals['cast-18k'].shadowPriceLambda).toBeGreaterThan(0);

    expect(cmp.greedyBaseline.feasible).toBe(true);
    expect(cmp.greedyBaseline.verification.valid).toBe(true);
    expect(cmp.twoLevel.feasible).toBe(true);
    expect(cmp.twoLevel.verification.valid).toBe(true);
    expect(cmp.twoLevel.ops).toHaveLength(70);
    expect(cmp.twoLevel.makespanMin).toBeLessThan(cmp.greedyBaseline.makespanMin);
    expect(cmp.twoLevel.makespanMin).toBeLessThanOrEqual(Math.ceil(cmp.lowerBoundMin * 1.12));
  });

  it('reroutes cleanly around severed cast-18k kiln and detects infeasible sole specialist severing', () => {
    const preset = getPreset('fjsp-jewelry-atelier');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    const jobs = getJewelryJobsForPreset(preset.id);

    for (let i = 0; i < 160; i++) {
      step(graph, 1.0, 0.05, { dynamicsMode: 'linear-lp' });
    }

    // Sever cast-18k edge (nodes 5 <-> 6 at midpoint (252.5, 145))
    const severedCast = severEdgeNear(graph, 252.5, 145, 12);
    expect(severedCast).not.toBeNull();

    for (let i = 0; i < 160; i++) {
      step(graph, 1.0, 0.05, { dynamicsMode: 'linear-lp' });
    }

    const afterCastLoss = solveTwoLevelFjsp(graph, jobs, { physarumWeight: 0.9, refine: true });
    expect(afterCastLoss.offlineCells).toContain('cast-18k');
    expect(afterCastLoss.twoLevel.feasible).toBe(true);
    expect(afterCastLoss.twoLevel.verification.valid).toBe(true);
    expect(afterCastLoss.twoLevel.ops.some((op) => op.cellId === 'cast-18k')).toBe(false);
    expect(afterCastLoss.upperSignals['cast-flex'].loadQ).toBeGreaterThan(0.2);

    // Sever set-pave edge (nodes 15 <-> 16 at midpoint (492.5, 195)) — sole Micro-Pave bench
    const severedPave = severEdgeNear(graph, 492.5, 195, 12);
    expect(severedPave).not.toBeNull();

    const afterPaveLoss = solveTwoLevelFjsp(graph, jobs, { physarumWeight: 0.9, refine: true });
    expect(afterPaveLoss.offlineCells).toContain('set-pave');
    expect(afterPaveLoss.twoLevel.feasible).toBe(false);
    expect(afterPaveLoss.twoLevel.infeasibleReason).toContain('offline');
  });

  it('exports a valid OR-Tools CP-SAT Python model with warm-start hints', () => {
    const preset = getPreset('fjsp-jewelry-rush');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    const jobs = getJewelryJobsForPreset(preset.id);
    for (let i = 0; i < 120; i++) {
      step(graph, 1.0, 0.05, { dynamicsMode: 'linear-lp' });
    }
    const cmp = solveTwoLevelFjsp(graph, jobs);
    expect(cmp.twoLevel.feasible).toBe(true);
    expect(cmp.twoLevel.verification.valid).toBe(true);

    const py = exportFjspCpSatPython(graph, jobs, cmp, { seed: preset.seed, iteration: 120 });
    expect(py).toContain('cp_model.CpModel()');
    expect(py).toContain('NewOptionalIntervalVar');
    expect(py).toContain('AddNoOverlap');
    expect(py).toContain('AddHint');
    expect(py).toContain('json.loads');
  });

  it('schedules 100 heterogeneous FG + SG POs with BOM links, due dates, and lower tardiness', () => {
    const preset = getPreset('fjsp-jewelry-100po');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    const jobs = getJewelryJobsForPreset(preset.id);
    expect(jobs).toHaveLength(100);

    let lastPressures: number[] = [];
    for (let i = 0; i < 240; i++) {
      const m = step(graph, preset.mu ?? 1.0, 0.05, {
        dynamicsMode: 'linear-lp',
        prevPressures: lastPressures,
      });
      lastPressures = m.pressures;
    }

    // All cell edges maintain forward flow (no backward routing across physical benches).
    const cellEdges = graph.edges.filter((e) => Boolean(e.cellId));
    expect(cellEdges.every((e) => e.flow >= -1e-5)).toBe(true);

    const cmp = solveTwoLevelFjsp(graph, jobs, { physarumWeight: 0.9, refine: true });
    expect(cmp.greedyBaseline.feasible).toBe(true);
    expect(cmp.twoLevel.feasible).toBe(true);
    expect(cmp.twoLevel.verification.valid).toBe(true);
    expect(cmp.twoLevel.verification.bomViolations).toBe(0);
    expect(cmp.twoLevel.verification.overlapCount).toBe(0);
    expect(cmp.twoLevel.totalPos).toBe(100);
    expect(cmp.twoLevel.makespanMin).toBeLessThan(cmp.greedyBaseline.makespanMin);
    expect(cmp.twoLevel.weightedTardinessMin).toBeLessThan(cmp.greedyBaseline.weightedTardinessMin);

    const py = exportFjspCpSatPython(graph, jobs, cmp, { seed: preset.seed, iteration: 240 });
    expect(py).toContain('dependsOnJobId');
    expect(py).toContain('tardiness_terms');
  });

  it('keeps Lower-Layer makespan drift-free under high Physarum congestion windup', () => {
    const preset = getPreset('fjsp-jewelry-atelier');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    const jobs = getJewelryJobsForPreset(preset.id);
    for (let i = 0; i < 160; i++) {
      step(graph, 1.0, 0.05, { dynamicsMode: 'linear-lp' });
    }
    const paveEdge = graph.edges.find((e) => e.cellId === 'set-pave')!;
    paveEdge.congestion = 10.0;

    const cmp = solveTwoLevelFjsp(graph, jobs, { physarumWeight: 0.9, refine: true });
    expect(cmp.twoLevel.feasible).toBe(true);
    expect(cmp.twoLevel.verification.valid).toBe(true);
    expect(cmp.twoLevel.makespanMin).toBeLessThan(cmp.greedyBaseline.makespanMin);
  });
});
