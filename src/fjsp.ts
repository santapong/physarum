import { getOfflineCellIds, type Graph } from './graph';
import { createRandom } from './random';

export type AlloyType = '18K-Y' | '18K-R' | '925' | 'PT950';
export type PoKind = 'FG-FULL' | 'FG-FROM-SG' | 'SG-STOCK';

export interface CellSpec {
  id: string;
  label: string;
  stage: string;
  zone: number;
  hasAlloySetup: boolean;
  setupMin: number;
}

export interface JewelryOpSpec {
  stage: string;
  durations: Record<string, number>;
  reentrant?: boolean;
}

export interface JewelryJobSpec {
  id: string;
  name: string;
  alloy: AlloyType;
  releaseMin: number;
  ops: JewelryOpSpec[];
  poType?: PoKind;
  modelType?: string;
  dueMin?: number;
  priority?: number;
  dependsOnJobId?: string;
  soId?: string;
  sgSku?: string;
  producesSgQty?: number;
  consumesSgQty?: number;
  materialReadyMin?: number;
  materialBom?: Record<string, number>;
}

export interface UpperCellSignal {
  cellId: string;
  loadQ: number;
  conductivityD: number;
  shadowPriceLambda: number;
  capacity: number;
  offline: boolean;
}

export interface ScheduledOp {
  jobId: string;
  jobName: string;
  opIndex: number;
  stage: string;
  alloy: AlloyType;
  cellId: string;
  startMin: number;
  endMin: number;
  durMin: number;
  setupMin: number;
  transferMin: number;
  reentrant: boolean;
}

export interface ScheduleVerification {
  valid: boolean;
  missingOps: number;
  overlapCount: number;
  precedenceViolations: number;
  bomViolations: number;
  skillViolations: number;
  offlineViolations: number;
  setupViolations: number;
  shiftViolations: number;
  materialViolations: number;
  errors: string[];
}

export interface FjspSolution {
  feasible: boolean;
  infeasibleReason?: string;
  shiftMinPerDay: number;
  makespanMin: number;
  totalFlowTimeMin: number;
  totalSetupMin: number;
  totalTransferMin: number;
  totalPos: number;
  onTimePos: number;
  latePos: number;
  totalTardinessMin: number;
  weightedTardinessMin: number;
  lateJobIds: string[];
  ops: ScheduledOp[];
  verification: ScheduleVerification;
}

export interface TwoLevelComparison {
  upperSignals: Record<string, UpperCellSignal>;
  offlineCells: string[];
  bottleneckCellId: string;
  lowerBoundMin: number;
  greedyBaseline: FjspSolution;
  twoLevel: FjspSolution;
  makespanDeltaMin: number;
  makespanImprovementPct: number;
  setupSavedMin: number;
  tardinessSavedMin: number;
  weightedTardinessSavedMin: number;
}

export const INTER_ZONE_TRANSFER_MIN = 10;
export const SHIFT_MIN_PER_DAY = 560;

export const JEWELRY_CELLS: CellSpec[] = [
  { id: 'wax-1', label: 'Wax CAD 1', stage: 'Wax', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'wax-2', label: 'Wax CAD 2', stage: 'Wax', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'cast-18k', label: 'Cast 18K Kiln', stage: 'Casting', zone: 0, hasAlloySetup: true, setupMin: 25 },
  { id: 'cast-flex', label: 'Cast Flex Kiln', stage: 'Casting', zone: 1, hasAlloySetup: true, setupMin: 25 },
  { id: 'cast-925', label: 'Cast 925 Kiln', stage: 'Casting', zone: 2, hasAlloySetup: true, setupMin: 25 },
  { id: 'file-1', label: 'Filing Bench 1', stage: 'Filing', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'file-2', label: 'Filing Bench 2', stage: 'Filing', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'set-pave', label: 'Micro-Pavé Bench', stage: 'Setting', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'set-prong', label: 'Prong & Bezel', stage: 'Setting', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'polish-a', label: 'Polish Cell A', stage: 'Polish', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'polish-b', label: 'Polish Cell B', stage: 'Polish', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'plate-1', label: 'Plating Bath 1', stage: 'Plating', zone: 0, hasAlloySetup: true, setupMin: 10 },
  { id: 'plate-2', label: 'Plating Bath 2', stage: 'Plating', zone: 1, hasAlloySetup: true, setupMin: 10 },
  { id: 'qc-1', label: 'Metrology & QC', stage: 'QC', zone: 0, hasAlloySetup: false, setupMin: 0 },
];

export const JEWELRY_ERP_CELLS: CellSpec[] = [
  { id: 'wax-1', label: 'Wax CAD 1', stage: 'Wax', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'wax-2', label: 'Wax CAD 2', stage: 'Wax', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'cast-18k', label: 'Cast 18K Kiln', stage: 'Casting', zone: 0, hasAlloySetup: true, setupMin: 25 },
  { id: 'cast-flex', label: 'Cast Flex Kiln', stage: 'Casting', zone: 1, hasAlloySetup: true, setupMin: 25 },
  { id: 'cast-925', label: 'Cast 925 Kiln', stage: 'Casting', zone: 2, hasAlloySetup: true, setupMin: 25 },
  { id: 'file-1', label: 'Filing Bench 1', stage: 'Filing', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'file-2', label: 'Filing Bench 2', stage: 'Filing', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'wh-io', label: 'Warehouse (SG/Kit)', stage: 'Warehouse', zone: 3, hasAlloySetup: false, setupMin: 0 },
  { id: 'asm-1', label: 'Assembly Bench 1', stage: 'Assembly', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'asm-2', label: 'Assembly Bench 2', stage: 'Assembly', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'set-pave', label: 'Micro-Pavé Bench', stage: 'Setting', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'set-prong', label: 'Prong & Bezel', stage: 'Setting', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'polish-a', label: 'Polish Cell A', stage: 'Polish', zone: 0, hasAlloySetup: false, setupMin: 0 },
  { id: 'polish-b', label: 'Polish Cell B', stage: 'Polish', zone: 1, hasAlloySetup: false, setupMin: 0 },
  { id: 'plate-1', label: 'Plating Bath 1', stage: 'Plating', zone: 0, hasAlloySetup: true, setupMin: 10 },
  { id: 'plate-2', label: 'Plating Bath 2', stage: 'Plating', zone: 1, hasAlloySetup: true, setupMin: 10 },
  { id: 'qc-1', label: 'Metrology & QC', stage: 'QC', zone: 0, hasAlloySetup: false, setupMin: 0 },
];

const CELLS_BY_ID = new Map<string, CellSpec>(JEWELRY_ERP_CELLS.map((cell) => [cell.id, cell]));

export function getCellsForPreset(presetId: string): CellSpec[] {
  return presetId === 'fjsp-jewelry-erp' ? JEWELRY_ERP_CELLS : JEWELRY_CELLS;
}

