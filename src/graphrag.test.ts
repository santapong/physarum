import { describe, expect, it } from 'vitest';
import { buildExplicitGraph } from './graph';
import { applyViewerScope, computePprScores, evaluateGraphRag } from './graphrag';
import { getPreset } from './presets';
import { createRandom } from './random';
import { step } from './sim';

function buildPresetGraph(presetId: string) {
  const preset = getPreset(presetId);
  const rand = createRandom(preset.seed);
  return {
    preset,
    graph: buildExplicitGraph(preset.nodes, preset.explicitEdges ?? [], rand),
  };
}

describe('GraphRAG multi-hop evidence verification (Lab 5)', () => {
  it('prunes noise, builds hub shadow price λ_e, and beats the PPR hub trap on Sensors', () => {
    const { preset, graph } = buildPresetGraph('graphrag-tender-sensors');
    applyViewerScope(graph, 'buyer');

    for (let i = 0; i < 220; i++) {
      step(graph, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const evalRes = evaluateGraphRag(graph, 'buyer');
    const siam = evalRes.candidates.find((c) => c.label.includes('SiamSensor'))!;
    const hub = evalRes.candidates.find((c) => c.role === 'hub')!;

    expect(hub.pprRank).toBe(1);
    expect(evalRes.pprHubTrapDetected).toBe(true);
    expect(siam.physarumRank).toBe(1);
    expect(siam.rawPhysarumRank).toBe(1);
    expect(siam.status).toBe('eligible');
    expect(hub.maxShadowPrice).toBeGreaterThan(0.1);
    expect(evalRes.verdict).toBe('ready');
    expect(evalRes.topCandidateId).toBe(siam.nodeId);
    expect(evalRes.noiseEdgesTotal).toBeGreaterThan(0);
    expect(evalRes.noisePrunedPct).toBe(100);
  });

  it('drops hub shadow price to 0 and shifts Physarum flux to the hub when caps are removed', () => {
    const { preset, graph: capped } = buildPresetGraph('graphrag-tender-sensors');
    const { graph: uncapped } = buildPresetGraph('graphrag-tender-sensors');
    for (const edge of uncapped.edges) {
      delete edge.capacity;
    }

    applyViewerScope(capped, 'buyer');
    applyViewerScope(uncapped, 'buyer');
    for (let i = 0; i < 220; i++) {
      step(capped, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
      step(uncapped, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const cappedEval = evaluateGraphRag(capped, 'buyer');
    const uncappedEval = evaluateGraphRag(uncapped, 'buyer');
    const cappedHub = cappedEval.candidates.find((c) => c.role === 'hub')!;
    const uncappedHub = uncappedEval.candidates.find((c) => c.role === 'hub')!;

    expect(uncappedHub.maxShadowPrice).toBe(0);
    expect(uncappedHub.physarumFlux).toBeGreaterThan(cappedHub.physarumFlux * 1.5);
  });

  it('flags SiamSensor as Needs review and reroutes to Eastern Offer B when T02 Pack-of-10 is cut', () => {
    const { preset, graph } = buildPresetGraph('graphrag-tender-sensors');
    const t02Edge = graph.edges.find((e) => e.relation === 'T02 Pack-of-10')!;
    t02Edge.severed = true;
    t02Edge.D = 0;
    t02Edge.flow = 0;

    applyViewerScope(graph, 'buyer');
    for (let i = 0; i < 220; i++) {
      step(graph, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const evalRes = evaluateGraphRag(graph, 'buyer');
    const siam = evalRes.candidates.find((c) => c.label.includes('SiamSensor'))!;
    const eastern = evalRes.candidates.find((c) => c.label.includes('Eastern'))!;

    expect(siam.status).toBe('needs-review');
    expect(siam.missingTerminals).toContain(1);
    expect(eastern.status).toBe('eligible');
    expect(eastern.physarumRank).toBe(1);
    expect(evalRes.verdict).toBe('ready');
    expect(evalRes.topCandidateId).toBe(eastern.nodeId);
  });

  it('starts Apex expired ISO certificate severed and marks Apex as Needs review (missing Q3)', () => {
    const { preset, graph } = buildPresetGraph('graphrag-tender-sensors');
    applyViewerScope(graph, 'buyer');
    for (let i = 0; i < 120; i++) {
      step(graph, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const evalRes = evaluateGraphRag(graph, 'buyer');
    const apex = evalRes.candidates.find((c) => c.label.includes('Apex'))!;
    expect(apex.status).toBe('needs-review');
    expect(apex.missingTerminals).toContain(2);
    expect(evalRes.severedEdgesCount).toBeGreaterThanOrEqual(2);
  });

  it('enforces T04 cross-room isolation when viewing as room-eastern', () => {
    const { preset, graph } = buildPresetGraph('graphrag-tender-sensors');
    const blocked = applyViewerScope(graph, 'room-eastern');
    expect(blocked).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < 160; i++) {
      step(graph, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const evalRes = evaluateGraphRag(graph, 'room-eastern');
    const pprScores = computePprScores(graph, evalRes.queryTerminalIds, 'room-eastern');
    const roomANode = graph.nodes.find((n) => n.room === 'room-siam')!;

    expect(evalRes.hiddenPrivateEdges).toBeGreaterThanOrEqual(2);
    expect(pprScores[roomANode.id]).toBe(0);
    for (const edge of graph.edges) {
      if (edge.room === 'room-siam') {
        expect(edge.scopeBlocked).toBe(true);
        expect(edge.flow).toBe(0);
      }
    }
    for (const cit of evalRes.citations) {
      expect(cit.evidenceRef).not.toContain('room-siam');
    }
  });

  it('triggers global Needs review on Salon B1/C5 gap when Doc-Install-A is severed', () => {
    const { preset, graph } = buildPresetGraph('graphrag-salon-gap');
    const installEdge = graph.edges.find((e) => e.relation === 'On-Site Install')!;
    installEdge.severed = true;
    installEdge.D = 0;
    installEdge.flow = 0;

    applyViewerScope(graph, 'buyer');
    for (let i = 0; i < 160; i++) {
      step(graph, preset.mu ?? 1.0, 0.08, {
        flowMode: 'multi-terminal',
        dynamicsMode: 'linear-lp',
        deterministicAllPairs: true,
      });
    }

    const evalRes = evaluateGraphRag(graph, 'buyer');
    expect(evalRes.verdict).toBe('needs-review');
    expect(evalRes.missingRequirementIds).toContain(2);
  });
});
