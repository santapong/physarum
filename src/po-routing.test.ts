import { describe, expect, it } from 'vitest';
import { exportFjspCpSatPython, getJewelryJobsForPreset, solveTwoLevelFjsp } from './fjsp';
import { buildExplicitGraph } from './graph';
import { editableRoute, scheduledRoute } from './po-routing';
import { getPreset } from './presets';
import { createRandom } from './random';
import { decodeState, encodeState, type SharedStateV3 } from './state';

const preset = getPreset('fjsp-jewelry-100po');
const fixture = getJewelryJobsForPreset(preset.id);
const plating = fixture.flatMap(job => job.ops).find(op => op.stage === 'plate')!;
const shared: SharedStateV3 = {
  version: 3, domain: 'fjsp', dynamicsMode: 'linear-lp', flowMode: 'source-sink',
  nodes: preset.nodes, mode: 'explicit', mu: 1, dt: 0.05, speed: 8, seed: preset.seed,
  presetId: preset.id,
};

describe('per-order operation times and optional plating', () => {
  it('round-trips a route change and uses the selected cell times in both plans and CP-SAT export', () => {
    const plated = fixture.find(j => j.id === 'FG-F01')!;
    const bare = fixture.find(j => j.id === 'FG-F04')!;
    const stock = fixture.find(j => j.id === 'SG-01')!;
    const restored = decodeState(encodeState({ ...shared, fjspShiftCap: true, poEdits: [
      { jobId: plated.id, stage: 'plate', durations: {}, includePlating: false },
      { jobId: bare.id, stage: 'plate', durations: { 'plate-1': 32, 'plate-2': 17 }, includePlating: true },
      { jobId: bare.id, stage: 'qc', durations: { 'qc-1': 23 } },
      { jobId: stock.id, stage: 'plate', durations: {}, includePlating: true },
    ] }));
    if (restored?.version !== 3) throw new Error('Missing shared FJSP state');
    expect(restored.fjspShiftCap).toBe(true);
    const jobs = [plated, bare, stock].map(job => ({
      ...job, ops: scheduledRoute(editableRoute(job, plating, restored.poEdits!)),
    }));
    expect(jobs[0].ops.some(op => op.stage === 'plate')).toBe(false);
    expect(jobs[1].ops.slice(-2).map(op => op.stage)).toEqual(['plate', 'qc']);
    expect(jobs[2].ops).toEqual(stock.ops);
    expect(bare.ops.some(op => op.stage === 'plate')).toBe(false);

    const graph = buildExplicitGraph(preset.nodes, preset.explicitEdges!, createRandom(preset.seed));
    const cmp = solveTwoLevelFjsp(graph, jobs, { shiftMinPerDay: 560 });
    for (const plan of [cmp.twoLevel, cmp.greedyBaseline]) {
      expect(plan.verification.valid).toBe(true);
      const baths = plan.ops.filter(op => op.stage === 'plate');
      expect(baths).toHaveLength(1);
      expect(baths[0].jobId).toBe(bare.id);
      expect(baths[0].durMin).toBe(baths[0].cellId === 'plate-1' ? 32 : 17);
      expect(plan.ops.find(op => op.jobId === bare.id && op.stage === 'qc')?.durMin).toBe(23);
    }
    const python = exportFjspCpSatPython(graph, jobs, cmp, { seed: preset.seed, iteration: 0 });
    const exported = JSON.parse(python.match(/JOBS = json\.loads\(r'''([\s\S]*?)'''\)/)![1]);
    expect(exported[0].ops.some((op: { stage: string }) => op.stage === 'plate')).toBe(false);
    expect(exported[1].ops.slice(-2)).toEqual(jobs[1].ops.slice(-2));
  });

  it('ignores invalid shared times and ineligible cells, and keeps old links at preset times', () => {
    const job = fixture[0];
    const dirty: SharedStateV3 = { ...shared, poEdits: [
      { jobId: job.id, stage: 'wax', durations: { 'wax-1': -1, 'wax-2': 1.5, 'plate-1': 10 } },
    ] };
    for (const state of [shared, dirty]) {
      const restored = decodeState(encodeState(state));
      if (restored?.version !== 3) throw new Error('Missing shared FJSP state');
      expect(scheduledRoute(editableRoute(job, plating, restored.poEdits ?? []))).toEqual(job.ops);
    }
  });

  it('allows an unplated finish through QC when both baths are offline', () => {
    const graph = buildExplicitGraph(preset.nodes, preset.explicitEdges!, createRandom(preset.seed));
    for (const edge of graph.edges) {
      if (edge.cellId === 'plate-1' || edge.cellId === 'plate-2') edge.severed = true;
    }
    const job = fixture.find(j => j.id === 'FG-F01')!;
    expect(solveTwoLevelFjsp(graph, [job]).twoLevel.feasible).toBe(false);
    const ops = scheduledRoute(editableRoute(job, plating, [
      { jobId: job.id, stage: 'plate', durations: {}, includePlating: false },
    ]));
    const result = solveTwoLevelFjsp(graph, [{ ...job, ops }]);
    expect(result.twoLevel.verification.valid).toBe(true);
    expect(result.twoLevel.ops.slice(-2).map(op => op.stage)).toEqual(['polish', 'qc']);
  });

  it('uses the bath that fits the shift, or reports infeasibility when both take too long', () => {
    const graph = buildExplicitGraph(preset.nodes, preset.explicitEdges!, createRandom(preset.seed));
    const job = { ...fixture[0], ops: [
      { stage: 'plate', durations: { 'plate-1': 561, 'plate-2': 560 } },
    ] };
    const solve = (shiftMinPerDay: number) => solveTwoLevelFjsp(graph, [job], { shiftMinPerDay });
    const fits = solve(560);
    for (const plan of [fits.twoLevel, fits.greedyBaseline]) {
      expect(plan.verification.valid).toBe(true);
      expect(plan.ops[0]).toMatchObject({ cellId: 'plate-2', durMin: 560 });
    }
    job.ops[0].durations['plate-2'] = 562;
    expect(solve(560).twoLevel.infeasibleReason).toContain('560-minute shift');
    expect(solve(0).twoLevel.verification.valid).toBe(true);
  });
});
