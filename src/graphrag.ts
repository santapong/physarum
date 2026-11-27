import type { Edge, Graph, Node } from './graph';
import { effectiveEdgeCost } from './solver';

export type GraphRagViewerScope = 'buyer' | 'room-siam' | 'room-eastern';

export interface GraphRagCitation {
  edgeIndex: number;
  fromLabel: string;
  toLabel: string;
  relation: string;
  evidenceRef: string;
  flow: number;
  conductanceD: number;
  shadowPrice: number;
}

export interface GraphRagCandidateResult {
  nodeId: number;
  label: string;
  role: 'supplier' | 'hub';
  physarumFlux: number;
  physarumShare: number;
  physarumRank: number;
  rawPhysarumRank: number;
  pprScore: number;
  pprShare: number;
  pprRank: number;
  maxShadowPrice: number;
  status: 'eligible' | 'needs-review';
  coveredTerminals: number[];
  missingTerminals: number[];
  missingLabels: string[];
  citations: GraphRagCitation[];
}

export interface GraphRagBlockedOrSeveredEdge {
  edgeIndex: number;
  fromLabel: string;
  toLabel: string;
  relation: string;
  evidenceRef: string;
  reason: 'expired' | 'revoked' | 'scope-blocked';
}

export interface GraphRagEvaluation {
  viewerScope: GraphRagViewerScope;
  queryTerminalIds: number[];
  candidates: GraphRagCandidateResult[];
  verdict: 'ready' | 'needs-review';
  topCandidateId: number | null;
  topCandidateLabel: string | null;
  missingRequirementIds: number[];
  missingRequirementLabels: string[];
  pprHubTrapDetected: boolean;
  noiseEdgesTotal: number;
  noiseEdgesPruned: number;
  noisePrunedPct: number;
  hiddenPrivateEdges: number;
  severedEdgesCount: number;
  citations: GraphRagCitation[];
  auditEdges: GraphRagBlockedOrSeveredEdge[];
}

export function isNodeAuthorized(node: Node, scope: GraphRagViewerScope): boolean {
  if (!node.room) return true;
  if (scope === 'buyer') return true;
  return node.room === scope;
}

export function isEdgeAuthorized(
  graph: Graph,
  edge: Edge,
  scope: GraphRagViewerScope,
): boolean {
  const u = graph.nodes[edge.i];
  const v = graph.nodes[edge.j];
  if (!u || !v) return false;
  if (edge.room && scope !== 'buyer' && edge.room !== scope) {
    return false;
  }
  return isNodeAuthorized(u, scope) && isNodeAuthorized(v, scope);
}

/**
 * Apply T04 room-isolation fencing across all edges before solver execution.
 * Returns the number of edges blocked under the selected viewer scope.
 */
export function applyViewerScope(graph: Graph, scope: GraphRagViewerScope): number {
  let blockedCount = 0;
  for (const edge of graph.edges) {
    const authorized = isEdgeAuthorized(graph, edge, scope);
    const wasBlocked = Boolean(edge.scopeBlocked);
    edge.scopeBlocked = !authorized;
    if (!authorized) {
      edge.flow = 0;
      edge.congestion = 0;
      blockedCount++;
    } else if (wasBlocked && !edge.severed) {
      edge.D = Math.max(edge.D, 0.35);
    }
  }
  return blockedCount;
}

/**
 * Personalized PageRank baseline seeded uniformly over authorized query terminals.
 * Uses conductance weights `1 / effectiveEdgeCost` and ignores capacity shadow prices.
 */