const ATELIER_JOBS: JewelryJobSpec[] = [
  {
    id: 'J1',
    name: '18K Pavé Halo Ring',
    alloy: '18K-Y',
    releaseMin: 25,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 18, 'wax-2': 20 } },
      { stage: 'cast', durations: { 'cast-18k': 42, 'cast-flex': 48 } },
      { stage: 'pre-polish', durations: { 'polish-a': 18, 'polish-b': 22 }, reentrant: true },
      { stage: 'set', durations: { 'set-pave': 60 } },
      { stage: 'polish', durations: { 'polish-a': 26, 'polish-b': 30 }, reentrant: true },
      { stage: 'plate', durations: { 'plate-1': 18, 'plate-2': 20 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J2',
    name: '18K Solitaire Ring',
    alloy: '18K-Y',
    releaseMin: 0,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 16, 'wax-2': 18 } },
      { stage: 'cast', durations: { 'cast-18k': 38, 'cast-flex': 42 } },
      { stage: 'file', durations: { 'file-1': 18, 'file-2': 20 } },
      { stage: 'set', durations: { 'set-pave': 28, 'set-prong': 34 } },
      { stage: 'polish', durations: { 'polish-a': 20, 'polish-b': 24 } },
      { stage: 'plate', durations: { 'plate-1': 15, 'plate-2': 17 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J3',
    name: '18K-R Pavé Bracelet',
    alloy: '18K-R',
    releaseMin: 30,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 22, 'wax-2': 24 } },
      { stage: 'cast', durations: { 'cast-18k': 48, 'cast-flex': 50 } },
      { stage: 'pre-polish', durations: { 'polish-a': 22, 'polish-b': 26 }, reentrant: true },
      { stage: 'set', durations: { 'set-pave': 65 } },
      { stage: 'polish', durations: { 'polish-a': 30, 'polish-b': 34 }, reentrant: true },
      { stage: 'plate', durations: { 'plate-1': 20, 'plate-2': 22 } },
      { stage: 'qc', durations: { 'qc-1': 12 } },
    ],
  },
  {
    id: 'J4',
    name: '18K-Y Eternity Band',
    alloy: '18K-Y',
    releaseMin: 0,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 16, 'wax-2': 18 } },
      { stage: 'cast', durations: { 'cast-18k': 40, 'cast-flex': 44 } },
      { stage: 'file', durations: { 'file-1': 18, 'file-2': 20 } },
      { stage: 'set', durations: { 'set-pave': 30, 'set-prong': 36 } },
      { stage: 'polish', durations: { 'polish-a': 22, 'polish-b': 25 } },
      { stage: 'plate', durations: { 'plate-1': 16, 'plate-2': 18 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J5',
    name: '925 Signet Ring',
    alloy: '925',
    releaseMin: 0,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 15, 'wax-2': 14 } },
      { stage: 'cast', durations: { 'cast-925': 34, 'cast-flex': 38 } },
      { stage: 'file', durations: { 'file-1': 18, 'file-2': 16 } },
      { stage: 'set', durations: { 'set-pave': 24, 'set-prong': 28 } },
      { stage: 'polish', durations: { 'polish-a': 18, 'polish-b': 20 } },
      { stage: 'plate', durations: { 'plate-1': 14, 'plate-2': 14 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J6',
    name: '18K-R Micro-Pavé Studs',
    alloy: '18K-R',
    releaseMin: 35,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 18, 'wax-2': 20 } },
      { stage: 'cast', durations: { 'cast-18k': 44, 'cast-flex': 46 } },
      { stage: 'pre-polish', durations: { 'polish-a': 20, 'polish-b': 24 }, reentrant: true },
      { stage: 'set', durations: { 'set-pave': 58 } },
      { stage: 'polish', durations: { 'polish-a': 24, 'polish-b': 28 }, reentrant: true },
      { stage: 'plate', durations: { 'plate-1': 18, 'plate-2': 18 } },
      { stage: 'qc', durations: { 'qc-1': 12 } },
    ],
  },
  {
    id: 'J7',
    name: '925 Bezel Pendant',
    alloy: '925',
    releaseMin: 5,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 15, 'wax-2': 15 } },
      { stage: 'cast', durations: { 'cast-925': 35, 'cast-flex': 40 } },
      { stage: 'file', durations: { 'file-1': 18, 'file-2': 18 } },
      { stage: 'set', durations: { 'set-pave': 26, 'set-prong': 30 } },
      { stage: 'polish', durations: { 'polish-a': 20, 'polish-b': 20 } },
      { stage: 'plate', durations: { 'plate-1': 14, 'plate-2': 15 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J8',
    name: '18K-Y Prong Pendant',
    alloy: '18K-Y',
    releaseMin: 10,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 16, 'wax-2': 18 } },
      { stage: 'cast', durations: { 'cast-18k': 38, 'cast-flex': 44 } },
      { stage: 'file', durations: { 'file-1': 18, 'file-2': 20 } },
      { stage: 'set', durations: { 'set-pave': 26, 'set-prong': 32 } },
      { stage: 'polish', durations: { 'polish-a': 20, 'polish-b': 24 } },
      { stage: 'plate', durations: { 'plate-1': 16, 'plate-2': 18 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
  {
    id: 'J9',
    name: '18K-R Cocktail Ring',
    alloy: '18K-R',
    releaseMin: 40,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 20, 'wax-2': 22 } },
      { stage: 'cast', durations: { 'cast-18k': 46, 'cast-flex': 48 } },
      { stage: 'pre-polish', durations: { 'polish-a': 22, 'polish-b': 26 }, reentrant: true },
      { stage: 'set', durations: { 'set-pave': 54 } },
      { stage: 'polish', durations: { 'polish-a': 26, 'polish-b': 30 }, reentrant: true },
      { stage: 'plate', durations: { 'plate-1': 18, 'plate-2': 20 } },
      { stage: 'qc', durations: { 'qc-1': 12 } },
    ],
  },
  {
    id: 'J10',
    name: '925 Chain Clasp',
    alloy: '925',
    releaseMin: 5,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 14, 'wax-2': 14 } },
      { stage: 'cast', durations: { 'cast-925': 32, 'cast-flex': 36 } },
      { stage: 'file', durations: { 'file-1': 16, 'file-2': 16 } },
      { stage: 'set', durations: { 'set-pave': 22, 'set-prong': 26 } },
      { stage: 'polish', durations: { 'polish-a': 18, 'polish-b': 18 } },
      { stage: 'plate', durations: { 'plate-1': 14, 'plate-2': 14 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
];

const RUSH_JOBS: JewelryJobSpec[] = [
  ...ATELIER_JOBS,
  {
    id: 'J11',
    name: 'PT950 Bridal Crown',
    alloy: 'PT950',
    releaseMin: 45,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 20, 'wax-2': 22 } },
      { stage: 'cast', durations: { 'cast-flex': 52, 'cast-18k': 56 } },
      { stage: 'pre-polish', durations: { 'polish-a': 24, 'polish-b': 26 }, reentrant: true },
      { stage: 'set', durations: { 'set-pave': 62 } },
      { stage: 'polish', durations: { 'polish-a': 28, 'polish-b': 32 }, reentrant: true },
      { stage: 'plate', durations: { 'plate-1': 16, 'plate-2': 18 } },
      { stage: 'qc', durations: { 'qc-1': 12 } },
    ],
  },
  {
    id: 'J12',
    name: 'PT950 Cathedral Band',
    alloy: 'PT950',
    releaseMin: 15,
    ops: [
      { stage: 'wax', durations: { 'wax-1': 16, 'wax-2': 18 } },
      { stage: 'cast', durations: { 'cast-flex': 44, 'cast-18k': 48 } },
      { stage: 'file', durations: { 'file-1': 20, 'file-2': 22 } },
      { stage: 'set', durations: { 'set-pave': 28, 'set-prong': 32 } },
      { stage: 'polish', durations: { 'polish-a': 22, 'polish-b': 24 } },
      { stage: 'plate', durations: { 'plate-1': 14, 'plate-2': 16 } },
      { stage: 'qc', durations: { 'qc-1': 10 } },
    ],
  },
];

