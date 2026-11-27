import { describe, expect, it } from 'vitest';
import { buildExplicitGraph } from './graph';
import { createRandom } from './random';
import { step } from './sim';
import {
  SYSTEMS_SCENARIOS,
  applySystemsConditions,
  createDefaultSystemsConditions,
  evaluateSystemsScenario,
  exportSystemsJson,
  getSystemsScenario,
} from './systems';

function runScenario(
  id: string,
  stepsCount = 420,
  mutate?: (cond: ReturnType<typeof createDefaultSystemsConditions>) => void,
) {
  const spec = getSystemsScenario(id);
  expect(spec).not.toBeNull();
  const s = spec!;
  const graph = buildExplicitGraph(s.nodes, s.explicitEdges, createRandom(7101));
  const cond = createDefaultSystemsConditions(s);
  if (mutate) mutate(cond);
  applySystemsConditions(graph, s, cond);

  let metrics = step(graph, 1.0, 0.05, { flowMode: 'source-sink', dynamicsMode: 'linear-lp' });
  for (let i = 1; i < stepsCount; i++) {
    metrics = step(graph, 1.0, 0.05, {
      flowMode: 'source-sink',
      dynamicsMode: 'linear-lp',
      prevPressures: metrics.pressures,
    });
  }
  const evaluation = evaluateSystemsScenario(graph, s, cond);
  return { spec: s, graph, cond, metrics, evaluation };
}

describe('systems control-plane scenarios', () => {
  it('simulates all 6 distributed systems scenarios cleanly with finite metrics and convergence', () => {
    expect(SYSTEMS_SCENARIOS).toHaveLength(6);
    for (const scenario of SYSTEMS_SCENARIOS) {
      const { evaluation, metrics } = runScenario(scenario.id, 420);
      expect(Number.isFinite(evaluation.physarum.avgCost)).toBe(true);
      expect(Number.isFinite(evaluation.physarum.dropPct)).toBe(true);
      expect(Number.isFinite(evaluation.physarum.successPct)).toBe(true);
      expect(evaluation.physarum.dropPct).toBeLessThan(1.5);
      expect(evaluation.physarum.successPct).toBeGreaterThan(95);
      expect(metrics.maxChange).toBeLessThan(5e-4);
    }
  });

  it('spills 1.8x payment traffic across PromptPay/Omise/2C2P/Stripe with lower drops than static router', () => {
    const surge = runScenario('sys-payment', 420, (cond) => {
      cond.trafficMultiplier = 1.8;
    });
    expect(surge.evaluation.totalDemand).toBe(1800);
    expect(surge.evaluation.physarum.maxLambda).toBeGreaterThan(0.05);
    expect(surge.evaluation.physarum.dropPct).toBeLessThan(surge.evaluation.staticBaseline.dropPct);
    expect(surge.evaluation.physarum.dropPct).toBeLessThan(2);

    const cutPromptPay = runScenario('sys-payment', 420, (cond) => {
      cond.rails.promptpay.offline = true;
    });
    const pp = cutPromptPay.evaluation.rails.find((r) => r.id === 'promptpay')!;
    expect(pp.offline).toBe(true);
    expect(pp.sharePct).toBe(0);
    expect(cutPromptPay.evaluation.physarum.dropPct).toBeLessThan(1);
    expect(cutPromptPay.evaluation.physarum.dropPct).toBeLessThan(
      cutPromptPay.evaluation.staticBaseline.dropPct,
    );
  });

  it('spills multi-region LLM GPU gateway overflow away from Geo-DNS saturation', () => {
    const { evaluation } = runScenario('sys-llm-gateway', 280, (cond) => {
      cond.trafficMultiplier = 1.8;
    });
    expect(evaluation.physarum.maxLambda).toBeGreaterThan(0.05);
    expect(evaluation.physarum.dropPct).toBeLessThan(evaluation.staticBaseline.dropPct);
    const gpuUs = evaluation.rails.find((r) => r.id === 'gpu-us')!;
    expect(gpuUs.sharePct).toBeGreaterThan(20);
  });

  it('recovers edge-fog-cloud offloading locally onto Local NPU + Pi5 when Cloud WAN is cut', () => {
    const wanCut = runScenario('sys-edge-cloud', 240, (cond) => {
      cond.rails['cloud-gpu'].offline = true;
    });
    const npu = wanCut.evaluation.rails.find((r) => r.id === 'local-npu')!;
    const pi5 = wanCut.evaluation.rails.find((r) => r.id === 'pi5-fog')!;
    const cloud = wanCut.evaluation.rails.find((r) => r.id === 'cloud-gpu')!;
    expect(cloud.sharePct).toBe(0);
    expect(npu.sharePct + pi5.sharePct).toBeGreaterThan(80);
    expect(wanCut.evaluation.physarum.successPct).toBeGreaterThan(
      wanCut.evaluation.staticBaseline.successPct,
    );
  });

  it('propagates Envoy microservice mesh DB bottleneck backpressure (λ_e) into fallback cache', () => {
    const mesh = runScenario('sys-service-mesh', 280, (cond) => {
      cond.trafficMultiplier = 1.35;
    });
    const db = mesh.evaluation.rails.find((r) => r.id === 'db-primary')!;
    const cache = mesh.evaluation.rails.find((r) => r.id === 'fallback-cache')!;
    expect(db.shadowPriceLambda).toBeGreaterThan(0.05);
    expect(cache.sharePct).toBeGreaterThan(35);
    expect(mesh.evaluation.physarum.dropPct).toBeLessThan(mesh.evaluation.staticBaseline.dropPct);
  });

  it('reroutes DB read-replica traffic away from lagged replica when extra cost is injected', () => {
    const base = runScenario('sys-db-router', 240);
    const lagged = runScenario('sys-db-router', 240, (cond) => {
      cond.rails['replica-1'].extraCost = 2.5;
    });
    const rep1Base = base.evaluation.rails.find((r) => r.id === 'replica-1')!.sharePct;
    const rep1Lag = lagged.evaluation.rails.find((r) => r.id === 'replica-1')!.sharePct;
    expect(rep1Lag).toBeLessThan(rep1Base);

    const exported = JSON.parse(
      exportSystemsJson(lagged.graph, lagged.spec, lagged.cond, lagged.evaluation, {
        seed: 7106,
        iteration: 240,
      }),
    );
    expect(exported.scenarioId).toBe('sys-db-router');
    expect(exported.evaluation.rails).toHaveLength(4);
  });
});