export function computePprScores(
  graph: Graph,
  terminalIds: number[],
  scope: GraphRagViewerScope,
  alpha = 0.15,
): number[] {
  const n = graph.nodes.length;
  if (n === 0) return [];

  const authorizedTerminals = terminalIds.filter(
    (id) => id >= 0 && id < n && isNodeAuthorized(graph.nodes[id], scope),
  );
  if (authorizedTerminals.length === 0) {
    return new Array<number>(n).fill(0);
  }

  const seed = new Array<number>(n).fill(0);
  const seedMass = 1 / authorizedTerminals.length;
  for (const id of authorizedTerminals) {
    seed[id] = seedMass;
  }

  const adj: Array<Array<{ to: number; w: number }>> = Array.from({ length: n }, () => []);
  const weightedDeg = new Array<number>(n).fill(0);
  for (const edge of graph.edges) {
    if (edge.severed || edge.scopeBlocked || !isEdgeAuthorized(graph, edge, scope)) continue;
    const w = 1 / Math.max(effectiveEdgeCost(edge), 1e-6);
    adj[edge.i].push({ to: edge.j, w });
    adj[edge.j].push({ to: edge.i, w });
    weightedDeg[edge.i] += w;
    weightedDeg[edge.j] += w;
  }

  let r = seed.slice();
  const next = new Array<number>(n).fill(0);
  const clampedAlpha = Math.min(1, Math.max(0, alpha));

  for (let iter = 0; iter < 300; iter++) {
    for (let i = 0; i < n; i++) next[i] = clampedAlpha * seed[i];
    let dangling = 0;
    for (let u = 0; u < n; u++) {
      const deg = weightedDeg[u];
      if (deg <= 0) {
        dangling += r[u];
        continue;
      }
      const mass = ((1 - clampedAlpha) * r[u]) / deg;
      for (const link of adj[u]) {
        next[link.to] += mass * link.w;
      }
    }
    if (dangling > 0) {
      const extra = (1 - clampedAlpha) * dangling;
      for (let i = 0; i < n; i++) next[i] += extra * seed[i];
    }

    let diff = 0;
    for (let i = 0; i < n; i++) {
      diff += Math.abs(next[i] - r[i]);
      r[i] = next[i];
    }
    if (diff < 1e-10) break;
  }

  return r;
}

function checkCandidateCoverage(
  graph: Graph,
  candId: number,
  terminalIds: number[],
  candidateIds: Set<number>,
  terminalSet: Set<number>,
  scope: GraphRagViewerScope,
): { covered: number[]; missing: number[]; witnessEdges: Set<number> } {
  const n = graph.nodes.length;
  if (candId < 0 || candId >= n || !isNodeAuthorized(graph.nodes[candId], scope)) {
    return { covered: [], missing: [...terminalIds], witnessEdges: new Set() };
  }

  const adj: Array<Array<{ to: number; edgeIndex: number }>> = Array.from({ length: n }, () => []);
  for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
    const edge = graph.edges[eIdx];
    if (edge.severed || edge.scopeBlocked || !isEdgeAuthorized(graph, edge, scope)) continue;
    adj[edge.i].push({ to: edge.j, edgeIndex: eIdx });
    adj[edge.j].push({ to: edge.i, edgeIndex: eIdx });
  }

  const covered: number[] = [];
  const missing: number[] = [];
  const witnessEdges = new Set<number>();

  for (const termId of terminalIds) {
    if (termId < 0 || termId >= n || !isNodeAuthorized(graph.nodes[termId], scope)) {
      missing.push(termId);
      continue;
    }
    if (termId === candId) {
      covered.push(termId);
      continue;
    }

    const visited = new Uint8Array(n);
    const parent = new Array<{ prev: number; edgeIndex: number } | null>(n).fill(null);
    const queue = [candId];
    visited[candId] = 1;
    let found = false;

    while (queue.length > 0) {
      const u = queue.shift()!;
      if (u === termId) {
        found = true;
        break;
      }
      if (u !== candId && (candidateIds.has(u) || terminalSet.has(u))) continue;

      for (const nextLink of adj[u]) {
        const v = nextLink.to;
        if (visited[v]) continue;
        if (v !== termId && v !== candId && candidateIds.has(v)) continue;
        if (v !== termId && terminalSet.has(v)) continue;
        visited[v] = 1;
        parent[v] = { prev: u, edgeIndex: nextLink.edgeIndex };
        queue.push(v);
      }
    }

    if (found) {
      covered.push(termId);
      let cur = termId;
      while (parent[cur]) {
        const p = parent[cur]!;
        witnessEdges.add(p.edgeIndex);
        cur = p.prev;
      }
    } else {
      missing.push(termId);
    }
  }

  return { covered, missing, witnessEdges };
}

