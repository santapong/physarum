import type { FlowMode, Graph } from './graph';

export interface NetworkMetrics {
  activeEdges: number;
  activeLength: number;
  mstLength: number;
  tlRatio: number;
  meanDistance: number;
  baselineDistance: number;
  mdRatio: number;
  faultTolerance: number;
  efficiencyScore: number;
  connected: boolean;
  mstEdgeIndices: number[];
}

class UnionFind {
  private parent: Int32Array;
  private rank: Int32Array;

  constructor(n: number) {
    this.parent = new Int32Array(n);
    this.rank = new Int32Array(n);
    for (let i = 0; i < n; i++) this.parent[i] = i;
  }

  find(x: number): number {
    let root = x;
    while (this.parent[root] !== root) root = this.parent[root];
    let curr = x;
    while (this.parent[curr] !== root) {
      const next = this.parent[curr];
      this.parent[curr] = root;
      curr = next;
    }
    return root;
  }

  union(a: number, b: number): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
    return true;
  }
}

function effectiveLength(edge: Graph['edges'][number]): number {
  return edge.length * Math.max(edge.costFactor ?? 1, 1);
}

/** Compute the Euclidean/terrain-weighted Minimum Spanning Tree via Kruskal's algorithm. */
export function computeMst(graph: Graph): { edgeIndices: number[]; totalLength: number } {
  const n = graph.nodes.length;
  if (n < 2 || graph.edges.length === 0) return { edgeIndices: [], totalLength: 0 };

  const order = graph.edges
    .map((edge, idx) => ({ idx, w: effectiveLength(edge), severed: Boolean(edge.severed) }))
    .filter((item) => !item.severed)
    .sort((a, b) => a.w - b.w);

  const uf = new UnionFind(n);
  const edgeIndices: number[] = [];
  let totalLength = 0;

  for (const item of order) {
    const edge = graph.edges[item.idx];
    if (uf.union(edge.i, edge.j)) {
      edgeIndices.push(item.idx);
      totalLength += edge.length;
      if (edgeIndices.length === n - 1) break;
    }
  }

  return { edgeIndices, totalLength };
}

function dijkstraFromSource(
  n: number,
  adj: Array<Array<{ to: number; weight: number }>>,
  start: number,
): Float64Array {
  const dist = new Float64Array(n);
  dist.fill(Number.POSITIVE_INFINITY);
  dist[start] = 0;
  const visited = new Uint8Array(n);

  // O(V^2 + E) dense Dijkstra is fast and allocation-free for <= 100 nodes.
  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      if (!visited[i] && dist[i] < best) {
        best = dist[i];
        u = i;
      }
    }
    if (u === -1) break;
    visited[u] = 1;
    for (const next of adj[u]) {
      const alt = dist[u] + next.weight;
      if (alt < dist[next.to]) dist[next.to] = alt;
    }
  }
  return dist;
}

function terminalPairs(graph: Graph, flowMode: FlowMode): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  if (flowMode === 'source-sink') {
    const sources: number[] = [];
    const sinks: number[] = [];
    for (const n of graph.nodes) {
      if (n.flow > 0) sources.push(n.id);
      else if (n.flow < 0) sinks.push(n.id);
    }
    for (const s of sources) {
      for (const t of sinks) pairs.push([s, t]);
    }
    return pairs;
  }

  const terminals: number[] = [];
  for (const n of graph.nodes) {
    if (n.flow !== 0) terminals.push(n.id);
  }
  for (let i = 0; i < terminals.length; i++) {
    for (let j = i + 1; j < terminals.length; j++) {
      pairs.push([terminals[i], terminals[j]]);
    }
  }
  return pairs;
}

function allPairsConnected(
  n: number,
  activeEdgeIndices: number[],
  edges: Graph['edges'],
  pairs: Array<[number, number]>,
  skipEdgeIndex = -1,
): boolean {
  if (pairs.length === 0) return false;
  const uf = new UnionFind(n);
  for (const idx of activeEdgeIndices) {
    if (idx === skipEdgeIndex) continue;
    const e = edges[idx];
    uf.union(e.i, e.j);
  }
  for (const [u, v] of pairs) {
    if (uf.find(u) !== uf.find(v)) return false;
  }
  return true;
}