function build100PoJewelryBatch(): JewelryJobSpec[] {
  const rng = createRandom(5103);
  const pos: JewelryJobSpec[] = [];
  const alloys: AlloyType[] = ['18K-Y', '18K-R', '925', 'PT950'];

  // 1) 25 SG-STOCK POs (semi-finished mountings/shanks: Wax -> Cast -> File)
  for (let k = 1; k <= 25; k++) {
    const alloy = alloys[(k - 1) % 3];
    const castDurations: Record<string, number> =
      alloy === '925'
        ? { 'cast-925': 30, 'cast-flex': 34 }
        : { 'cast-18k': 34, 'cast-flex': 38 };
    const rel = Math.floor(rng() * 180);
    const due = rel + 220 + Math.floor(rng() * 240);
    const pad = String(k).padStart(2, '0');
    pos.push({
      id: `SG-${pad}`,
      name: `SG Mounting ${pad} (${alloy})`,
      alloy,
      poType: 'SG-STOCK',
      modelType: 'SG-Mounting',
      releaseMin: rel,
      dueMin: due,
      priority: 2,
      ops: [
        { stage: 'wax', durations: { 'wax-1': 14, 'wax-2': 15 } },
        { stage: 'cast', durations: castDurations },
        { stage: 'file', durations: { 'file-1': 15, 'file-2': 16 } },
      ],
    });
  }

  // 2) 35 FG-FROM-SG POs (20 BOM-linked to SG-01..SG-20, 15 from on-hand SG inventory)
  for (let k = 1; k <= 35; k++) {
    const depIdx = k <= 20 ? k - 1 : -1;
    const depId = depIdx >= 0 ? pos[depIdx].id : undefined;
    const alloy = depIdx >= 0 ? pos[depIdx].alloy : alloys[k % 4];
    const isPave = k % 3 === 0;
    const isPlain = k % 5 === 0;
    const ops: JewelryOpSpec[] = [];

    if (!isPlain) {
      if (isPave) {
        ops.push({ stage: 'set', durations: { 'set-pave': 38 + Math.floor(rng() * 14) } });
      } else {
        ops.push({ stage: 'set', durations: { 'set-pave': 20, 'set-prong': 24 } });
      }
    }
    ops.push({ stage: 'polish', durations: { 'polish-a': 16, 'polish-b': 18 } });
    if (alloy !== '925' || k % 2 === 0) {
      ops.push({ stage: 'plate', durations: { 'plate-1': 12, 'plate-2': 13 } });
    }
    ops.push({ stage: 'qc', durations: { 'qc-1': 8 } });

    const baseRel = depIdx >= 0 ? pos[depIdx].releaseMin : Math.floor(rng() * 300);
    const prio = k % 4 === 0 ? 3 : 1;
    const due = baseRel + (depId ? 440 : 280) + Math.floor(rng() * 380);
    const pad = String(k).padStart(2, '0');
    pos.push({
      id: `FG-S${pad}`,
      name: `FG-from-SG ${pad} (${isPlain ? 'Band' : isPave ? 'Pavé' : 'Prong'})`,
      alloy,
      poType: 'FG-FROM-SG',
      modelType: isPlain ? 'Band-SG' : isPave ? 'Pavé-SG' : 'Prong-SG',
      dependsOnJobId: depId,
      releaseMin: baseRel,
      dueMin: due,
      priority: prio,
      ops,
    });
  }

  // 3) 40 FG-FULL POs across 4 heterogeneous jewelry model workflows
  for (let k = 1; k <= 40; k++) {
    const alloy = alloys[k % 4];
    const modelKind = k % 4;
    const castDurations: Record<string, number> =
      alloy === '925'
        ? { 'cast-925': 30, 'cast-flex': 34 }
        : alloy === 'PT950'
          ? { 'cast-flex': 40, 'cast-18k': 44 }
          : { 'cast-18k': 36, 'cast-flex': 40 };
    const rel = Math.floor(rng() * 350);
    const ops: JewelryOpSpec[] = [
      { stage: 'wax', durations: { 'wax-1': 15, 'wax-2': 16 } },
      { stage: 'cast', durations: castDurations },
    ];
    let modelType = 'Plain Band';
    if (modelKind === 0) {
      modelType = 'Plain Band';
      ops.push(
        { stage: 'file', durations: { 'file-1': 14, 'file-2': 15 } },
        { stage: 'polish', durations: { 'polish-a': 16, 'polish-b': 18 } },
        { stage: 'qc', durations: { 'qc-1': 7 } },
      );
    } else if (modelKind === 1) {
      modelType = 'Solitaire Ring';
      ops.push(
        { stage: 'file', durations: { 'file-1': 15, 'file-2': 16 } },
        { stage: 'set', durations: { 'set-pave': 22, 'set-prong': 26 } },
        { stage: 'polish', durations: { 'polish-a': 18, 'polish-b': 20 } },
        { stage: 'plate', durations: { 'plate-1': 12, 'plate-2': 13 } },
        { stage: 'qc', durations: { 'qc-1': 8 } },
      );
    } else if (modelKind === 2) {
      modelType = 'Micro-Pavé Halo';
      ops.push(
        { stage: 'pre-polish', durations: { 'polish-a': 16, 'polish-b': 18 }, reentrant: true },
        { stage: 'set', durations: { 'set-pave': 42 + Math.floor(rng() * 12) } },
        { stage: 'polish', durations: { 'polish-a': 20, 'polish-b': 22 }, reentrant: true },
        { stage: 'plate', durations: { 'plate-1': 14, 'plate-2': 15 } },
        { stage: 'qc', durations: { 'qc-1': 9 } },
      );
    } else {
      modelType = 'Bezel Pendant';
      ops.push(
        { stage: 'file', durations: { 'file-1': 16, 'file-2': 16 } },
        { stage: 'set', durations: { 'set-pave': 20, 'set-prong': 24 } },
        { stage: 'polish', durations: { 'polish-a': 16, 'polish-b': 18 } },
        { stage: 'qc', durations: { 'qc-1': 8 } },
      );
    }
    const prio = k % 5 === 0 ? 3 : 1;
    const due = rel + 480 + Math.floor(rng() * 520);
    const pad = String(k).padStart(2, '0');
    pos.push({
      id: `FG-F${pad}`,
      name: `${modelType} ${pad} (${alloy})`,
      alloy,
      poType: 'FG-FULL',
      modelType,
      releaseMin: rel,
      dueMin: due,
      priority: prio,
      ops,
    });
  }

  return pos;
}

export function getJewelryJobsForPreset(presetId: string): JewelryJobSpec[] {
  const source =
    presetId === 'fjsp-jewelry-100po'
      ? build100PoJewelryBatch()
      : presetId === 'fjsp-jewelry-rush'
        ? RUSH_JOBS
        : ATELIER_JOBS;
  return source.map((job) => ({
    ...job,
    ops: job.ops.map((op) => ({
      ...op,
      durations: { ...op.durations },
    })),
  }));
}

export function extractUpperCellSignals(graph: Graph): Record<string, UpperCellSignal> {
  const offlineSet = getOfflineCellIds(graph);
  const grouped = new Map<
    string,
    { loadQ: number; conductivityD: number; shadowPriceLambda: number; capacity: number; count: number }
  >();

  for (const edge of graph.edges) {
    if (!edge.cellId) continue;
    const entry = grouped.get(edge.cellId) ?? {
      loadQ: 0,
      conductivityD: 0,
      shadowPriceLambda: 0,
      capacity: edge.capacity ?? 1,
      count: 0,
    };
    entry.count++;
    if (!edge.severed) {
      entry.loadQ = Math.max(entry.loadQ, Math.abs(edge.flow));
      entry.conductivityD = Math.max(entry.conductivityD, edge.D);
      entry.shadowPriceLambda = Math.max(entry.shadowPriceLambda, edge.congestion ?? 0);
      if (edge.capacity !== undefined && Number.isFinite(edge.capacity)) {
        entry.capacity = edge.capacity;
      }
    }
    grouped.set(edge.cellId, entry);
  }

  const out: Record<string, UpperCellSignal> = {};
  for (const cell of JEWELRY_ERP_CELLS) {
    const agg = grouped.get(cell.id);
    if (!agg) {
      out[cell.id] = {
        cellId: cell.id,
        loadQ: 0,
        conductivityD: 0.5,
        shadowPriceLambda: 0,
        capacity: 1,
        offline: false,
      };
      continue;
    }
    const isOffline = offlineSet.has(cell.id);
    out[cell.id] = {
      cellId: cell.id,
      loadQ: isOffline ? 0 : agg.loadQ,
      conductivityD: isOffline ? 0 : agg.conductivityD,
      shadowPriceLambda: isOffline ? 0 : agg.shadowPriceLambda,
      capacity: agg.capacity,
      offline: isOffline,
    };
  }
  return out;
}