export function evaluateGraphRag(
  graph: Graph,
  scope: GraphRagViewerScope = 'buyer',
  activeThreshold = 0.03,
): GraphRagEvaluation {
  const queryTerminalIds = graph.nodes
    .filter((node) => node.role === 'query' || (node.role === undefined && node.flow > 0))
    .map((node) => node.id);
  const candidateNodes = graph.nodes.filter(
    (node): node is Node & { role: 'supplier' | 'hub' } =>
      node.role === 'supplier' || node.role === 'hub',
  );

  const candidateIdSet = new Set(candidateNodes.map((n) => n.id));
  const terminalSet = new Set(queryTerminalIds);
  const pprScores = computePprScores(graph, queryTerminalIds, scope);

  let hiddenPrivateEdges = 0;
  let severedEdgesCount = 0;
  let noiseEdgesTotal = 0;
  let noiseEdgesPruned = 0;
  const auditEdges: GraphRagBlockedOrSeveredEdge[] = [];

  for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
    const edge = graph.edges[eIdx];
    const fromLabel = graph.nodes[edge.i]?.label ?? `#${edge.i}`;
    const toLabel = graph.nodes[edge.j]?.label ?? `#${edge.j}`;
    const relation = edge.relation ?? 'Evidence';
    const evidenceRef = edge.evidenceRef ?? `edge-${eIdx}`;
    const authorized = !edge.scopeBlocked && isEdgeAuthorized(graph, edge, scope);

    if (!authorized) {
      hiddenPrivateEdges++;
      auditEdges.push({
        edgeIndex: eIdx,
        fromLabel,
        toLabel,
        relation,
        evidenceRef,
        reason: 'scope-blocked',
      });
      continue;
    }

    if (edge.severed) {
      severedEdgesCount++;
      auditEdges.push({
        edgeIndex: eIdx,
        fromLabel,
        toLabel,
        relation,
        evidenceRef,
        reason: edge.expired ? 'expired' : 'revoked',
      });
      continue;
    }

    if (
      graph.nodes[edge.i]?.role === 'noise' ||
      graph.nodes[edge.j]?.role === 'noise' ||
      edge.relation === 'Brand Noise'
    ) {
      noiseEdgesTotal++;
      if (edge.D < 0.01) {
        noiseEdgesPruned++;
      }
    }
  }

  let fluxSum = 0;
  let pprCandSum = 0;
  const allCitationMap = new Map<number, GraphRagCitation>();

  const candidates: GraphRagCandidateResult[] = candidateNodes.map((cand) => {
    const authorized = isNodeAuthorized(cand, scope);
    let flux = 0;
    let maxShadowPrice = 0;
    const evidenceNeighbors = new Set<number>();
    const activeEdgeSet = new Set<number>();

    if (authorized) {
      for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
        const edge = graph.edges[eIdx];
        if (edge.severed || edge.scopeBlocked || !isEdgeAuthorized(graph, edge, scope)) continue;
        if (edge.i === cand.id || edge.j === cand.id) {
          flux += 0.5 * Math.abs(edge.flow);
          maxShadowPrice = Math.max(maxShadowPrice, edge.congestion ?? 0);
          if (edge.D >= activeThreshold) {
            activeEdgeSet.add(eIdx);
          }
          const other = edge.i === cand.id ? edge.j : edge.i;
          const otherRole = graph.nodes[other]?.role;
          if (otherRole === 'evidence' || otherRole === 'private') {
            evidenceNeighbors.add(other);
          }
        }
      }

      for (let eIdx = 0; eIdx < graph.edges.length; eIdx++) {
        const edge = graph.edges[eIdx];
        if (edge.severed || edge.scopeBlocked || !isEdgeAuthorized(graph, edge, scope)) continue;
        if (edge.D < activeThreshold) continue;
        if (candidateIdSet.has(edge.i) || candidateIdSet.has(edge.j)) continue;
        if (evidenceNeighbors.has(edge.i) || evidenceNeighbors.has(edge.j)) {
          activeEdgeSet.add(eIdx);
        }
      }
    }

    const cov = checkCandidateCoverage(
      graph,
      cand.id,
      queryTerminalIds,
      candidateIdSet,
      terminalSet,
      scope,
    );
    for (const eIdx of cov.witnessEdges) {
      if (graph.edges[eIdx]?.D >= activeThreshold) {
        activeEdgeSet.add(eIdx);
      }
    }

    const citations: GraphRagCitation[] = Array.from(activeEdgeSet)
      .map((eIdx) => {
        const edge = graph.edges[eIdx];
        const entry: GraphRagCitation = {
          edgeIndex: eIdx,
          fromLabel: graph.nodes[edge.i]?.label ?? `#${edge.i}`,
          toLabel: graph.nodes[edge.j]?.label ?? `#${edge.j}`,
          relation: edge.relation ?? 'Evidence',
          evidenceRef: edge.evidenceRef ?? `edge-${eIdx}`,
          flow: Math.abs(edge.flow),
          conductanceD: edge.D,
          shadowPrice: edge.congestion ?? 0,
        };
        allCitationMap.set(eIdx, entry);
        return entry;
      })
      .sort((a, b) => b.flow - a.flow || a.edgeIndex - b.edgeIndex);

    const status: 'eligible' | 'needs-review' =
      authorized && cov.missing.length === 0 && flux > 1e-4 ? 'eligible' : 'needs-review';
    const pprScore = authorized ? (pprScores[cand.id] ?? 0) : 0;

    fluxSum += flux;
    pprCandSum += pprScore;

    return {
      nodeId: cand.id,
      label: cand.label ?? `#${cand.id}`,
      role: cand.role,
      physarumFlux: flux,
      physarumShare: 0,
      physarumRank: 0,
      rawPhysarumRank: 0,
      pprScore,
      pprShare: 0,
      pprRank: 0,
      maxShadowPrice,
      status,
      coveredTerminals: cov.covered,
      missingTerminals: cov.missing,
      missingLabels: cov.missing.map((id) => graph.nodes[id]?.label ?? `#${id}`),
      citations,
    };
  });

  for (const c of candidates) {
    c.physarumShare = fluxSum > 0 ? c.physarumFlux / fluxSum : 0;
    c.pprShare = pprCandSum > 0 ? c.pprScore / pprCandSum : 0;
  }

  const rawOrder = candidates
    .map((_, idx) => idx)
    .sort(
      (a, b) =>
        candidates[b].physarumFlux - candidates[a].physarumFlux ||
        candidates[a].nodeId - candidates[b].nodeId,
    );
  rawOrder.forEach((idx, r) => {
    candidates[idx].rawPhysarumRank = r + 1;
  });

  const pprOrder = candidates
    .map((_, idx) => idx)
    .sort(
      (a, b) =>
        candidates[b].pprScore - candidates[a].pprScore ||
        candidates[a].nodeId - candidates[b].nodeId,
    );
  pprOrder.forEach((idx, r) => {
    candidates[idx].pprRank = r + 1;
  });

  const phyOrder = candidates
    .map((_, idx) => idx)
    .sort((a, b) => {
      const ea = candidates[a].status === 'eligible' ? 1 : 0;
      const eb = candidates[b].status === 'eligible' ? 1 : 0;
      if (eb !== ea) return eb - ea;
      return (
        candidates[b].physarumFlux - candidates[a].physarumFlux ||
        candidates[a].nodeId - candidates[b].nodeId
      );
    });
  phyOrder.forEach((idx, r) => {
    candidates[idx].physarumRank = r + 1;
  });

  candidates.sort((a, b) => a.physarumRank - b.physarumRank);

  const topPpr = candidates.find((c) => c.pprRank === 1);
  const topPhy = candidates[0];
  const pprHubTrapDetected = Boolean(
    topPpr &&
      topPpr.role === 'hub' &&
      topPhy &&
      topPhy.role === 'supplier' &&
      topPhy.status === 'eligible' &&
      topPhy.rawPhysarumRank === 1,
  );

  const globallyUncovered = queryTerminalIds.filter(
    (termId) => !candidates.some((c) => c.coveredTerminals.includes(termId)),
  );

  let verdict: 'ready' | 'needs-review' = 'ready';
  let topCandidateId: number | null = null;
  let topCandidateLabel: string | null = null;
  let missingRequirementIds: number[] = [];

  if (globallyUncovered.length > 0) {
    verdict = 'needs-review';
    missingRequirementIds = globallyUncovered;
  } else {
    const firstEligible = candidates.find((c) => c.status === 'eligible');
    if (firstEligible) {
      verdict = 'ready';
      topCandidateId = firstEligible.nodeId;
      topCandidateLabel = firstEligible.label;
    } else {
      verdict = 'needs-review';
      const fewestMissing = [...candidates].sort(
        (a, b) => a.missingTerminals.length - b.missingTerminals.length,
      )[0];
      missingRequirementIds =
        fewestMissing && fewestMissing.missingTerminals.length > 0
          ? [...fewestMissing.missingTerminals]
          : [...queryTerminalIds];
    }
  }

  const missingRequirementLabels = missingRequirementIds.map(
    (id) => graph.nodes[id]?.label ?? `#${id}`,
  );
  const citations = Array.from(allCitationMap.values()).sort(
    (a, b) => b.flow - a.flow || a.edgeIndex - b.edgeIndex,
  );

  return {
    viewerScope: scope,
    queryTerminalIds,
    candidates,
    verdict,
    topCandidateId,
    topCandidateLabel,
    missingRequirementIds,
    missingRequirementLabels,
    pprHubTrapDetected,
    noiseEdgesTotal,
    noiseEdgesPruned,
    noisePrunedPct: noiseEdgesTotal > 0 ? (noiseEdgesPruned / noiseEdgesTotal) * 100 : 100,
    hiddenPrivateEdges,
    severedEdgesCount,
    citations,
    auditEdges,
  };
}

export function exportGraphRagJson(
  graph: Graph,
  evaluation: GraphRagEvaluation,
  meta: { presetId: string; seed: number; iteration: number },
): string {
  return JSON.stringify(
    {
      ...meta,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      evaluation,
    },
    null,
    2,
  );
}
