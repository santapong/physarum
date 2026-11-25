import {
  SHIFT_MIN_PER_DAY,
  type AlloyType,
  type FjspSolution,
  type JewelryJobSpec,
  type JewelryOpSpec,
  type TwoLevelComparison,
} from './fjsp';
import { createRandom } from './random';

export type MaterialId =
  | 'AU-18KY'
  | 'AU-18KR'
  | 'AG-925'
  | 'PT-950'
  | 'DIA-MELEE'
  | 'FINDINGS';

export type SgSku = 'SG-18KY-MNT' | 'SG-18KR-MNT' | 'SG-925-MNT' | 'SG-PT950-MNT';

export interface MaterialSpec {
  id: MaterialId;
  label: string;
  unit: string;
  unitCostUsd: number;
  leadTimeDays: number;
  payOnOrder: boolean;
  lotSize: number;
}

export const MATERIAL_CATALOG: Record<MaterialId, MaterialSpec> = {
  'AU-18KY': {
    id: 'AU-18KY',
    label: '18K-Y Gold',
    unit: 'g',
    unitCostUsd: 62,
    leadTimeDays: 2,
    payOnOrder: true,
    lotSize: 120,
  },
  'AU-18KR': {
    id: 'AU-18KR',
    label: '18K-R Gold',
    unit: 'g',
    unitCostUsd: 61,
    leadTimeDays: 2,
    payOnOrder: true,
    lotSize: 120,
  },
  'AG-925': {
    id: 'AG-925',
    label: '925 Silver',
    unit: 'g',
    unitCostUsd: 1.4,
    leadTimeDays: 1,
    payOnOrder: false,
    lotSize: 200,
  },
  'PT-950': {
    id: 'PT-950',
    label: 'PT950 Grain',
    unit: 'g',
    unitCostUsd: 42,
    leadTimeDays: 3,
    payOnOrder: true,
    lotSize: 80,
  },
  'DIA-MELEE': {
    id: 'DIA-MELEE',
    label: 'Melee & Gems',
    unit: 'ct',
    unitCostUsd: 420,
    leadTimeDays: 2,
    payOnOrder: false,
    lotSize: 12,
  },
  FINDINGS: {
    id: 'FINDINGS',
    label: 'Findings/Salts',
    unit: 'kit',
    unitCostUsd: 28,
    leadTimeDays: 1,
    payOnOrder: false,
    lotSize: 25,
  },
};

export const SG_SKU_LABELS: Record<SgSku, string> = {
  'SG-18KY-MNT': '18K-Y Mounting (WH)',
  'SG-18KR-MNT': '18K-R Mounting (WH)',
  'SG-925-MNT': '925 Mounting (WH)',
  'SG-PT950-MNT': 'PT950 Mounting (WH)',
};

export interface SalesOrderSpec {
  id: string;
  customer: string;
  orderDay: number;
  dueDay: number;
  dueMin: number;
  priority: 1 | 2 | 3;
  revenueUsd: number;
  depositPct: number;
  paymentNetDays: number;
  fgPoIds: string[];
  sgPoIds: string[];
  models: string[];
}

export interface MrpPurchaseOrder {
  id: string;
  materialId: MaterialId;
  qty: number;
  orderDay: number;
  arrivalDay: number;
  arrivalMin: number;
  paymentDay: number;
  totalCostUsd: number;
}

export interface ErpScenario {
  presetId: 'fjsp-jewelry-erp';
  shiftMinPerDay: number;
  startingCashUsd: number;
  salesOrders: SalesOrderSpec[];
  jobs: JewelryJobSpec[];
  initialMaterialStock: Record<MaterialId, number>;
  initialSgStock: Record<SgSku, number>;
  plannedMaterialPos: MrpPurchaseOrder[];
}

export interface MaterialLedgerRow {
  materialId: MaterialId;
  label: string;
  unit: string;
  initialQty: number;
  plannedReceiptsQty: number;
  consumedQty: number;
  endingQty: number;
  minBalanceQty: number;
  stockoutCount: number;
  procurementCostUsd: number;
  poCount: number;
}

export interface SgWarehouseRow {
  sku: SgSku;
  label: string;
  initialQty: number;
  receivedFromShopQty: number;
  issuedToAssemblyQty: number;
  endingQty: number;
  minBalanceQty: number;
  stockoutCount: number;
}

export interface SoScheduleStatus {
  soId: string;
  customer: string;
  orderDay: number;
  dueDay: number;
  priority: number;
  poCount: number;
  fgCount: number;
  sgCount: number;
  models: string[];
  completionMin: number;
  shipDay: number;
  tardyDays: number;
  onTime: boolean;
  balanceDay: number;
  revenueUsd: number;
}