export function verifyFjspSchedule(
  jobs: JewelryJobSpec[],
  ops: ScheduledOp[],
  offlineCells: Set<string>,
  cellsById: Map<string, CellSpec> = CELLS_BY_ID,
  shiftMinPerDay = 0,
): ScheduleVerification {
  const errors: string[] = [];
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const scheduledByKey = new Map<string, ScheduledOp>();
  let missingOps = 0;
  let skillViolations = 0;
  let offlineViolations = 0;
  let precedenceViolations = 0;
  let bomViolations = 0;
  let overlapCount = 0;
  let setupViolations = 0;
  let shiftViolations = 0;
  let materialViolations = 0;

  for (const op of ops) {
    const key = `${op.jobId}#${op.opIndex}`;
    if (scheduledByKey.has(key)) {
      errors.push(`Duplicate op ${key}`);
      missingOps++;
    }
    scheduledByKey.set(key, op);

    const job = jobMap.get(op.jobId);
    const spec = job?.ops[op.opIndex];
    if (!job || !spec) {
      errors.push(`Unknown op ${key}`);
      skillViolations++;
      continue;
    }
    const expectedDur = spec.durations[op.cellId];
    if (expectedDur === undefined || expectedDur !== op.durMin || op.endMin - op.startMin !== op.durMin) {
      errors.push(`Skill or duration mismatch at ${key} on ${op.cellId}`);
      skillViolations++;
    }
    if (offlineCells.has(op.cellId)) {
      errors.push(`Scheduled on offline cell ${op.cellId} at ${key}`);
      offlineViolations++;
    }
    if (shiftMinPerDay > 0) {
      const startDay = Math.floor(op.startMin / shiftMinPerDay);
      const endDay = Math.floor(Math.max(op.startMin, op.endMin - 1) / shiftMinPerDay);
      if (startDay !== endDay) {
        shiftViolations++;
        errors.push(`Shift boundary violation at ${key} (${op.startMin}..${op.endMin})`);
      }
      if (op.setupMin > 0) {
        const setupDay = Math.floor((op.startMin - op.setupMin) / shiftMinPerDay);
        if (setupDay !== startDay) {
          shiftViolations++;
          errors.push(`Setup crosses shift boundary at ${key}`);
        }
      }
    }
  }

  for (const job of jobs) {
    let prevOp: ScheduledOp | null = null;
    for (let idx = 0; idx < job.ops.length; idx++) {
      const op = scheduledByKey.get(`${job.id}#${idx}`);
      if (!op) {
        missingOps++;
        errors.push(`Missing op ${job.id}#${idx}`);
        prevOp = null;
        continue;
      }
      if (idx === 0 && op.startMin < job.releaseMin) {
        precedenceViolations++;
        errors.push(`Release violation on ${job.id}#0`);
      }
      if (idx === 0 && job.materialReadyMin !== undefined && op.startMin < job.materialReadyMin) {
        materialViolations++;
        errors.push(`Material gating violation on ${job.id}#0 (${op.startMin} < ${job.materialReadyMin})`);
      }
      if (idx === 0 && job.dependsOnJobId) {
        const depJob = jobMap.get(job.dependsOnJobId);
        const depLastOp =
          depJob && depJob.ops.length > 0
            ? scheduledByKey.get(`${depJob.id}#${depJob.ops.length - 1}`)
            : undefined;
        if (!depJob || !depLastOp) {
          bomViolations++;
          errors.push(`Missing prerequisite SG job ${job.dependsOnJobId} for ${job.id}`);
        } else if (depLastOp.endMin + INTER_ZONE_TRANSFER_MIN > op.startMin) {
          bomViolations++;
          errors.push(`BOM violation ${job.dependsOnJobId} -> ${job.id}#0`);
        }
      }
      if (prevOp) {
        const prevCell = cellsById.get(prevOp.cellId);
        const currCell = cellsById.get(op.cellId);
        const transfer =
          prevCell && currCell && prevCell.zone !== currCell.zone ? INTER_ZONE_TRANSFER_MIN : 0;
        if (prevOp.endMin + transfer > op.startMin) {
          precedenceViolations++;
          errors.push(`Precedence/transfer violation ${job.id}#${idx - 1}->${idx}`);
        }
      }
      prevOp = op;
    }
  }

  const byCell = new Map<string, ScheduledOp[]>();
  for (const op of ops) {
    const list = byCell.get(op.cellId) ?? [];
    list.push(op);
    byCell.set(op.cellId, list);
  }
  for (const [cellId, cellOps] of byCell.entries()) {
    const cell = cellsById.get(cellId);
    cellOps.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    for (let k = 1; k < cellOps.length; k++) {
      const prev = cellOps[k - 1];
      const curr = cellOps[k];
      if (prev.endMin > curr.startMin) {
        overlapCount++;
        errors.push(`Overlap on ${cellId} between ${prev.jobId}#${prev.opIndex} and ${curr.jobId}#${curr.opIndex}`);
      }
      if (cell?.hasAlloySetup && prev.alloy !== curr.alloy) {
        if (prev.endMin + cell.setupMin > curr.startMin || curr.setupMin < cell.setupMin) {
          setupViolations++;
          errors.push(`Setup violation on ${cellId} between ${prev.jobId} and ${curr.jobId}`);
        }
      }
    }
  }

  const valid =
    missingOps === 0 &&
    overlapCount === 0 &&
    precedenceViolations === 0 &&
    bomViolations === 0 &&
    skillViolations === 0 &&
    offlineViolations === 0 &&
    setupViolations === 0 &&
    shiftViolations === 0 &&
    materialViolations === 0 &&
    errors.length === 0;

  return {
    valid,
    missingOps,
    overlapCount,
    precedenceViolations,
    bomViolations,
    skillViolations,
    offlineViolations,
    setupViolations,
    shiftViolations,
    materialViolations,
    errors,
  };
}

function emptyInvalidSolution(reason: string, totalPos = 0, shiftMinPerDay = 0): FjspSolution {
  return {
    feasible: false,
    infeasibleReason: reason,
    shiftMinPerDay,
    makespanMin: 0,
    totalFlowTimeMin: 0,
    totalSetupMin: 0,
    totalTransferMin: 0,
    totalPos,
    onTimePos: 0,
    latePos: 0,
    totalTardinessMin: 0,
    weightedTardinessMin: 0,
    lateJobIds: [],
    ops: [],
    verification: {
      valid: false,
      missingOps: 0,
      overlapCount: 0,
      precedenceViolations: 0,
      bomViolations: 0,
      skillViolations: 0,
      offlineViolations: 0,
      setupViolations: 0,
      shiftViolations: 0,
      materialViolations: 0,
      errors: [reason],
    },
  };
}

interface CellInterval {
  startMin: number;
  endMin: number;
  alloy: AlloyType;
  opRef: ScheduledOp;
}

function snapToShift(
  candStart: number,
  durMin: number,
  setupBefore: number,
  shiftMinPerDay: number,
): number {
  if (shiftMinPerDay <= 0) return candStart;
  let start = candStart;
  const dayOfSetup = Math.floor((start - setupBefore) / shiftMinPerDay);
  const dayOfStart = Math.floor(start / shiftMinPerDay);
  if (dayOfSetup < dayOfStart) {
    start = dayOfStart * shiftMinPerDay + setupBefore;
  }
  const dayOfEnd = Math.floor((start + Math.max(1, durMin) - 1) / shiftMinPerDay);
  const newDayOfStart = Math.floor(start / shiftMinPerDay);
  if (dayOfEnd > newDayOfStart) {
    start = (newDayOfStart + 1) * shiftMinPerDay + setupBefore;
  }
  return start;
}

function findEarliestSlot(
  intervals: CellInterval[],
  cell: CellSpec,
  alloy: AlloyType,
  earliestMin: number,
  durMin: number,
  shiftMinPerDay = 0,
): { startMin: number; setupMin: number; insertIdx: number } {
  const startIdx = Math.max(0, intervals.length - 10);
  let prevEnd = startIdx > 0 ? intervals[startIdx - 1].endMin : 0;
  let prevAlloy: AlloyType | null = startIdx > 0 ? intervals[startIdx - 1].alloy : null;

  for (let pos = startIdx; pos < intervals.length; pos++) {
    const iv = intervals[pos];
    const setupBefore =
      cell.hasAlloySetup && prevAlloy !== null && prevAlloy !== alloy ? cell.setupMin : 0;
    const setupAfter = cell.hasAlloySetup && iv.alloy !== alloy ? cell.setupMin : 0;
    const candStart = snapToShift(
      Math.max(earliestMin, prevEnd + setupBefore),
      durMin,
      setupBefore,
      shiftMinPerDay,
    );
    if (
      shiftMinPerDay > 0 &&
      setupAfter > 0 &&
      Math.floor((iv.startMin - setupAfter) / shiftMinPerDay) < Math.floor(iv.startMin / shiftMinPerDay)
    ) {
      prevEnd = iv.endMin;
      prevAlloy = iv.alloy;
      continue;
    }
    if (candStart + durMin + setupAfter <= iv.startMin) {
      return { startMin: candStart, setupMin: setupBefore, insertIdx: pos };
    }
    prevEnd = iv.endMin;
    prevAlloy = iv.alloy;
  }
  const setupBefore =
    cell.hasAlloySetup && prevAlloy !== null && prevAlloy !== alloy ? cell.setupMin : 0;
  return {
    startMin: snapToShift(
      Math.max(earliestMin, prevEnd + setupBefore),
      durMin,
      setupBefore,
      shiftMinPerDay,
    ),
    setupMin: setupBefore,
    insertIdx: intervals.length,
  };
}

