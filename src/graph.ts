export type NodeRole = 'query' | 'supplier' | 'hub' | 'evidence' | 'private' | 'noise';

export interface Node {
  id: number;
  x: number;
  y: number;
  flow: number;
  label?: string;
  role?: NodeRole;
  room?: string;
}

export interface Edge {
  i: number;
  j: number;
  length: number;
  D: number;
  costFactor: number;
  flow: number;
  severed?: boolean;
  capacity?: number;
  congestion?: number;
  cellId?: string;
  stage?: string;
  relation?: string;
  evidenceRef?: string;
  room?: string;
  expired?: boolean;
  scopeBlocked?: boolean;
}

export interface ExplicitEdgeSpec {
  i: number;
  j: number;
  costFactor?: number;
  capacity?: number;
  cellId?: string;
  stage?: string;
  relation?: string;
  evidenceRef?: string;
  room?: string;
  expired?: boolean;
}

export interface Graph {
  nodes: Node[];
  edges: Edge[];
  adj: number[][];
}

export type GraphMode = 'complete' | 'delaunay' | 'explicit';
export type FlowMode = 'source-sink' | 'multi-terminal';
export type LabDomain = 'transport' | 'vascular' | 'optimization' | 'fjsp' | 'graphrag' | 'systems';
export type DynamicsMode = 'tero' | 'murray' | 'linear-lp';

function initialD(random: () => number): number {
  return 0.5 + 0.1 * (random() - 0.5);
}

export function emptyGraph(): Graph {
  return { nodes: [], edges: [], adj: [] };
}

function addEdge(graph: Graph, i: number, j: number, random: () => number): void {
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  const dx = graph.nodes[a].x - graph.nodes[b].x;
  const dy = graph.nodes[a].y - graph.nodes[b].y;
  const length = Math.max(Math.hypot(dx, dy), 1e-6);
  const idx = graph.edges.length;
  graph.edges.push({
    i: a,
    j: b,
    length,
    D: initialD(random),
    costFactor: 1,
    flow: 0,
    severed: false,
  });
  graph.adj[a].push(idx);
  graph.adj[b].push(idx);
}

export function buildCompleteGraph(nodes: Node[], random: () => number = Math.random): Graph {
  const graph: Graph = { nodes: nodes.map((n) => ({ ...n })), edges: [], adj: [] };
  for (let k = 0; k < nodes.length; k++) graph.adj.push([]);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) addEdge(graph, i, j, random);
  }
  return graph;
}

// Bowyer-Watson Delaunay. Returns triangles as triples of node indices.
function delaunayTriangles(nodes: Node[]): Array<[number, number, number]> {
  const n = nodes.length;
  if (n < 3) return [];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of nodes) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const dmax = Math.max(dx, dy) * 20;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  // Super-triangle vertices stored as virtual points at indices n, n+1, n+2.
  const pts: Array<{ x: number; y: number }> = nodes.map((p) => ({ x: p.x, y: p.y }));
  pts.push({ x: midX - dmax, y: midY - dmax });
  pts.push({ x: midX + dmax, y: midY - dmax });
  pts.push({ x: midX, y: midY + dmax });

  type Tri = { a: number; b: number; c: number; cx: number; cy: number; r2: number };
  const circ = (a: number, b: number, c: number): Tri => {
    const ax = pts[a].x, ay = pts[a].y;
    const bx = pts[b].x, by = pts[b].y;
    const cx0 = pts[c].x, cy0 = pts[c].y;
    const d = 2 * (ax * (by - cy0) + bx * (cy0 - ay) + cx0 * (ay - by));
    if (Math.abs(d) < 1e-9) {
      return { a, b, c, cx: 0, cy: 0, r2: Number.POSITIVE_INFINITY };
    }
    const ux = ((ax * ax + ay * ay) * (by - cy0) + (bx * bx + by * by) * (cy0 - ay) + (cx0 * cx0 + cy0 * cy0) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx0 - bx) + (bx * bx + by * by) * (ax - cx0) + (cx0 * cx0 + cy0 * cy0) * (bx - ax)) / d;
    const r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);
    return { a, b, c, cx: ux, cy: uy, r2 };
  };

  let tris: Tri[] = [circ(n, n + 1, n + 2)];

  for (let i = 0; i < n; i++) {
    const px = pts[i].x;
    const py = pts[i].y;
    const bad: Tri[] = [];
    const kept: Tri[] = [];
    for (const t of tris) {
      const ddx = px - t.cx;
      const ddy = py - t.cy;
      if (ddx * ddx + ddy * ddy < t.r2) bad.push(t);
      else kept.push(t);
    }
    const edgeCount = new Map<string, number>();
    const edgeList: Array<[number, number]> = [];
    for (const t of bad) {
      const es: Array<[number, number]> = [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ];
      for (const [u, v] of es) {
        const k = u < v ? `${u}_${v}` : `${v}_${u}`;
        edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
        edgeList.push([u, v]);
      }
    }
    tris = kept;
    for (const [u, v] of edgeList) {
      const k = u < v ? `${u}_${v}` : `${v}_${u}`;
      if (edgeCount.get(k) === 1) tris.push(circ(u, v, i));
    }
  }

  const result: Array<[number, number, number]> = [];
  for (const t of tris) {
    if (t.a < n && t.b < n && t.c < n) result.push([t.a, t.b, t.c]);
  }
  return result;
}