export interface DailyCashFlowRow {
  day: number;
  inflowDepositUsd: number;
  inflowBalanceUsd: number;
  outflowMaterialUsd: number;
  outflowLaborUsd: number;
  outflowOverheadWipUsd: number;
  netUsd: number;
  closingCashUsd: number;
}

export interface CashFlowSummary {
  startingCashUsd: number;
  totalInflowsUsd: number;
  totalOutflowsUsd: number;
  netOperatingCashUsd: number;
  minCashUsd: number;
  minCashDay: number;
  endingCashUsd: number;
  avgCashConversionDays: number;
  cashShortfall: boolean;
  daily: DailyCashFlowRow[];
}

export interface ErpPlanMetrics {
  feasible: boolean;
  makespanDays: number;
  totalSos: number;
  onTimeSos: number;
  lateSos: number;
  soWeightedTardinessDays: number;
  materialStockouts: number;
  sgStockouts: number;
  salesOrders: SoScheduleStatus[];
  materials: MaterialLedgerRow[];
  sgWarehouse: SgWarehouseRow[];
  cashFlow: CashFlowSummary;
}

export interface ErpComparison {
  scenario: ErpScenario;
  greedyBaseline: ErpPlanMetrics;
  twoLevel: ErpPlanMetrics;
  makespanDaysSaved: number;
  soTardinessDaysSaved: number;
  endingCashDeltaUsd: number;
  minCashDeltaUsd: number;
  cccDaysSaved: number;
}

const ALLOY_TO_METAL: Record<AlloyType, MaterialId> = {
  '18K-Y': 'AU-18KY',
  '18K-R': 'AU-18KR',
  '925': 'AG-925',
  PT950: 'PT-950',
};

const ALLOY_TO_SG_SKU: Record<AlloyType, SgSku> = {
  '18K-Y': 'SG-18KY-MNT',
  '18K-R': 'SG-18KR-MNT',
  '925': 'SG-925-MNT',
  PT950: 'SG-PT950-MNT',
};

const CUSTOMERS = [
  'Maison Aurora',
  'Bangkok Bridal',
  'Ginza Boutique',
  'Geneva Fine',
  'Siam Atelier',
  'Milan Pavé',
  'Nordic Minimal',
  'Crown Exports',
];

const round2 = (n: number): number => Math.round(n * 100) / 100;

function castDurationsForAlloy(alloy: AlloyType): Record<string, number> {
  if (alloy === '925') return { 'cast-925': 48, 'cast-flex': 54 };
  if (alloy === 'PT950') return { 'cast-flex': 62, 'cast-18k': 68 };
  return { 'cast-18k': 56, 'cast-flex': 62 };
}

function planMrpProcurement(
  jobs: JewelryJobSpec[],
  initialStock: Record<MaterialId, number>,
): MrpPurchaseOrder[] {
  const ordered = [...jobs].sort(
    (a, b) => a.releaseMin - b.releaseMin || (a.dueMin ?? 0) - (b.dueMin ?? 0) || (a.id < b.id ? -1 : 1),
  );
  const lotsByMat = new Map<MaterialId, Array<{ arrivalMin: number; remaining: number }>>();
  for (const matId of Object.keys(MATERIAL_CATALOG) as MaterialId[]) {
    lotsByMat.set(matId, [{ arrivalMin: 0, remaining: initialStock[matId] ?? 0 }]);
  }

  const plannedPos: MrpPurchaseOrder[] = [];
  let poSeq = 1;

  for (const job of ordered) {
    const bom = job.materialBom ?? {};
    let maxArrivalMin = 0;

    for (const [rawId, reqQty] of Object.entries(bom)) {
      const matId = rawId as MaterialId;
      if (reqQty <= 0) continue;
      const spec = MATERIAL_CATALOG[matId];
      const lots = lotsByMat.get(matId)!;
      let remainingNeed = reqQty;

      for (const lot of lots) {
        if (remainingNeed <= 1e-9) break;
        if (lot.remaining <= 1e-9) continue;
        const take = Math.min(remainingNeed, lot.remaining);
        lot.remaining = round2(lot.remaining - take);
        remainingNeed = round2(remainingNeed - take);
        if (lot.arrivalMin > maxArrivalMin) maxArrivalMin = lot.arrivalMin;
      }

      if (remainingNeed > 1e-9) {
        const reqDay = Math.floor(job.releaseMin / SHIFT_MIN_PER_DAY) + 1;
        const orderDay = Math.max(1, reqDay - spec.leadTimeDays);
        const arrivalDay = orderDay + spec.leadTimeDays;
        const arrivalMin = (arrivalDay - 1) * SHIFT_MIN_PER_DAY;
        const paymentDay = spec.payOnOrder ? orderDay : arrivalDay;
        const orderQty = Math.ceil(remainingNeed / spec.lotSize) * spec.lotSize;
        plannedPos.push({
          id: `MRP-${String(poSeq++).padStart(2, '0')}`,
          materialId: matId,
          qty: orderQty,
          orderDay,
          arrivalDay,
          arrivalMin,
          paymentDay,
          totalCostUsd: round2(orderQty * spec.unitCostUsd),
        });
        const newLot = { arrivalMin, remaining: round2(orderQty - remainingNeed) };
        lots.push(newLot);
        if (arrivalMin > maxArrivalMin) maxArrivalMin = arrivalMin;
      }
    }

    job.materialReadyMin = maxArrivalMin;
  }

  plannedPos.sort((a, b) => a.orderDay - b.orderDay || a.arrivalDay - b.arrivalDay || (a.id < b.id ? -1 : 1));
  return plannedPos;
}