function normalizedLambda(rawLam: number): number {
  const clamped = Math.max(0, rawLam);
  return clamped / (1 + clamped);
}

const UNVERIFIED_PLACEHOLDER: ScheduleVerification = {
  valid: true,
  missingOps: 0,
  overlapCount: 0,
  precedenceViolations: 0,
  bomViolations: 0,
  skillViolations: 0,
  offlineViolations: 0,
  setupViolations: 0,
  shiftViolations: 0,
  materialViolations: 0,
  errors: [],
};

function decodeSchedule(
  jobs: JewelryJobSpec[],
  signals: Record<string, UpperCellSignal>,
  offlineCells: Set<string>,
  mode: 'greedy-ect' | 'two-level',
  physarumWeight: number,
  cellOverrides: Map<string, string>,
  cells: CellSpec[] = JEWELRY_CELLS,
  shiftMinPerDay = 0,
  skipVerify = false,
): FjspSolution {
  const nJobs = jobs.length;
  const jobIdxById = new Map<string, number>();
  const onlineByJobOp: Array<Array<Array<[string, number]>>> = new Array(nJobs);

  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    const job = jobs[jIdx];
    jobIdxById.set(job.id, jIdx);
    const opEntries: Array<Array<[string, number]>> = new Array(job.ops.length);
    for (let oIdx = 0; oIdx < job.ops.length; oIdx++) {
      const online = Object.entries(job.ops[oIdx].durations).filter(
        ([cid]) => !offlineCells.has(cid),
      );
      if (online.length === 0) {
        return emptyInvalidSolution(
          `No online cell available for ${job.id} (${job.ops[oIdx].stage}): required specialist cell is offline`,
          nJobs,
          shiftMinPerDay,
        );
      }
      opEntries[oIdx] = online;
    }
    onlineByJobOp[jIdx] = opEntries;
  }

  const lamNormByCell = new Map<string, number>();
  for (const cid of Object.keys(signals)) {
    lamNormByCell.set(cid, normalizedLambda(signals[cid]?.shadowPriceLambda ?? 0));
  }

  const hasDueDates = jobs.some((j) => j.dueMin !== undefined);
  const effDue = new Float64Array(nJobs);
  const depIdxArr = new Int32Array(nJobs);
  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    effDue[jIdx] = jobs[jIdx].dueMin ?? Number.POSITIVE_INFINITY;
    depIdxArr[jIdx] = -1;
  }
  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    const job = jobs[jIdx];
    if (job.dependsOnJobId) {
      const dIdx = jobIdxById.get(job.dependsOnJobId) ?? -1;
      depIdxArr[jIdx] = dIdx;
      if (hasDueDates && dIdx >= 0 && job.dueMin !== undefined) {
        let fgMinWork = 0;
        const jobOpsOnline = onlineByJobOp[jIdx];
        for (let oIdx = 0; oIdx < jobOpsOnline.length; oIdx++) {
          let m = Number.POSITIVE_INFINITY;
          for (const [, d] of jobOpsOnline[oIdx]) {
            if (d < m) m = d;
          }
          if (Number.isFinite(m)) fgMinWork += m;
        }
        effDue[dIdx] = Math.min(effDue[dIdx], job.dueMin - fgMinWork - INTER_ZONE_TRANSFER_MIN);
      }
    }
  }

  const cellIntervals = new Map<string, CellInterval[]>();
  for (const cell of cells) cellIntervals.set(cell.id, []);

  const jobNext = new Int32Array(nJobs);
  const jobReady = new Float64Array(nJobs);
  const jobDone = new Float64Array(nJobs);
  const jobHasDone = new Uint8Array(nJobs);
  const jobLastCell: Array<CellSpec | null> = new Array(nJobs).fill(null);
  const activeIndices: number[] = [];

  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    const job = jobs[jIdx];
    jobReady[jIdx] = Math.max(job.releaseMin, job.materialReadyMin ?? 0);
    if (job.ops.length > 0) {
      activeIndices.push(jIdx);
    } else {
      jobHasDone[jIdx] = 1;
      jobDone[jIdx] = jobReady[jIdx];
    }
  }

  const jobPriority = new Float64Array(nJobs);
  const remWork: Float64Array[] = new Array(nJobs);
  const lamScale = hasDueDates ? 0.6 : 1.5;
  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    const opsLen = jobs[jIdx].ops.length;
    const arr = new Float64Array(opsLen);
    let acc = 0;
    for (let idx = opsLen - 1; idx >= 0; idx--) {
      const onlineEntries = onlineByJobOp[jIdx][idx];
      let minDur = Number.POSITIVE_INFINITY;
      let minLam = Number.POSITIVE_INFINITY;
      for (const [cid, d] of onlineEntries) {
        if (d < minDur) minDur = d;
        const l = lamNormByCell.get(cid) ?? 0;
        if (l < minLam) minLam = l;
      }
      if (Number.isFinite(minDur)) {
        acc +=
          minDur *
          (1 + (mode === 'two-level' ? lamScale * physarumWeight * (Number.isFinite(minLam) ? minLam : 0) : 0));
      }
      arr[idx] = acc;
    }
    remWork[jIdx] = arr;
    jobPriority[jIdx] = acc * 0.7;
  }

  const totalOps = jobs.reduce((acc, j) => acc + j.ops.length, 0);
  const scheduled: ScheduledOp[] = [];
  const hasOverrides = cellOverrides.size > 0;

  for (let stepIdx = 0; stepIdx < totalOps; stepIdx++) {
    interface DispatchCandidate {
      prioA: number;
      prioB: number;
      jIdx: number;
      activePos: number;
      job: JewelryJobSpec;
      opIndex: number;
      opSpec: JewelryOpSpec;
      cellId: string;
      cell: CellSpec;
      startMin: number;
      endMin: number;
      durMin: number;
      setupMin: number;
      transferMin: number;
      insertIdx: number;
    }
    let bestCandidate: DispatchCandidate | null = null;

    for (let aPos = 0; aPos < activeIndices.length; aPos++) {
      const jIdx = activeIndices[aPos];
      const job = jobs[jIdx];
      const opIndex = jobNext[jIdx];

      if (opIndex === 0 && depIdxArr[jIdx] >= 0) {
        const dIdx = depIdxArr[jIdx];
        if (!jobHasDone[dIdx]) continue;
        const depReady = jobDone[dIdx] + INTER_ZONE_TRANSFER_MIN;
        if (depReady > jobReady[jIdx]) {
          jobReady[jIdx] = depReady;
        }
      }

      const opSpec = job.ops[opIndex];
      const allOnline = onlineByJobOp[jIdx][opIndex];
      const overrideCell = hasOverrides ? cellOverrides.get(`${job.id}#${opIndex}`) : undefined;

      const eligible: Array<[string, number]> =
        overrideCell && !offlineCells.has(overrideCell) && opSpec.durations[overrideCell] !== undefined
          ? [[overrideCell, opSpec.durations[overrideCell]]]
          : allOnline;

      let bestCellChoice: {
        score: number;
        endMin: number;
        startMin: number;
        durMin: number;
        setupMin: number;
        transferMin: number;
        cellId: string;
        cell: CellSpec;
        insertIdx: number;
      } | null = null;

      const prevCell = jobLastCell[jIdx];
      const baseReady = jobReady[jIdx];

      for (let eIdx = 0; eIdx < eligible.length; eIdx++) {
        const [cellId, durMin] = eligible[eIdx];
        const cell = CELLS_BY_ID.get(cellId);
        if (!cell) continue;
        const transferMin = prevCell && prevCell.zone !== cell.zone ? INTER_ZONE_TRANSFER_MIN : 0;
        const earliestMin = baseReady + transferMin;
        const ivs = cellIntervals.get(cellId)!;
        const slot = findEarliestSlot(ivs, cell, job.alloy, earliestMin, durMin, shiftMinPerDay);
        const endMin = slot.startMin + durMin;

        const lamNorm = lamNormByCell.get(cellId) ?? 0;
        const flexPenalty =
          mode === 'two-level' && !overrideCell && allOnline.length > 1
            ? physarumWeight * lamNorm * durMin
            : 0;
        const setupPenalty = mode === 'two-level' ? (hasDueDates ? 0.8 : 0.4) * slot.setupMin : 0;
        const score = endMin + flexPenalty + setupPenalty;

        if (
          !bestCellChoice ||
          score < bestCellChoice.score ||
          (score === bestCellChoice.score && endMin < bestCellChoice.endMin)
        ) {
          bestCellChoice = {
            score,
            endMin,
            startMin: slot.startMin,
            durMin,
            setupMin: slot.setupMin,
            transferMin,
            cellId,
            cell,
            insertIdx: slot.insertIdx,
          };
        }
      }

      if (!bestCellChoice) continue;

      let prioA: number;
      let prioB: number;
      if (mode === 'greedy-ect') {
        prioA = bestCellChoice.endMin;
        prioB = bestCellChoice.startMin;
      } else if (hasDueDates) {
        const rem = remWork[jIdx][opIndex];
        const due = effDue[jIdx];
        const slack = due - (bestCellChoice.startMin + rem);
        const prioScale = 1 + 0.4 * ((job.priority ?? 1) - 1);
        const urgency = Math.min(slack, 400) / prioScale;
        prioA = bestCellChoice.startMin + 0.45 * urgency + 0.6 * bestCellChoice.setupMin;
        prioB = bestCellChoice.score;
      } else {
        prioA = bestCellChoice.startMin - jobPriority[jIdx];
        prioB = bestCellChoice.score;
      }

      if (
        !bestCandidate ||
        prioA < bestCandidate.prioA - 1e-9 ||
        (Math.abs(prioA - bestCandidate.prioA) <= 1e-9 &&
          (prioB < bestCandidate.prioB - 1e-9 ||
            (Math.abs(prioB - bestCandidate.prioB) <= 1e-9 && job.id < bestCandidate.job.id)))
      ) {
        bestCandidate = {
          prioA,
          prioB,
          jIdx,
          activePos: aPos,
          job,
          opIndex,
          opSpec,
          ...bestCellChoice,
        };
      }
    }

    if (!bestCandidate) {
      return emptyInvalidSolution(
        'No dispatchable operation remaining (check BOM cycle)',
        nJobs,
        shiftMinPerDay,
      );
    }

    const opRecord: ScheduledOp = {
      jobId: bestCandidate.job.id,
      jobName: bestCandidate.job.name,
      opIndex: bestCandidate.opIndex,
      stage: bestCandidate.opSpec.stage,
      alloy: bestCandidate.job.alloy,
      cellId: bestCandidate.cellId,
      startMin: bestCandidate.startMin,
      endMin: bestCandidate.endMin,
      durMin: bestCandidate.durMin,
      setupMin: bestCandidate.setupMin,
      transferMin: bestCandidate.transferMin,
      reentrant: Boolean(bestCandidate.opSpec.reentrant),
    };

    const ivs = cellIntervals.get(bestCandidate.cellId)!;
    ivs.splice(bestCandidate.insertIdx, 0, {
      startMin: bestCandidate.startMin,
      endMin: bestCandidate.endMin,
      alloy: bestCandidate.job.alloy,
      opRef: opRecord,
    });

    const bjIdx = bestCandidate.jIdx;
    jobReady[bjIdx] = bestCandidate.endMin;
    jobLastCell[bjIdx] = bestCandidate.cell;
    const nextIdx = bestCandidate.opIndex + 1;
    jobNext[bjIdx] = nextIdx;
    if (nextIdx >= bestCandidate.job.ops.length) {
      jobDone[bjIdx] = bestCandidate.endMin;
      jobHasDone[bjIdx] = 1;
      const lastPos = activeIndices.length - 1;
      if (bestCandidate.activePos !== lastPos) {
        activeIndices[bestCandidate.activePos] = activeIndices[lastPos];
      }
      activeIndices.pop();
    }
    scheduled.push(opRecord);
  }

  let totalSetupMin = 0;
  for (const [cellId, ivs] of cellIntervals.entries()) {
    const cell = CELLS_BY_ID.get(cellId);
    for (let k = 0; k < ivs.length; k++) {
      const setup =
        k > 0 && cell?.hasAlloySetup && ivs[k - 1].alloy !== ivs[k].alloy ? cell.setupMin : 0;
      ivs[k].opRef.setupMin = setup;
      totalSetupMin += setup;
    }
  }

  let makespanMin = 0;
  let totalTransferMin = 0;
  for (let i = 0; i < scheduled.length; i++) {
    const op = scheduled[i];
    if (op.endMin > makespanMin) makespanMin = op.endMin;
    totalTransferMin += op.transferMin;
  }
  let totalFlowTimeMin = 0;
  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    totalFlowTimeMin += jobReady[jIdx];
  }

  let onTimePos = 0;
  let totalTardinessMin = 0;
  let weightedTardinessMin = 0;
  const lateJobIds: string[] = [];
  for (let jIdx = 0; jIdx < nJobs; jIdx++) {
    const job = jobs[jIdx];
    const end = jobHasDone[jIdx] ? jobDone[jIdx] : 0;
    const due = job.dueMin;
    if (due === undefined) {
      onTimePos++;
      continue;
    }
    const tard = Math.max(0, end - due);
    if (tard === 0) {
      onTimePos++;
    } else {
      totalTardinessMin += tard;
      weightedTardinessMin += (job.priority ?? 1) * tard;
      lateJobIds.push(job.id);
    }
  }

  const verification = skipVerify
    ? UNVERIFIED_PLACEHOLDER
    : verifyFjspSchedule(jobs, scheduled, offlineCells, CELLS_BY_ID, shiftMinPerDay);

  return {
    feasible: verification.valid,
    infeasibleReason: verification.valid ? undefined : verification.errors[0],
    shiftMinPerDay,
    makespanMin,
    totalFlowTimeMin,
    totalSetupMin,
    totalTransferMin,
    totalPos: nJobs,
    onTimePos,
    latePos: lateJobIds.length,
    totalTardinessMin,
    weightedTardinessMin,
    lateJobIds,
    ops: scheduled,
    verification,
  };
}