export function buildDelaunayGraph(nodes: Node[], random: () => number = Math.random): Graph {
  const graph: Graph = { nodes: nodes.map((n) => ({ ...n })), edges: [], adj: [] };
  for (let k = 0; k < nodes.length; k++) graph.adj.push([]);
  if (nodes.length < 2) return graph;
  if (nodes.length === 2) {
    addEdge(graph, 0, 1, random);
    return graph;
  }
  const tris = delaunayTriangles(nodes);
  const seen = new Set<string>();
  const tryAdd = (u: number, v: number): void => {
    const a = Math.min(u, v);
    const b = Math.max(u, v);
    const k = `${a}_${b}`;
    if (seen.has(k)) return;
    seen.add(k);
    addEdge(graph, a, b, random);
  };
  for (const [a, b, c] of tris) {
    tryAdd(a, b);
    tryAdd(b, c);
    tryAdd(c, a);
  }
  if (graph.edges.length === 0 && nodes.length > 1) {
    const order = nodes.map((_, index) => index).sort((a, b) =>
      nodes[a].x - nodes[b].x || nodes[a].y - nodes[b].y,
    );
    for (let index = 1; index < order.length; index++) {
      tryAdd(order[index - 1], order[index]);
    }
  }
  return graph;
}

export function buildExplicitGraph(
  nodes: Node[],
  edgeSpecs: ExplicitEdgeSpec[],
  random: () => number = Math.random,
): Graph {
  const graph: Graph = { nodes: nodes.map((n) => ({ ...n })), edges: [], adj: [] };
  for (let k = 0; k < nodes.length; k++) graph.adj.push([]);
  const seen = new Set<string>();
  for (const spec of edgeSpecs) {
    if (
      spec.i < 0 ||
      spec.j < 0 ||
      spec.i >= nodes.length ||
      spec.j >= nodes.length ||
      spec.i === spec.j
    ) {
      continue;
    }
    const a = Math.min(spec.i, spec.j);
    const b = Math.max(spec.i, spec.j);
    const key = `${a}_${b}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const dx = graph.nodes[a].x - graph.nodes[b].x;
    const dy = graph.nodes[a].y - graph.nodes[b].y;
    const length = Math.max(Math.hypot(dx, dy), 1e-6);
    const idx = graph.edges.length;
    const isExpired = Boolean(spec.expired);
    const edge: Edge = {
      i: a,
      j: b,
      length,
      D: isExpired ? 0 : initialD(random),
      costFactor: Math.max(spec.costFactor ?? 1, 0.1),
      flow: 0,
      severed: isExpired,
      congestion: 0,
    };
    if (spec.capacity !== undefined && Number.isFinite(spec.capacity) && spec.capacity > 0) {
      edge.capacity = spec.capacity;
    }
    if (spec.cellId) edge.cellId = spec.cellId;
    if (spec.stage) edge.stage = spec.stage;
    if (spec.relation) edge.relation = spec.relation;
    if (spec.evidenceRef) edge.evidenceRef = spec.evidenceRef;
    if (spec.room) edge.room = spec.room;
    if (isExpired) edge.expired = true;
    graph.edges.push(edge);
    graph.adj[a].push(idx);
    graph.adj[b].push(idx);
  }
  return graph;
}

export function rebuildGraph(
  graph: Graph,
  mode: GraphMode,
  random: () => number = Math.random,
  explicitSpecs?: ExplicitEdgeSpec[],
): Graph {
  if (mode === 'explicit') {
    const specs: ExplicitEdgeSpec[] =
      explicitSpecs ??
      graph.edges.map((e) => ({
        i: e.i,
        j: e.j,
        costFactor: e.costFactor,
        capacity: e.capacity,
        cellId: e.cellId,
        stage: e.stage,
        relation: e.relation,
        evidenceRef: e.evidenceRef,
        room: e.room,
        expired: e.expired,
      }));
    return buildExplicitGraph(graph.nodes, specs, random);
  }
  return mode === 'delaunay'
    ? buildDelaunayGraph(graph.nodes, random)
    : buildCompleteGraph(graph.nodes, random);
}

export function addNode(
  graph: Graph,
  x: number,
  y: number,
  flow: number,
  mode: GraphMode = 'complete',
  random: () => number = Math.random,
): { graph: Graph; node: Node } {
  const id = graph.nodes.length;
  const nodes = graph.nodes.map((n) => ({ ...n }));
  nodes.push({ id, x, y, flow });
  if (mode === 'explicit') {
    const next: Graph = {
      nodes,
      edges: graph.edges.map((e) => ({ ...e })),
      adj: graph.adj.map((list) => [...list]),
    };
    next.adj.push([]);
    const nearest = graph.nodes
      .map((n) => ({ id: n.id, dist: Math.hypot(n.x - x, n.y - y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2);
    for (const target of nearest) {
      addEdge(next, id, target.id, random);
    }
    return { graph: next, node: next.nodes[id] };
  }
  const next = mode === 'delaunay' ? buildDelaunayGraph(nodes, random) : buildCompleteGraph(nodes, random);
  return { graph: next, node: next.nodes[id] };
}

export function hasSourceAndSink(graph: Graph): boolean {
  let src = false;
  let snk = false;
  for (const n of graph.nodes) {
    if (n.flow > 0) src = true;
    else if (n.flow < 0) snk = true;
    if (src && snk) return true;
  }
  return false;
}

export function hasActiveTerminals(graph: Graph, flowMode: FlowMode): boolean {
  if (flowMode === 'source-sink') return hasSourceAndSink(graph);
  let terminals = 0;
  for (const n of graph.nodes) {
    if (n.flow !== 0) {
      terminals++;
      if (terminals >= 2) return true;
    }
  }
  return false;
}

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 1e-12) return Math.hypot(px - ax, py - ay);
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function findNearestEdgeIndex(
  graph: Graph,
  x: number,
  y: number,
  maxDistPx: number,
  minD: number,
): number | null {
  let bestIdx: number | null = null;
  let bestDist = maxDistPx;
  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    if (edge.severed || edge.scopeBlocked || edge.D <= minD) continue;
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];
    const d = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
    if (d <= bestDist) {
      bestDist = d;
      bestIdx = idx;
    }
  }
  return bestIdx;
}

/** Permanently sever the nearest visible active edge for self-healing experiments. */
export function severEdgeNear(graph: Graph, x: number, y: number, maxDistPx = 12): number | null {
  const idx = findNearestEdgeIndex(graph, x, y, maxDistPx, 0.03);
  if (idx === null) return null;
  const edge = graph.edges[idx];
  edge.D = 0;
  edge.flow = 0;
  edge.severed = true;
  return idx;
}

/** Find the nearest visible active edge for hover inspection. */
export function findEdgeNear(graph: Graph, x: number, y: number, maxDistPx = 10): number | null {
  return findNearestEdgeIndex(graph, x, y, maxDistPx, 0.02);
}

/** Apply explicit finite positive edge capacities and clear prior congestion multipliers. */
export function applyCapacitiesToGraph(
  graph: Graph,
  capacities?: Array<{ i: number; j: number; capacity: number }>,
): void {
  const capMap = new Map<string, number>();
  if (capacities) {
    for (const item of capacities) {
      if (!Number.isFinite(item.capacity) || item.capacity <= 0) continue;
      const a = Math.min(item.i, item.j);
      const b = Math.max(item.i, item.j);
      if (a === b) continue;
      capMap.set(`${a}_${b}`, item.capacity);
    }
  }
  for (const edge of graph.edges) {
    const cap = capMap.get(`${edge.i}_${edge.j}`);
    if (cap !== undefined) {
      edge.capacity = cap;
    } else {
      delete edge.capacity;
    }
    edge.congestion = 0;
  }
}

/** Toggle a bottleneck flow capacity on the nearest active non-severed edge. */
export function toggleEdgeCapacityNear(
  graph: Graph,
  x: number,
  y: number,
  defaultCapacity = 0.55,
  maxDistPx = 14,
): number | null {
  const idx = findNearestEdgeIndex(graph, x, y, maxDistPx, 0.005);
  if (idx === null) return null;
  const edge = graph.edges[idx];
  if (edge.capacity !== undefined && Number.isFinite(edge.capacity)) {
    delete edge.capacity;
  } else {
    edge.capacity = defaultCapacity;
  }
  edge.congestion = 0;
  return idx;
}

/** Return cell IDs whose explicit cell edges have all been severed offline. */
export function getOfflineCellIds(graph: Graph): Set<string> {
  const counts = new Map<string, { total: number; severed: number }>();
  for (const edge of graph.edges) {
    if (!edge.cellId) continue;
    const entry = counts.get(edge.cellId) ?? { total: 0, severed: 0 };
    entry.total++;
    if (edge.severed) entry.severed++;
    counts.set(edge.cellId, entry);
  }
  const offline = new Set<string>();
  for (const [cellId, entry] of counts.entries()) {
    if (entry.total > 0 && entry.severed === entry.total) {
      offline.add(cellId);
    }
  }
  return offline;
}
