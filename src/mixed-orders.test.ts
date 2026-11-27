import { describe, expect, it } from 'vitest';
import {
  exportFjspCpSatPython, getJewelryJobsForPreset, solveTwoLevelFjsp, verifyFjspSchedule, type JewelryJobSpec,
} from './fjsp';
import { buildExplicitGraph } from './graph';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';

const preset = getPreset('fjsp-jewelry-300po');
const factory = () => buildExplicitGraph(preset.nodes, preset.explicitEdges!, createRandom(preset.seed));

describe('300-PO mixed jewelry routes', () => {
  it('schedules each model route and the PO-specific minutes on both plans', () => {
    const jobs = getJewelryJobsForPreset(preset.id);
    expect(jobs).toHaveLength(300);
    expect(new Set(jobs.map(job => job.id)).size).toBe(300);
    expect(jobs).toEqual(getJewelryJobsForPreset(preset.id));
    expect(new Set(jobs.map(job => job.ops.map(op => op.stage).join('/'))).size).toBe(6);
    expect(jobs.filter(job => job.ops.map(op => op.stage).join('/') === 'file/polish/qc')).toHaveLength(50);
    expect(jobs[0].modelType).toBe(jobs[1].modelType);
    expect(jobs[0].alloy).toBe(jobs[1].alloy);
    const graph = factory();
    let prevPressures: number[] = [];
    for (let i = 0; i < 240; i++) {
      prevPressures = step(graph, 1, 0.05, { dynamicsMode: 'linear-lp', prevPressures }).pressures;
    }

    const cmp = solveTwoLevelFjsp(graph, jobs);
    for (const plan of [cmp.twoLevel, cmp.greedyBaseline]) {
      expect(plan.verification.valid).toBe(true);
      expect(plan.ops).toHaveLength(1350);
      expect(plan.totalPos).toBe(300);
      expect(plan.ops.filter(op => op.stage === 'plate')).toHaveLength(150);
      expect(plan.ops.filter(op => op.jobId === jobs[0].id).map(op => op.stage)).toEqual(['file', 'polish', 'qc']);
      for (const [i, minutes] of [5, 2].entries()) {
        const filing = plan.ops.find(op => op.jobId === jobs[i].id && op.stage === 'file')!;
        expect(filing.endMin - filing.startMin).toBe(minutes);
        expect(jobs[i].ops[0].durations['file-1']).toBe(minutes);
      }
    }
    expect(cmp.waxMolds?.map(m => [m.id, m.cavities, m.pieces, m.requiredShots, m.remainingShots])).toEqual([
      ['Solitaire', 2, 150, 90, 100], ['Halo', 1, 150, 150, 150], ['Mounting', 4, 150, 60, 65],
    ]);
  }, 20000);

  it('finishes all 300 orders on 90 primary and 60 spare Halo shots, and rejects one shot short', () => {
    const jobs = getJewelryJobsForPreset('fjsp-jewelry-300po-halo-spare');
    const haloJobs = jobs.filter(job => job.modelType === 'Pavé halo');
    expect(haloJobs).toHaveLength(50);
    const graph = factory();
    let prevPressures: number[] = [];
    for (let i = 0; i < 240; i++) {
      prevPressures = step(graph, 1, 0.05, { dynamicsMode: 'linear-lp', prevPressures }).pressures;
    }
    const cmp = solveTwoLevelFjsp(graph, jobs, { shiftMinPerDay: 560 });
    for (const plan of [cmp.twoLevel, cmp.greedyBaseline]) {
      expect(plan.verification.valid).toBe(true);
      expect(plan.ops).toHaveLength(1350);
      expect(new Set(plan.ops.map(op => op.jobId)).size).toBe(300);
      expect(haloJobs.every(job => plan.ops.some(op => op.jobId === job.id && op.stage === 'qc'))).toBe(true);
      const wax = plan.ops.filter(op => op.moldDraws?.some(draw => draw.moldId.startsWith('Halo')))
        .sort((a, b) => a.startMin - b.startMin);
      expect(wax).toHaveLength(50);
      const shots = wax.flatMap(op => op.moldDraws!.flatMap(draw => Array<string>(draw.shots).fill(draw.moldId)));
      expect(shots).toEqual([...Array(90).fill('Halo'), ...Array(60).fill('Halo spare')]);
      expect(plan.waxMolds?.filter(row => row.id.startsWith('Halo')).map(row => row.remainingShots - row.requiredShots)).toEqual([0, 0]);
    }
    for (const job of haloJobs) job.ops[0].waxMold!.spare!.remainingShots = 59;
    const short = solveTwoLevelFjsp(graph, jobs, { shiftMinPerDay: 560 });
    expect(short.twoLevel.infeasibleReason).toContain('Halo spare needs 60 shots, only 59 remain');
    expect(short.greedyBaseline.feasible).toBe(false);
    for (const job of haloJobs) delete job.ops[0].waxMold!.spare;
    expect(solveTwoLevelFjsp(graph, jobs).twoLevel.infeasibleReason).toContain('Halo needs 150 shots, only 90 remain');
  }, 20000);

  it('changes tools at a shot boundary inside a lot and detects a premature handoff', () => {
    const job: JewelryJobSpec = { id: 'H', name: 'Halo', alloy: '925', releaseMin: 0, ops: [{
      stage: 'wax', durations: { 'wax-1': 12 },
      waxMold: { id: 'H1', pieces: 5, cavities: 2, remainingShots: 1,
        spare: { id: 'H2', remainingShots: 2 } },
    }] };
    const plan = solveTwoLevelFjsp(factory(), [job]).twoLevel;
    expect(plan.verification.valid).toBe(true);
    expect(plan.ops[0].moldDraws).toEqual([
      { moldId: 'H1', shots: 1, pieces: 2 }, { moldId: 'H2', shots: 2, pieces: 3 },
    ]);
    const wrong = { ...plan.ops[0], moldDraws: [{ moldId: 'H2', shots: 3, pieces: 5 }] };
    expect(verifyFjspSchedule([job], [wrong], new Set()).valid).toBe(false);
  });

  it('reserves a shared mold across different stations and rejects a one-shot shortage', () => {
    const graph = factory();
    const makeJob = (id: string, cell: string, remainingShots: number): JewelryJobSpec => ({
      id, name: id, alloy: '925', releaseMin: 0, ops: [{
        stage: 'wax', durations: { [cell]: 10 },
        waxMold: { id: 'Band', cavities: 2, pieces: 3, remainingShots },
      }],
    });
    const jobs = [makeJob('A', 'wax-1', 4), makeJob('B', 'wax-2', 4)];
    const cmp = solveTwoLevelFjsp(graph, jobs);
    for (const plan of [cmp.greedyBaseline, cmp.twoLevel]) {
      expect(plan.verification.valid).toBe(true);
      expect(plan.makespanMin).toBe(20);
      expect(plan.ops[1].startMin).toBe(plan.ops[0].endMin);
    }
    const collision = cmp.twoLevel.ops.map(op => ({ ...op, startMin: 0, endMin: 10 }));
    expect(verifyFjspSchedule(jobs, collision, new Set()).errors).toContain('Overlap on wax mold Band between A and B');
    const py = exportFjspCpSatPython(graph, jobs, cmp, { seed: 5105, iteration: 0 });
    expect(py).toContain('mold_intervals.setdefault(mid');
    expect(py).toContain('model.AddNoOverlap(intervals)');
    expect(py).toContain('model.Add(mold_shots[mid] <= mold_limits[mid][1])');
    const shortage = solveTwoLevelFjsp(graph, [makeJob('A', 'wax-1', 3), makeJob('B', 'wax-2', 3)]);
    expect(shortage.greedyBaseline.feasible).toBe(false);
    expect(shortage.twoLevel.infeasibleReason).toMatch(/needs 4 shots, only 3 remain/);
  });
});