function computeLowerBound(jobs: JewelryJobSpec[], offlineCells: Set<string>): number {
  let lb = 0;
  const mandatoryCellWork = new Map<string, number>();
  const mandatoryCellHead = new Map<string, number>();
  const mandatoryCellTail = new Map<string, number>();
  const jobMinEnd = new Map<string, number>();

  // Topologically process jobs without BOM dependencies first, then dependent FG jobs.
  const orderedJobs = [...jobs].sort((a, b) => (a.dependsOnJobId ? 1 : 0) - (b.dependsOnJobId ? 1 : 0));

  for (const job of orderedJobs) {
    let head = Math.max(job.releaseMin, job.materialReadyMin ?? 0);
    if (job.dependsOnJobId) {
      const depMinEnd = jobMinEnd.get(job.dependsOnJobId);
      if (depMinEnd !== undefined) {
        head = Math.max(head, depMinEnd + INTER_ZONE_TRANSFER_MIN);
      }
    }
    const minDurs: number[] = [];
    let valid = true;
    for (const op of job.ops) {
      const onlineDurs = Object.entries(op.durations)
        .filter(([cid]) => !offlineCells.has(cid))
        .map(([, d]) => d);
      if (onlineDurs.length === 0) {
        valid = false;
        break;
      }
      minDurs.push(Math.min(...onlineDurs));
    }
    if (!valid) continue;

    const jobTotal = head + minDurs.reduce((a, b) => a + b, 0);
    jobMinEnd.set(job.id, jobTotal);
    if (jobTotal > lb) lb = jobTotal;

    const suffix = new Array<number>(job.ops.length + 1).fill(0);
    for (let i = job.ops.length - 1; i >= 0; i--) {
      suffix[i] = suffix[i + 1] + minDurs[i];
    }

    for (let i = 0; i < job.ops.length; i++) {
      const online = Object.entries(job.ops[i].durations).filter(([cid]) => !offlineCells.has(cid));
      if (online.length === 1) {
        const [cid, dur] = online[0];
        mandatoryCellWork.set(cid, (mandatoryCellWork.get(cid) ?? 0) + dur);
        const prevHead = mandatoryCellHead.get(cid);
        mandatoryCellHead.set(cid, prevHead === undefined ? head : Math.min(prevHead, head));
        const tail = suffix[i + 1];
        const prevTail = mandatoryCellTail.get(cid);
        mandatoryCellTail.set(cid, prevTail === undefined ? tail : Math.min(prevTail, tail));
      }
      head += minDurs[i];
    }
  }

  for (const [cid, work] of mandatoryCellWork.entries()) {
    const h = mandatoryCellHead.get(cid) ?? 0;
    const t = mandatoryCellTail.get(cid) ?? 0;
    const cellBound = h + work + t;
    if (cellBound > lb) lb = cellBound;
  }
  return lb;
}