/**
 * Construct an integrated 20-SO / 80-PO jewelry ERP Master Scheduler scenario with
 * 560 min/day shifts, multi-model PO hierarchies, SG->Warehouse->Assembly->FG round-trips,
 * time-phased MRP procurement, and working-capital cash flow parameters.
 */
export function buildErpJewelryScenario(): ErpScenario {
  const rng = createRandom(5104);
  const alloys: AlloyType[] = ['18K-Y', '18K-R', '925', 'PT950'];

  const salesOrders: SalesOrderSpec[] = [];
  const jobs: JewelryJobSpec[] = [];
  const sgJobs: JewelryJobSpec[] = [];

  for (let s = 1; s <= 20; s++) {
    const soId = `SO-${String(s).padStart(2, '0')}`;
    const orderDay = s <= 8 ? 1 : s <= 15 ? 2 : 3;
    const priority: 1 | 2 | 3 = s % 5 === 1 ? 3 : s % 3 === 0 ? 2 : 1;
    const dueSpan = priority === 3 ? 2 : priority === 2 ? 3 : 3 + ((s + Math.floor(rng() * 2)) % 2);
    const dueDay = orderDay + dueSpan;
    const dueMin = dueDay * SHIFT_MIN_PER_DAY;
    salesOrders.push({
      id: soId,
      customer: CUSTOMERS[(s - 1) % CUSTOMERS.length],
      orderDay,
      dueDay,
      dueMin,
      priority,
      revenueUsd: 0,
      depositPct: 0.2,
      paymentNetDays: s % 2 === 0 ? 2 : 1,
      fgPoIds: [],
      sgPoIds: [],
      models: [],
    });
  }

  const releaseMinForOrderDay = (orderDay: number, jitterMax = 220): number =>
    (orderDay - 1) * SHIFT_MIN_PER_DAY + Math.floor(rng() * jitterMax);

  // 1) 28 SG-STOCK POs (8 SOs receive 2 pairs, 12 SOs receive 1 pair -> 28 pairs)
  let sgCounter = 1;
  let fgAsmCounter = 1;
  for (let sIdx = 0; sIdx < salesOrders.length; sIdx++) {
    const so = salesOrders[sIdx];
    const pairCount = sIdx < 8 ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      const alloy = alloys[(sgCounter - 1) % 3];
      const pad = String(sgCounter).padStart(2, '0');
      const sgId = `SG-${pad}`;
      const rel = releaseMinForOrderDay(so.orderDay, 140);
      const sgDue = Math.max(rel + 240, so.dueMin - SHIFT_MIN_PER_DAY);
      const metalId = ALLOY_TO_METAL[alloy];
      const sku = ALLOY_TO_SG_SKU[alloy];
      const metalGrams = round2(24 + Math.floor(rng() * 19));

      const sgJob: JewelryJobSpec = {
        id: sgId,
        name: `${so.id} SG Mnt ${pad} (${alloy})`,
        alloy,
        soId: so.id,
        sgSku: sku,
        producesSgQty: 1,
        poType: 'SG-STOCK',
        modelType: 'SG-Mounting',
        releaseMin: rel,
        dueMin: sgDue,
        priority: Math.max(so.priority, 2),
        materialBom: { [metalId]: metalGrams },
        ops: [
          { stage: 'wax', durations: { 'wax-1': 22, 'wax-2': 24 } },
          { stage: 'cast', durations: castDurationsForAlloy(alloy) },
          { stage: 'file', durations: { 'file-1': 24, 'file-2': 26 } },
          { stage: 'wh-in', durations: { 'wh-io': 18 } },
        ],
      };
      sgJobs.push(sgJob);
      jobs.push(sgJob);
      so.sgPoIds.push(sgId);
      if (!so.models.includes('SG-Mounting')) so.models.push('SG-Mounting');

      // Paired FG-ASM PO consuming the SG mounting from Warehouse
      const fgPad = String(fgAsmCounter).padStart(2, '0');
      const fgId = `FG-A${fgPad}`;
      const isPave = fgAsmCounter % 3 === 0;
      const isPlain = fgAsmCounter % 5 === 0;
      const modelType = isPlain ? 'Asm-Band' : isPave ? 'Asm-Pavé' : 'Asm-Prong';
      const fgOps: JewelryOpSpec[] = [
        { stage: 'wh-out', durations: { 'wh-io': 18 } },
        { stage: 'asm', durations: { 'asm-1': 34 + (fgAsmCounter % 5), 'asm-2': 38 + (fgAsmCounter % 5) } },
      ];
      if (!isPlain) {
        fgOps.push(
          isPave
            ? { stage: 'set', durations: { 'set-pave': 64 + Math.floor(rng() * 21) } }
            : { stage: 'set', durations: { 'set-pave': 34, 'set-prong': 40 } },
        );
      }
      fgOps.push({ stage: 'polish', durations: { 'polish-a': 26, 'polish-b': 30 } });
      if (alloy !== '925' || fgAsmCounter % 2 === 0) {
        fgOps.push({ stage: 'plate', durations: { 'plate-1': 20, 'plate-2': 22 } });
      }
      fgOps.push({ stage: 'qc', durations: { 'qc-1': 14 } });

      const bom: Record<string, number> = {
        FINDINGS: isPave ? 2 : 1,
      };
      if (!isPlain) {
        bom['DIA-MELEE'] = round2(isPave ? 1.2 + Math.floor(rng() * 6) * 0.1 : 0.6);
      }

      const fgJob: JewelryJobSpec = {
        id: fgId,
        name: `${so.id} ${modelType} ${fgPad}`,
        alloy,
        soId: so.id,
        sgSku: sku,
        consumesSgQty: 1,
        poType: 'FG-FROM-SG',
        modelType,
        dependsOnJobId: sgId,
        releaseMin: rel,
        dueMin: so.dueMin,
        priority: so.priority,
        materialBom: bom,
        ops: fgOps,
      };
      jobs.push(fgJob);
      so.fgPoIds.push(fgId);
      if (!so.models.includes(modelType)) so.models.push(modelType);

      sgCounter++;
      fgAsmCounter++;
    }
  }

  // 2) 4 additional FG-FROM-SG POs drawing directly from initial Warehouse SG safety stock
  const stockSoIndices = [0, 4, 8, 12];
  for (let k = 0; k < 4; k++) {
    const so = salesOrders[stockSoIndices[k]];
    const alloy = alloys[k];
    const sku = ALLOY_TO_SG_SKU[alloy];
    const pad = String(fgAsmCounter).padStart(2, '0');
    const fgId = `FG-A${pad}`;
    const isPave = k % 2 === 1;
    const modelType = isPave ? 'WH-Pavé-Asm' : 'WH-Prong-Asm';
    const fgOps: JewelryOpSpec[] = [
      { stage: 'wh-out', durations: { 'wh-io': 18 } },
      { stage: 'asm', durations: { 'asm-1': 36, 'asm-2': 40 } },
      isPave
        ? { stage: 'set', durations: { 'set-pave': 68 } }
        : { stage: 'set', durations: { 'set-pave': 34, 'set-prong': 40 } },
      { stage: 'polish', durations: { 'polish-a': 26, 'polish-b': 30 } },
      { stage: 'plate', durations: { 'plate-1': 20, 'plate-2': 22 } },
      { stage: 'qc', durations: { 'qc-1': 14 } },
    ];
    jobs.push({
      id: fgId,
      name: `${so.id} ${modelType} ${pad}`,
      alloy,
      soId: so.id,
      sgSku: sku,
      consumesSgQty: 1,
      poType: 'FG-FROM-SG',
      modelType,
      releaseMin: releaseMinForOrderDay(so.orderDay, 180),
      dueMin: so.dueMin,
      priority: so.priority,
      materialBom: {
        FINDINGS: 2,
        'DIA-MELEE': isPave ? 1.4 : 0.7,
      },
      ops: fgOps,
    });
    so.fgPoIds.push(fgId);
    if (!so.models.includes(modelType)) so.models.push(modelType);
    fgAsmCounter++;
  }

  // 3) 20 FG-FULL Bespoke POs (one per SO across 4 distinct workflows)
  for (let k = 1; k <= 20; k++) {
    const so = salesOrders[k - 1];
    const alloy = alloys[k % 4];
    const metalId = ALLOY_TO_METAL[alloy];
    const modelKind = k % 4;
    const rel = releaseMinForOrderDay(so.orderDay, 200);
    const ops: JewelryOpSpec[] = [
      { stage: 'wax', durations: { 'wax-1': 24, 'wax-2': 26 } },
      { stage: 'cast', durations: castDurationsForAlloy(alloy) },
    ];

    let modelType = 'Plain Band';
    let diamondCt = 0;
    if (modelKind === 0) {
      modelType = 'Plain Band';
      ops.push(
        { stage: 'file', durations: { 'file-1': 24, 'file-2': 26 } },
        { stage: 'asm', durations: { 'asm-1': 30, 'asm-2': 34 } },
        { stage: 'polish', durations: { 'polish-a': 28, 'polish-b': 32 } },
        { stage: 'qc', durations: { 'qc-1': 14 } },
      );
    } else if (modelKind === 1) {
      modelType = 'Solitaire Ring';
      diamondCt = 0.8;
      ops.push(
        { stage: 'file', durations: { 'file-1': 24, 'file-2': 26 } },
        { stage: 'asm', durations: { 'asm-1': 32, 'asm-2': 36 } },
        { stage: 'set', durations: { 'set-pave': 36, 'set-prong': 42 } },
        { stage: 'polish', durations: { 'polish-a': 28, 'polish-b': 32 } },
        { stage: 'plate', durations: { 'plate-1': 20, 'plate-2': 22 } },
        { stage: 'qc', durations: { 'qc-1': 14 } },
      );
    } else if (modelKind === 2) {
      modelType = 'Micro-Pavé Halo';
      diamondCt = 1.6;
      ops.push(
        { stage: 'pre-polish', durations: { 'polish-a': 26, 'polish-b': 30 }, reentrant: true },
        { stage: 'asm', durations: { 'asm-1': 32, 'asm-2': 36 } },
        { stage: 'set', durations: { 'set-pave': 70 + Math.floor(rng() * 19) } },
        { stage: 'polish', durations: { 'polish-a': 28, 'polish-b': 32 }, reentrant: true },
        { stage: 'plate', durations: { 'plate-1': 20, 'plate-2': 22 } },
        { stage: 'qc', durations: { 'qc-1': 14 } },
      );
    } else {
      modelType = 'Bezel Pendant';
      diamondCt = 0.6;
      ops.push(
        { stage: 'file', durations: { 'file-1': 24, 'file-2': 26 } },
        { stage: 'asm', durations: { 'asm-1': 30, 'asm-2': 34 } },
        { stage: 'set', durations: { 'set-pave': 36, 'set-prong': 42 } },
        { stage: 'polish', durations: { 'polish-a': 28, 'polish-b': 32 } },
        { stage: 'qc', durations: { 'qc-1': 14 } },
      );
    }

    const metalGrams = round2(24 + Math.floor(rng() * 19));
    const bom: Record<string, number> = {
      [metalId]: metalGrams,
      FINDINGS: modelKind === 2 ? 2 : 1,
    };
    if (diamondCt > 0) bom['DIA-MELEE'] = diamondCt;

    const pad = String(k).padStart(2, '0');
    const fgId = `FG-F${pad}`;
    jobs.push({
      id: fgId,
      name: `${so.id} ${modelType} ${pad}`,
      alloy,
      soId: so.id,
      poType: 'FG-FULL',
      modelType,
      releaseMin: rel,
      dueMin: so.dueMin,
      priority: so.priority,
      materialBom: bom,
      ops,
    });
    so.fgPoIds.push(fgId);
    if (!so.models.includes(modelType)) so.models.push(modelType);
  }

  const initialMaterialStock: Record<MaterialId, number> = {
    'AU-18KY': 150,
    'AU-18KR': 130,
    'AG-925': 180,
    'PT-950': 60,
    'DIA-MELEE': 8,
    FINDINGS: 22,
  };

  const initialSgStock: Record<SgSku, number> = {
    'SG-18KY-MNT': 2,
    'SG-18KR-MNT': 2,
    'SG-925-MNT': 2,
    'SG-PT950-MNT': 2,
  };

  const plannedMaterialPos = planMrpProcurement(jobs, initialMaterialStock);

  // Compute realistic SO selling revenue from BOM cost + multi-model value-added margin
  const jobsBySo = new Map<string, JewelryJobSpec[]>();
  for (const job of jobs) {
    if (!job.soId) continue;
    const list = jobsBySo.get(job.soId) ?? [];
    list.push(job);
    jobsBySo.set(job.soId, list);
  }
  for (const so of salesOrders) {
    const soJobs = jobsBySo.get(so.id) ?? [];
    let bomCost = 0;
    for (const j of soJobs) {
      for (const [matId, qty] of Object.entries(j.materialBom ?? {})) {
        bomCost += qty * (MATERIAL_CATALOG[matId as MaterialId]?.unitCostUsd ?? 0);
      }
    }
    const craftFee = so.fgPoIds.length * 1450 + (so.priority === 3 ? 2400 : 0);
    so.revenueUsd = Math.round(bomCost * 2.45 + craftFee);
  }

  return {
    presetId: 'fjsp-jewelry-erp',
    shiftMinPerDay: SHIFT_MIN_PER_DAY,
    startingCashUsd: 95_000,
    salesOrders,
    jobs,
    initialMaterialStock,
    initialSgStock,
    plannedMaterialPos,
  };
}

