import { describe, expect, it } from 'vitest';
import {
  exportFjspCpSatPython,
  getCellsForPreset,
  SHIFT_MIN_PER_DAY,
  solveTwoLevelFjsp,
} from './fjsp';
import { buildExplicitGraph, severEdgeNear } from './graph';
import { buildErpJewelryScenario, evaluateErpComparison } from './mrp';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';

function runUpperSteps(graph: ReturnType<typeof buildExplicitGraph>, count: number): void {
  let prevPressures: number[] = [];
  for (let i = 0; i < count; i++) {
    const m = step(graph, 1.0, 0.05, {
      dynamicsMode: 'linear-lp',
      prevPressures,
    });
    prevPressures = m.pressures;
  }
}

describe('jewelry ERP master scheduler (560m/d + SO->PO + Warehouse SG->Asm->FG + MRP + Cash Flow)', () => {
  it('builds 20 SOs spanning 80 multi-model POs with Warehouse round-trip workflows', () => {
    const scenario = buildErpJewelryScenario();
    expect(scenario.shiftMinPerDay).toBe(560);
    expect(scenario.salesOrders).toHaveLength(20);
    expect(scenario.jobs).toHaveLength(80);
    expect(scenario.jobs.every((j) => Boolean(j.soId))).toBe(true);

    for (const so of scenario.salesOrders) {
      expect(so.fgPoIds.length + so.sgPoIds.length).toBeGreaterThanOrEqual(2);
      expect(so.models.length).toBeGreaterThanOrEqual(2);
    }

    const sgJobs = scenario.jobs.filter((j) => j.poType === 'SG-STOCK');
    const fgAsmJobs = scenario.jobs.filter((j) => j.poType === 'FG-FROM-SG');
    const fgFullJobs = scenario.jobs.filter((j) => j.poType === 'FG-FULL');
    expect(sgJobs).toHaveLength(28);
    expect(fgAsmJobs).toHaveLength(32);
    expect(fgFullJobs).toHaveLength(20);
    expect(sgJobs.every((j) => j.ops[j.ops.length - 1].stage === 'wh-in')).toBe(true);
    expect(
      fgAsmJobs.every((j) => j.ops[0].stage === 'wh-out' && j.ops[1].stage === 'asm'),
    ).toBe(true);
  });

  it('converges 9-stage Factory+Warehouse Physarum DAG with forward flow', () => {
    const preset = getPreset('fjsp-jewelry-erp');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    runUpperSteps(graph, 240);

    const cellEdges = graph.edges.filter((e) => Boolean(e.cellId));
    expect(cellEdges.length).toBe(17);
    expect(cellEdges.every((e) => e.flow >= -1e-5)).toBe(true);
  });

  it('enforces 560 min/day shift boundaries, MRP gating, Warehouse SG balances, and beats Greedy on Cash Flow', () => {
    const preset = getPreset('fjsp-jewelry-erp');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    runUpperSteps(graph, 240);

    const scenario = buildErpJewelryScenario();
    const cells = getCellsForPreset(preset.id);
    const cmp = solveTwoLevelFjsp(graph, scenario.jobs, {
      physarumWeight: 0.9,
      refine: true,
      shiftMinPerDay: SHIFT_MIN_PER_DAY,
      cells,
    });

    expect(cmp.greedyBaseline.feasible).toBe(true);
    expect(cmp.twoLevel.feasible).toBe(true);
    expect(cmp.twoLevel.verification.valid).toBe(true);
    expect(cmp.twoLevel.verification.shiftViolations).toBe(0);
    expect(cmp.twoLevel.verification.materialViolations).toBe(0);
    expect(cmp.twoLevel.verification.bomViolations).toBe(0);
    expect(cmp.twoLevel.verification.overlapCount).toBe(0);
    expect(cmp.twoLevel.makespanMin).toBeLessThan(cmp.greedyBaseline.makespanMin);

    for (const op of cmp.twoLevel.ops) {
      expect(Math.floor(op.startMin / 560)).toBe(Math.floor((op.endMin - 1) / 560));
    }

    const erpCmp = evaluateErpComparison(scenario, cmp);
    expect(erpCmp.twoLevel.materialStockouts).toBe(0);
    expect(erpCmp.twoLevel.sgStockouts).toBe(0);
    for (const mat of erpCmp.twoLevel.materials) {
      expect(mat.minBalanceQty).toBeGreaterThanOrEqual(0);
    }
    for (const sg of erpCmp.twoLevel.sgWarehouse) {
      expect(sg.minBalanceQty).toBeGreaterThanOrEqual(0);
    }
    const totalRecv = erpCmp.twoLevel.sgWarehouse.reduce((s, r) => s + r.receivedFromShopQty, 0);
    const totalIssued = erpCmp.twoLevel.sgWarehouse.reduce((s, r) => s + r.issuedToAssemblyQty, 0);
    expect(totalRecv).toBe(28);
    expect(totalIssued).toBe(32);

    const totalSoRevenue = scenario.salesOrders.reduce((s, o) => s + o.revenueUsd, 0);
    const cf = erpCmp.twoLevel.cashFlow;
    expect(
      Math.abs(cf.endingCashUsd - (cf.startingCashUsd + cf.totalInflowsUsd - cf.totalOutflowsUsd)),
    ).toBeLessThan(1e-2);
    expect(Math.abs(cf.totalInflowsUsd - totalSoRevenue)).toBeLessThan(1e-2);
    expect(erpCmp.twoLevel.soWeightedTardinessDays).toBeLessThanOrEqual(
      erpCmp.greedyBaseline.soWeightedTardinessDays,
    );
    expect(erpCmp.twoLevel.cashFlow.endingCashUsd).toBeGreaterThanOrEqual(
      erpCmp.greedyBaseline.cashFlow.endingCashUsd,
    );
  });

  it('reroutes around severed kiln and detects infeasible Warehouse wh-io outage', () => {
    const preset = getPreset('fjsp-jewelry-erp');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    runUpperSteps(graph, 160);
    const scenario = buildErpJewelryScenario();
    const cells = getCellsForPreset(preset.id);

    // Sever cast-18k edge (nodes 5 <-> 6 midpoint (199, 145))
    const severedCast = severEdgeNear(graph, 199, 145, 14);
    expect(severedCast).not.toBeNull();
    runUpperSteps(graph, 160);

    const afterCastLoss = solveTwoLevelFjsp(graph, scenario.jobs, {
      shiftMinPerDay: SHIFT_MIN_PER_DAY,
      cells,
    });
    expect(afterCastLoss.offlineCells).toContain('cast-18k');
    expect(afterCastLoss.twoLevel.feasible).toBe(true);
    expect(afterCastLoss.twoLevel.verification.valid).toBe(true);
    expect(afterCastLoss.twoLevel.ops.some((op) => op.cellId === 'cast-18k')).toBe(false);

    // Sever sole Warehouse cell wh-io (nodes 15 <-> 16 midpoint (381, 300))
    const severedWh = severEdgeNear(graph, 381, 300, 14);
    expect(severedWh).not.toBeNull();
    const afterWhLoss = solveTwoLevelFjsp(graph, scenario.jobs, {
      shiftMinPerDay: SHIFT_MIN_PER_DAY,
      cells,
    });
    expect(afterWhLoss.offlineCells).toContain('wh-io');
    expect(afterWhLoss.twoLevel.feasible).toBe(false);
    expect(afterWhLoss.twoLevel.infeasibleReason).toContain('offline');
  });

  it('exports OR-Tools CP-SAT Python model encoding 560m/d shifts, SOs, and Warehouse/Assembly cells', () => {
    const preset = getPreset('fjsp-jewelry-erp');
    const graph = buildExplicitGraph(
      preset.nodes,
      preset.explicitEdges ?? [],
      createRandom(preset.seed),
    );
    runUpperSteps(graph, 160);
    const scenario = buildErpJewelryScenario();
    const cells = getCellsForPreset(preset.id);
    const cmp = solveTwoLevelFjsp(graph, scenario.jobs, {
      shiftMinPerDay: SHIFT_MIN_PER_DAY,
      cells,
    });

    const py = exportFjspCpSatPython(graph, scenario.jobs, cmp, {
      seed: preset.seed,
      iteration: 160,
      cells,
      shiftMinPerDay: SHIFT_MIN_PER_DAY,
      salesOrders: scenario.salesOrders.map((so) => ({
        id: so.id,
        dueMin: so.dueMin,
        priority: so.priority,
        fgPoIds: so.fgPoIds,
      })),
    });

    expect(py).toContain('SHIFT_MIN_PER_DAY = 560');
    expect(py).toContain('SALES_ORDERS');
    expect(py).toContain('wh-io');
    expect(py).toContain('asm-1');
    expect(py).toContain('AddNoOverlap');
    expect(py).toContain('AddHint');
  });
});