function isStrictlyBetter(
  cand: FjspSolution,
  best: FjspSolution,
  preferTardiness: boolean,
): boolean {
  if (!cand.feasible) return false;
  if (!best.feasible) return true;
  if (preferTardiness && cand.weightedTardinessMin !== best.weightedTardinessMin) {
    return cand.weightedTardinessMin < best.weightedTardinessMin;
  }
  if (cand.makespanMin !== best.makespanMin) return cand.makespanMin < best.makespanMin;
  if (cand.totalSetupMin !== best.totalSetupMin) return cand.totalSetupMin < best.totalSetupMin;
  return cand.totalFlowTimeMin < best.totalFlowTimeMin;
}

/**
 * Solve the Two-Level Multi-Cell Jewelry FJSP:
 * - Upper layer: read Physarum multi-stage flow, bottleneck shadow prices (lambda_e), and offline cells.
 * - Lower layer: decode a verified non-overlapping active schedule + critical-path local refinement.
 */
export function solveTwoLevelFjsp(
  graph: Graph,
  jobs: JewelryJobSpec[],
  options: {
    physarumWeight?: number;
    refine?: boolean;
    shiftMinPerDay?: number;
    cells?: CellSpec[];
  } = {},
): TwoLevelComparison {
  const physarumWeight = options.physarumWeight ?? 0.9;
  const refine = options.refine ?? true;
  const shiftMinPerDay = options.shiftMinPerDay ?? 0;
  const cells = options.cells ?? JEWELRY_CELLS;
  const activeCellIds = new Set(cells.map((c) => c.id));
  const upperSignals = extractUpperCellSignals(graph);
  const offlineSet = getOfflineCellIds(graph);
  const offlineCells = Array.from(offlineSet).sort();

  const lowerBoundMin = computeLowerBound(jobs, offlineSet);
  const emptyOverrides = new Map<string, string>();
  const greedyBaseline = decodeSchedule(
    jobs,
    upperSignals,
    offlineSet,
    'greedy-ect',
    0,
    emptyOverrides,
    cells,
    shiftMinPerDay,
  );

  const overrides = new Map<string, string>();
  let twoLevel = decodeSchedule(
    jobs,
    upperSignals,
    offlineSet,
    'two-level',
    physarumWeight,
    overrides,
    cells,
    shiftMinPerDay,
    true,
  );

  const hasDueDates = jobs.some((j) => j.dueMin !== undefined);
  const refinePasses = jobs.length >= 60 ? 1 : jobs.length > 25 ? 1 : 3;
  const refineCount = jobs.length >= 60 ? 3 : jobs.length > 25 ? 4 : 5;

  if (refine && twoLevel.feasible) {
    for (let pass = 0; pass < refinePasses; pass++) {
      let improved = false;
      const jobEnd = new Map<string, number>();
      for (const op of twoLevel.ops) {
        jobEnd.set(op.jobId, Math.max(jobEnd.get(op.jobId) ?? 0, op.endMin));
      }
      const targetJobs = [...jobs]
        .sort((a, b) => {
          if (hasDueDates) {
            const ta = (a.priority ?? 1) * Math.max(0, (jobEnd.get(a.id) ?? 0) - (a.dueMin ?? 0));
            const tb = (b.priority ?? 1) * Math.max(0, (jobEnd.get(b.id) ?? 0) - (b.dueMin ?? 0));
            if (tb !== ta) return tb - ta;
          }
          return (jobEnd.get(b.id) ?? 0) - (jobEnd.get(a.id) ?? 0);
        })
        .slice(0, refineCount);

      for (const job of targetJobs) {
        for (let idx = 0; idx < job.ops.length; idx++) {
          const onlineCells = Object.keys(job.ops[idx].durations).filter(
            (cid) => !offlineSet.has(cid),
          );
          if (onlineCells.length <= 1) continue;
          const key = `${job.id}#${idx}`;
          const prevOverride = overrides.get(key);
          for (const altCell of onlineCells) {
            if (altCell === prevOverride) continue;
            overrides.set(key, altCell);
            const candidate = decodeSchedule(
              jobs,
              upperSignals,
              offlineSet,
              'two-level',
              physarumWeight,
              overrides,
              cells,
              shiftMinPerDay,
              true,
            );
            if (isStrictlyBetter(candidate, twoLevel, hasDueDates)) {
              twoLevel = candidate;
              improved = true;
              break;
            } else if (prevOverride === undefined) {
              overrides.delete(key);
            } else {
              overrides.set(key, prevOverride);
            }
          }
        }
      }
      if (!improved) break;
    }
  }

  if (twoLevel.verification === UNVERIFIED_PLACEHOLDER) {
    const verification = verifyFjspSchedule(
      jobs,
      twoLevel.ops,
      offlineSet,
      CELLS_BY_ID,
      shiftMinPerDay,
    );
    twoLevel = {
      ...twoLevel,
      feasible: verification.valid,
      infeasibleReason: verification.valid ? undefined : verification.errors[0],
      verification,
    };
  }

  let bottleneckCellId = cells[0]?.id ?? JEWELRY_CELLS[0].id;
  let bestBottleneckScore = -1;
  for (const sig of Object.values(upperSignals)) {
    if (sig.offline || !activeCellIds.has(sig.cellId)) continue;
    const score =
      sig.shadowPriceLambda > 1e-6
        ? 1000 + sig.shadowPriceLambda
        : sig.capacity > 0
          ? sig.loadQ / sig.capacity
          : 0;
    if (score > bestBottleneckScore) {
      bestBottleneckScore = score;
      bottleneckCellId = sig.cellId;
    }
  }

  const makespanDeltaMin =
    greedyBaseline.feasible && twoLevel.feasible
      ? greedyBaseline.makespanMin - twoLevel.makespanMin
      : 0;
  const makespanImprovementPct =
    greedyBaseline.feasible && twoLevel.feasible && greedyBaseline.makespanMin > 0
      ? (makespanDeltaMin / greedyBaseline.makespanMin) * 100
      : 0;
  const setupSavedMin =
    greedyBaseline.feasible && twoLevel.feasible
      ? greedyBaseline.totalSetupMin - twoLevel.totalSetupMin
      : 0;
  const tardinessSavedMin =
    greedyBaseline.feasible && twoLevel.feasible
      ? greedyBaseline.totalTardinessMin - twoLevel.totalTardinessMin
      : 0;
  const weightedTardinessSavedMin =
    greedyBaseline.feasible && twoLevel.feasible
      ? greedyBaseline.weightedTardinessMin - twoLevel.weightedTardinessMin
      : 0;

  return {
    upperSignals,
    offlineCells,
    bottleneckCellId,
    lowerBoundMin,
    greedyBaseline,
    twoLevel,
    makespanDeltaMin,
    makespanImprovementPct,
    setupSavedMin,
    tardinessSavedMin,
    weightedTardinessSavedMin,
  };
}

/**
 * Export a standalone Google OR-Tools CP-SAT Python model (.py) encoding the exact
 * Multi-Cell Jewelry FJSP constraints (including BOM FG/SG precedence & PO due dates)
 * and warm-started with the Two-Level hints.
 */