function emptyErpMetrics(scenario: ErpScenario): ErpPlanMetrics {
  return {
    feasible: false,
    makespanDays: 0,
    totalSos: scenario.salesOrders.length,
    onTimeSos: 0,
    lateSos: scenario.salesOrders.length,
    soWeightedTardinessDays: 0,
    materialStockouts: 0,
    sgStockouts: 0,
    salesOrders: [],
    materials: [],
    sgWarehouse: [],
    cashFlow: {
      startingCashUsd: scenario.startingCashUsd,
      totalInflowsUsd: 0,
      totalOutflowsUsd: 0,
      netOperatingCashUsd: 0,
      minCashUsd: scenario.startingCashUsd,
      minCashDay: 1,
      endingCashUsd: scenario.startingCashUsd,
      avgCashConversionDays: 0,
      cashShortfall: false,
      daily: [],
    },
  };
}

/**
 * Evaluate SO delivery performance, time-phased MRP material balances, SG Warehouse
 * round-trip ledgers, and daily working-capital Cash Flow for a scheduled FJSP solution.
 */
export function evaluateErpSchedule(
  scenario: ErpScenario,
  solution: FjspSolution,
): ErpPlanMetrics {
  if (!solution.feasible) {
    return emptyErpMetrics(scenario);
  }

  const shift = scenario.shiftMinPerDay;
  const jobStartMin = new Map<string, number>();
  const jobEndMin = new Map<string, number>();
  const opsByJob = new Map<string, typeof solution.ops>();

  for (const op of solution.ops) {
    const prevS = jobStartMin.get(op.jobId);
    jobStartMin.set(op.jobId, prevS === undefined ? op.startMin : Math.min(prevS, op.startMin));
    const prevE = jobEndMin.get(op.jobId);
    jobEndMin.set(op.jobId, prevE === undefined ? op.endMin : Math.max(prevE, op.endMin));
    const list = opsByJob.get(op.jobId) ?? [];
    list.push(op);
    opsByJob.set(op.jobId, list);
  }

  // 1) SO -> Multi-PO completion rollup
  let onTimeSos = 0;
  let soWeightedTardinessDays = 0;
  const soStatuses: SoScheduleStatus[] = [];

  for (const so of scenario.salesOrders) {
    let completionMin = 0;
    for (const fgId of so.fgPoIds) {
      completionMin = Math.max(completionMin, jobEndMin.get(fgId) ?? 0);
    }
    const shipDay = Math.max(1, Math.floor((Math.max(1, completionMin) - 1) / shift) + 1);
    const tardyDays = Math.max(0, shipDay - so.dueDay);
    const onTime = tardyDays === 0;
    if (onTime) onTimeSos++;
    soWeightedTardinessDays += so.priority * tardyDays;

    soStatuses.push({
      soId: so.id,
      customer: so.customer,
      orderDay: so.orderDay,
      dueDay: so.dueDay,
      priority: so.priority,
      poCount: so.fgPoIds.length + so.sgPoIds.length,
      fgCount: so.fgPoIds.length,
      sgCount: so.sgPoIds.length,
      models: so.models,
      completionMin,
      shipDay,
      tardyDays,
      onTime,
      balanceDay: shipDay + so.paymentNetDays,
      revenueUsd: so.revenueUsd,
    });
  }

  // 2) Time-phased MRP Raw Material ledger
  const materials: MaterialLedgerRow[] = [];
  let materialStockouts = 0;

  for (const matId of Object.keys(MATERIAL_CATALOG) as MaterialId[]) {
    const spec = MATERIAL_CATALOG[matId];
    const initialQty = scenario.initialMaterialStock[matId] ?? 0;
    const events: Array<{ time: number; order: number; delta: number }> = [];
    let plannedReceiptsQty = 0;
    let consumedQty = 0;
    let procurementCostUsd = 0;
    let poCount = 0;

    for (const po of scenario.plannedMaterialPos) {
      if (po.materialId !== matId) continue;
      plannedReceiptsQty = round2(plannedReceiptsQty + po.qty);
      procurementCostUsd = round2(procurementCostUsd + po.totalCostUsd);
      poCount++;
      events.push({ time: po.arrivalMin, order: 0, delta: po.qty });
    }

    for (const job of scenario.jobs) {
      const qty = job.materialBom?.[matId] ?? 0;
      if (qty <= 0) continue;
      consumedQty = round2(consumedQty + qty);
      const consumeAt = jobStartMin.get(job.id) ?? job.releaseMin;
      events.push({ time: consumeAt, order: 1, delta: -qty });
    }

    events.sort((a, b) => a.time - b.time || a.order - b.order);
    let balance = initialQty;
    let minBalanceQty = balance;
    let rowStockouts = 0;
    for (const ev of events) {
      balance = round2(balance + ev.delta);
      if (balance < minBalanceQty) minBalanceQty = balance;
      if (balance < -1e-6) rowStockouts++;
    }
    materialStockouts += rowStockouts;

    materials.push({
      materialId: matId,
      label: spec.label,
      unit: spec.unit,
      initialQty,
      plannedReceiptsQty,
      consumedQty,
      endingQty: balance,
      minBalanceQty,
      stockoutCount: rowStockouts,
      procurementCostUsd,
      poCount,
    });
  }

  // 3) SG Warehouse Put-Away & Issue ledger
  const sgWarehouse: SgWarehouseRow[] = [];
  let sgStockouts = 0;

  for (const sku of Object.keys(SG_SKU_LABELS) as SgSku[]) {
    const initialQty = scenario.initialSgStock[sku] ?? 0;
    const events: Array<{ time: number; order: number; delta: number }> = [];
    let receivedFromShopQty = 0;
    let issuedToAssemblyQty = 0;

    for (const job of scenario.jobs) {
      if (job.sgSku !== sku) continue;
      const jobOps = opsByJob.get(job.id) ?? [];
      if (job.producesSgQty && job.producesSgQty > 0) {
        const whInOp = jobOps.find((o) => o.stage === 'wh-in') ?? jobOps[jobOps.length - 1];
        const putAwayTime = whInOp?.endMin ?? jobEndMin.get(job.id) ?? 0;
        receivedFromShopQty += job.producesSgQty;
        events.push({ time: putAwayTime, order: 0, delta: job.producesSgQty });
      }
      if (job.consumesSgQty && job.consumesSgQty > 0) {
        const whOutOp = jobOps.find((o) => o.stage === 'wh-out') ?? jobOps[0];
        const pickTime = whOutOp?.startMin ?? jobStartMin.get(job.id) ?? 0;
        issuedToAssemblyQty += job.consumesSgQty;
        events.push({ time: pickTime, order: 1, delta: -job.consumesSgQty });
      }
    }

    events.sort((a, b) => a.time - b.time || a.order - b.order);
    let balance = initialQty;
    let minBalanceQty = balance;
    let rowStockouts = 0;
    for (const ev of events) {
      balance += ev.delta;
      if (balance < minBalanceQty) minBalanceQty = balance;
      if (balance < 0) rowStockouts++;
    }
    sgStockouts += rowStockouts;

    sgWarehouse.push({
      sku,
      label: SG_SKU_LABELS[sku],
      initialQty,
      receivedFromShopQty,
      issuedToAssemblyQty,
      endingQty: balance,
      minBalanceQty,
      stockoutCount: rowStockouts,
    });
  }

  // 4) Daily Cash Flow & Working Capital
  const makespanDays = Math.max(1, Math.ceil(solution.makespanMin / shift));
  const horizonDays = Math.max(
    makespanDays + 1,
    ...soStatuses.map((s) => s.balanceDay),
    ...scenario.plannedMaterialPos.map((p) => Math.max(p.arrivalDay, p.paymentDay)),
  );

  const activeMinByDay = new Map<number, number>();
  const setupsByDay = new Map<number, number>();
  for (const op of solution.ops) {
    const d = Math.floor(op.startMin / shift) + 1;
    activeMinByDay.set(d, (activeMinByDay.get(d) ?? 0) + op.durMin);
    if (op.setupMin > 0) {
      setupsByDay.set(d, (setupsByDay.get(d) ?? 0) + 1);
    }
  }

  const jobCostInfo = scenario.jobs.map((job) => {
    let matCost = 0;
    for (const [mId, qty] of Object.entries(job.materialBom ?? {})) {
      matCost += qty * (MATERIAL_CATALOG[mId as MaterialId]?.unitCostUsd ?? 0);
    }
    const sMin = jobStartMin.get(job.id) ?? 0;
    const eMin = jobEndMin.get(job.id) ?? sMin;
    return {
      startDay: Math.floor(sMin / shift) + 1,
      endDay: Math.floor(Math.max(sMin, eMin - 1) / shift) + 1,
      matCost,
    };
  });

  const soByOrderDay = new Map<number, number>();
  const soByBalanceDay = new Map<number, number>();
  for (let i = 0; i < scenario.salesOrders.length; i++) {
    const so = scenario.salesOrders[i];
    const st = soStatuses[i];
    const depositUsd = round2(so.revenueUsd * so.depositPct);
    const balanceUsd = round2(so.revenueUsd - depositUsd);
    soByOrderDay.set(so.orderDay, round2((soByOrderDay.get(so.orderDay) ?? 0) + depositUsd));
    soByBalanceDay.set(st.balanceDay, round2((soByBalanceDay.get(st.balanceDay) ?? 0) + balanceUsd));
  }

  const matPayByDay = new Map<number, number>();
  for (const po of scenario.plannedMaterialPos) {
    matPayByDay.set(po.paymentDay, round2((matPayByDay.get(po.paymentDay) ?? 0) + po.totalCostUsd));
  }

  const daily: DailyCashFlowRow[] = [];
  let runningCash = scenario.startingCashUsd;
  let totalInflowsUsd = 0;
  let totalOutflowsUsd = 0;
  let minCashUsd = runningCash;
  let minCashDay = 1;

  for (let d = 1; d <= horizonDays; d++) {
    const inflowDepositUsd = round2(soByOrderDay.get(d) ?? 0);
    const inflowBalanceUsd = round2(soByBalanceDay.get(d) ?? 0);
    const outflowMaterialUsd = round2(matPayByDay.get(d) ?? 0);
    const outflowLaborUsd =
      d <= makespanDays
        ? round2(2800 + (activeMinByDay.get(d) ?? 0) * 0.45 + (setupsByDay.get(d) ?? 0) * 45)
        : 0;
    let wipValue = 0;
    for (const jc of jobCostInfo) {
      if (jc.startDay <= d && d <= jc.endDay) wipValue += jc.matCost;
    }
    const outflowOverheadWipUsd = round2(wipValue * 0.0025);

    const dayIn = round2(inflowDepositUsd + inflowBalanceUsd);
    const dayOut = round2(outflowMaterialUsd + outflowLaborUsd + outflowOverheadWipUsd);
    const netUsd = round2(dayIn - dayOut);
    runningCash = round2(runningCash + netUsd);

    totalInflowsUsd = round2(totalInflowsUsd + dayIn);
    totalOutflowsUsd = round2(totalOutflowsUsd + dayOut);

    if (d === 1 || runningCash < minCashUsd) {
      minCashUsd = runningCash;
      minCashDay = d;
    }

    daily.push({
      day: d,
      inflowDepositUsd,
      inflowBalanceUsd,
      outflowMaterialUsd,
      outflowLaborUsd,
      outflowOverheadWipUsd,
      netUsd,
      closingCashUsd: runningCash,
    });
  }

  const avgCashConversionDays =
    soStatuses.length > 0
      ? round2(
          soStatuses.reduce((sum, s) => sum + (s.balanceDay - s.orderDay), 0) / soStatuses.length,
        )
      : 0;

  return {
    feasible: true,
    makespanDays,
    totalSos: scenario.salesOrders.length,
    onTimeSos,
    lateSos: scenario.salesOrders.length - onTimeSos,
    soWeightedTardinessDays,
    materialStockouts,
    sgStockouts,
    salesOrders: soStatuses,
    materials,
    sgWarehouse,
    cashFlow: {
      startingCashUsd: scenario.startingCashUsd,
      totalInflowsUsd,
      totalOutflowsUsd,
      netOperatingCashUsd: round2(totalInflowsUsd - totalOutflowsUsd),
      minCashUsd,
      minCashDay,
      endingCashUsd: runningCash,
      avgCashConversionDays,
      cashShortfall: minCashUsd < 0,
      daily,
    },
  };
}