/**
 * Compute Tero et al. (2010) quantitative transport metrics:
 * - TL/MST: normalized total length (cost)
 * - MD: normalized mean shortest-path distance between terminals (efficiency)
 * - FT: fraction of active edges whose single removal preserves terminal connectivity
 */
export function computeNetworkMetrics(
  graph: Graph,
  flowMode: FlowMode,
  activeThreshold = 0.05,
): NetworkMetrics {
  const n = graph.nodes.length;
  const mst = computeMst(graph);
  const pairs = terminalPairs(graph, flowMode);

  const activeEdgeIndices: number[] = [];
  let activeLength = 0;
  const activeAdj: Array<Array<{ to: number; weight: number }>> = Array.from({ length: n }, () => []);
  const baseAdj: Array<Array<{ to: number; weight: number }>> = Array.from({ length: n }, () => []);

  for (let idx = 0; idx < graph.edges.length; idx++) {
    const e = graph.edges[idx];
    if (e.severed) continue;
    baseAdj[e.i].push({ to: e.j, weight: e.length });
    baseAdj[e.j].push({ to: e.i, weight: e.length });
    if (e.D >= activeThreshold) {
      activeEdgeIndices.push(idx);
      activeLength += e.length;
      activeAdj[e.i].push({ to: e.j, weight: e.length });
      activeAdj[e.j].push({ to: e.i, weight: e.length });
    }
  }

  const tlRatio = mst.totalLength > 0 ? activeLength / mst.totalLength : 0;

  if (pairs.length === 0) {
    return {
      activeEdges: activeEdgeIndices.length,
      activeLength,
      mstLength: mst.totalLength,
      tlRatio,
      meanDistance: 0,
      baselineDistance: 0,
      mdRatio: 0,
      faultTolerance: 0,
      efficiencyScore: 0,
      connected: false,
      mstEdgeIndices: mst.edgeIndices,
    };
  }

  const uniqueSources = Array.from(new Set(pairs.map(([s]) => s)));
  const activeDistCache = new Map<number, Float64Array>();
  const baseDistCache = new Map<number, Float64Array>();
  for (const s of uniqueSources) {
    activeDistCache.set(s, dijkstraFromSource(n, activeAdj, s));
    baseDistCache.set(s, dijkstraFromSource(n, baseAdj, s));
  }

  let activeDistSum = 0;
  let baseDistSum = 0;
  let connected = true;
  for (const [u, v] of pairs) {
    const ad = activeDistCache.get(u)![v];
    const bd = baseDistCache.get(u)![v];
    if (!Number.isFinite(ad)) connected = false;
    activeDistSum += ad;
    baseDistSum += bd;
  }

  const meanDistance = activeDistSum / pairs.length;
  const baselineDistance = baseDistSum / pairs.length;
  const mdRatio = connected && baselineDistance > 0 ? meanDistance / baselineDistance : Number.POSITIVE_INFINITY;

  let faultTolerance = 0;
  if (connected && activeEdgeIndices.length > 0) {
    let surviving = 0;
    for (const idx of activeEdgeIndices) {
      if (allPairsConnected(n, activeEdgeIndices, graph.edges, pairs, idx)) {
        surviving++;
      }
    }
    faultTolerance = surviving / activeEdgeIndices.length;
  }

  const efficiencyScore =
    connected && tlRatio > 0 && Number.isFinite(mdRatio) && mdRatio > 0
      ? faultTolerance / (tlRatio * mdRatio)
      : 0;

  return {
    activeEdges: activeEdgeIndices.length,
    activeLength,
    mstLength: mst.totalLength,
    tlRatio,
    meanDistance,
    baselineDistance,
    mdRatio,
    faultTolerance,
    efficiencyScore,
    connected,
    mstEdgeIndices: mst.edgeIndices,
  };
}