export function exportFjspCpSatPython(
  graph: Graph,
  jobs: JewelryJobSpec[],
  comparison: TwoLevelComparison,
  options: {
    seed: number;
    iteration: number;
    cells?: CellSpec[];
    shiftMinPerDay?: number;
    salesOrders?: Array<{ id: string; dueMin: number; priority: number; fgPoIds: string[] }>;
  },
): string {
  const offlineSet = getOfflineCellIds(graph);
  const shiftMinPerDay = options.shiftMinPerDay ?? 0;
  const activeCells = (options.cells ?? JEWELRY_CELLS).filter((c) => !offlineSet.has(c.id));
  const salesOrders = options.salesOrders ?? [];
  const horizonPad = shiftMinPerDay > 0 ? shiftMinPerDay : 240;
  const horizon = Math.max(
    600,
    comparison.twoLevel.makespanMin + horizonPad,
    comparison.greedyBaseline.makespanMin + horizonPad,
  );
  const cellsJson = JSON.stringify(activeCells, null, 2);
  const jobsJson = JSON.stringify(
    jobs.map((j) => ({
      id: j.id,
      soId: j.soId ?? null,
      alloy: j.alloy,
      poType: j.poType ?? 'FG-FULL',
      releaseMin: j.releaseMin,
      materialReadyMin: j.materialReadyMin ?? 0,
      dueMin: j.dueMin ?? null,
      priority: j.priority ?? 1,
      dependsOnJobId: j.dependsOnJobId ?? null,
      ops: j.ops.map((op) => ({
        stage: op.stage,
        durations: Object.fromEntries(
          Object.entries(op.durations).filter(([cid]) => !offlineSet.has(cid)),
        ),
      })),
    })),
    null,
    2,
  );
  const salesOrdersJson = JSON.stringify(salesOrders, null, 2);
  const hintsJson = JSON.stringify(
    comparison.twoLevel.ops.map((op) => ({
      jobId: op.jobId,
      opIndex: op.opIndex,
      cellId: op.cellId,
      startMin: op.startMin,
    })),
    null,
    2,
  );
  const signalsJson = JSON.stringify(comparison.upperSignals, null, 2);

  return `#!/usr/bin/env python3
"""
Two-Level Multi-Cell Jewelry FJSP (OR-Tools CP-SAT)
Generated by Physarum Pathfinder (seed=${options.seed}, step=${options.iteration})
Total POs: ${jobs.length} | Sales Orders: ${salesOrders.length} | Shift limit: ${shiftMinPerDay} min/day
Offline cells: ${JSON.stringify(Array.from(offlineSet).sort())} | Bottleneck: ${comparison.bottleneckCellId}
"""
from ortools.sat.python import cp_model
import json

HORIZON = ${horizon}
INTER_ZONE_TRANSFER = ${INTER_ZONE_TRANSFER_MIN}
SHIFT_MIN_PER_DAY = ${shiftMinPerDay}

CELLS = json.loads(r'''${cellsJson}''')

JOBS = json.loads(r'''${jobsJson}''')

SALES_ORDERS = json.loads(r'''${salesOrdersJson}''')

UPPER_PHYSARUM_SIGNALS = json.loads(r'''${signalsJson}''')

TWO_LEVEL_HINTS = json.loads(r'''${hintsJson}''')


def solve_jewelry_fjsp():
    model = cp_model.CpModel()
    cell_by_id = {c["id"]: c for c in CELLS}
    cell_intervals = {c["id"]: [] for c in CELLS}
    cell_records = {c["id"]: [] for c in CELLS}
    op_vars = {}
    job_starts_by_id = {}
    job_ends_by_id = {}
    job_ends = []
    tardiness_terms = []

    for job in JOBS:
        jid = job["id"]
        rel_bound = max(int(job["releaseMin"]), int(job.get("materialReadyMin", 0) or 0))
        prev_end = None
        prev_choice_vars = None
        first_start = None
        for op_idx, op in enumerate(job["ops"]):
            avail = op["durations"]
            if not avail:
                stage = op["stage"]
                raise RuntimeError(f"Infeasible: {jid} op #{op_idx} ({stage}) has no online cell")

            start = model.NewIntVar(rel_bound, HORIZON, f"s_{jid}_{op_idx}")
            end = model.NewIntVar(rel_bound, HORIZON, f"e_{jid}_{op_idx}")
            dur = model.NewIntVar(min(avail.values()), max(avail.values()), f"d_{jid}_{op_idx}")
            model.Add(end == start + dur)
            if SHIFT_MIN_PER_DAY > 0:
                max_days = HORIZON // SHIFT_MIN_PER_DAY + 2
                day_v = model.NewIntVar(0, max_days, f"day_{jid}_{op_idx}")
                model.Add(start >= day_v * SHIFT_MIN_PER_DAY)
                model.Add(end <= (day_v + 1) * SHIFT_MIN_PER_DAY)
            if first_start is None:
                first_start = start

            presences = []
            choice_map = {}
            for cid, d_val in avail.items():
                p = model.NewBoolVar(f"p_{jid}_{op_idx}_{cid}")
                iv = model.NewOptionalIntervalVar(start, d_val, end, p, f"iv_{jid}_{op_idx}_{cid}")
                model.Add(dur == d_val).OnlyEnforceIf(p)
                presences.append(p)
                choice_map[cid] = p
                cell_intervals[cid].append(iv)
                cell_records[cid].append((p, start, end, job["alloy"]))

            model.AddExactlyOne(presences)

            if prev_end is not None:
                for p_cid, p_var in prev_choice_vars.items():
                    for c_cid, c_var in choice_map.items():
                        tr = INTER_ZONE_TRANSFER if cell_by_id[p_cid]["zone"] != cell_by_id[c_cid]["zone"] else 0
                        model.Add(start >= prev_end + tr).OnlyEnforceIf([p_var, c_var])

            op_vars[(jid, op_idx)] = (start, choice_map)
            prev_end = end
            prev_choice_vars = choice_map

        job_starts_by_id[jid] = first_start
        job_ends_by_id[jid] = prev_end
        job_ends.append(prev_end)

        if job.get("dueMin") is not None:
            tard = model.NewIntVar(0, HORIZON, f"tard_{jid}")
            model.AddMaxEquality(tard, [0, prev_end - int(job["dueMin"])])
            tardiness_terms.append(int(job.get("priority", 1)) * tard)

    # Explicit FG <-> SG BOM precedence constraints
    for job in JOBS:
        dep_id = job.get("dependsOnJobId")
        if dep_id and dep_id in job_ends_by_id:
            model.Add(job_starts_by_id[job["id"]] >= job_ends_by_id[dep_id] + INTER_ZONE_TRANSFER)

    so_tardiness_terms = []
    for so in SALES_ORDERS:
        po_ends = [job_ends_by_id[pid] for pid in so["fgPoIds"] if pid in job_ends_by_id]
        if po_ends:
            so_end = model.NewIntVar(0, HORIZON, f"so_end_{so['id']}")
            model.AddMaxEquality(so_end, po_ends)
            so_tard = model.NewIntVar(0, HORIZON, f"so_tard_{so['id']}")
            model.AddMaxEquality(so_tard, [0, so_end - int(so["dueMin"])])
            so_tardiness_terms.append(int(so.get("priority", 1)) * so_tard)

    for c in CELLS:
        cid = c["id"]
        if cell_intervals[cid]:
            model.AddNoOverlap(cell_intervals[cid])
        if c["hasAlloySetup"] and len(cell_records[cid]) > 1:
            recs = cell_records[cid]
            for a_idx in range(len(recs)):
                pa, sa, ea, alloy_a = recs[a_idx]
                for b_idx in range(a_idx + 1, len(recs)):
                    pb, sb, eb, alloy_b = recs[b_idx]
                    if alloy_a != alloy_b:
                        a_before_b = model.NewBoolVar(f"ord_{cid}_{a_idx}_{b_idx}")
                        model.Add(ea + c["setupMin"] <= sb).OnlyEnforceIf([pa, pb, a_before_b])
                        model.Add(eb + c["setupMin"] <= sa).OnlyEnforceIf([pa, pb, a_before_b.Not()])

    for hint in TWO_LEVEL_HINTS:
        key = (hint["jobId"], hint["opIndex"])
        if key in op_vars:
            s_var, cmap = op_vars[key]
            model.AddHint(s_var, hint["startMin"])
            for cid, p_var in cmap.items():
                model.AddHint(p_var, 1 if cid == hint["cellId"] else 0)

    makespan = model.NewIntVar(0, HORIZON, "makespan")
    model.AddMaxEquality(makespan, job_ends)
    if so_tardiness_terms:
        model.Minimize(20 * sum(so_tardiness_terms) + 5 * sum(tardiness_terms) + makespan)
    elif tardiness_terms:
        model.Minimize(10 * sum(tardiness_terms) + makespan)
    else:
        model.Minimize(makespan)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    status = solver.Solve(model)
    print(f"Status: {solver.StatusName(status)} | Makespan: {solver.Value(makespan)} min | Objective: {solver.ObjectiveValue()}")


if __name__ == "__main__":
    solve_jewelry_fjsp()
`;
}