/**
 * Evaluate both Greedy Baseline and Two-Level Master Scheduler against the ERP model
 * to quantify SO delivery, working capital minimum, and ending cash gains.
 */
export function evaluateErpComparison(
  scenario: ErpScenario,
  comparison: TwoLevelComparison,
): ErpComparison {
  const greedyBaseline = evaluateErpSchedule(scenario, comparison.greedyBaseline);
  const twoLevel = evaluateErpSchedule(scenario, comparison.twoLevel);

  const greedyWeightedTard = greedyBaseline.salesOrders.reduce((s, o) => s + o.priority * o.tardyDays, 0);
  const twoWeightedTard = twoLevel.salesOrders.reduce((s, o) => s + o.priority * o.tardyDays, 0);

  return {
    scenario,
    greedyBaseline,
    twoLevel,
    makespanDaysSaved:
      greedyBaseline.feasible && twoLevel.feasible
        ? round2(
            (comparison.greedyBaseline.makespanMin - comparison.twoLevel.makespanMin) /
              scenario.shiftMinPerDay,
          )
        : 0,
    soTardinessDaysSaved:
      greedyBaseline.feasible && twoLevel.feasible ? greedyWeightedTard - twoWeightedTard : 0,
    endingCashDeltaUsd:
      greedyBaseline.feasible && twoLevel.feasible
        ? round2(twoLevel.cashFlow.endingCashUsd - greedyBaseline.cashFlow.endingCashUsd)
        : 0,
    minCashDeltaUsd:
      greedyBaseline.feasible && twoLevel.feasible
        ? round2(twoLevel.cashFlow.minCashUsd - greedyBaseline.cashFlow.minCashUsd)
        : 0,
    cccDaysSaved:
      greedyBaseline.feasible && twoLevel.feasible
        ? round2(
            greedyBaseline.cashFlow.avgCashConversionDays - twoLevel.cashFlow.avgCashConversionDays,
          )
        : 0,
  };
}
