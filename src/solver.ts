import type { Graph } from './graph';

export interface SolveResult {
  pressures: number[];
  iterations: number;
  residual: number;
  converged: boolean;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function cg(
  matvec: (v: number[]) => number[],
  b: number[],
  x0: number[],
  tol: number,
  maxIter: number,
): number[] {
  const n = b.length;
  const x = x0.slice();
  const Ax = matvec(x);
  const r = new Array<number>(n);
  for (let i = 0; i < n; i++) r[i] = b[i] - Ax[i];
  let p = r.slice();
  let rTr = dot(r, r);
  for (let k = 0; k < maxIter; k++) {
    const Ap = matvec(p);
    const pAp = dot(p, Ap);
    if (!Number.isFinite(pAp) || Math.abs(pAp) < 1e-14) return x;
    const alpha = rTr / pAp;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }
    const rTrNew = dot(r, r);
    if (!Number.isFinite(rTrNew) || Math.sqrt(rTrNew) < tol) return x;
    const beta = rTrNew / rTr;
    const pNext = new Array<number>(n);
    for (let i = 0; i < n; i++) pNext[i] = r[i] + beta * p[i];
    p = pNext;
    rTr = rTrNew;
  }
  return x;
}

function pcg(
  matvec: (v: number[]) => number[],
  diag: number[],
  b: number[],
  x0: number[],
  tol: number,
  maxIter: number,
): { x: number[]; iterations: number; residual: number; converged: boolean } {
  const n = b.length;
  const x = x0.slice();
  const Ax = matvec(x);
  const r = new Array<number>(n);
  const z = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    r[i] = b[i] - Ax[i];
    const invD = diag[i] > 1e-15 ? 1 / diag[i] : 1;
    z[i] = r[i] * invD;
  }
  let residual = Math.sqrt(dot(r, r));
  if (!Number.isFinite(residual) || residual < tol) {
    return { x, iterations: 0, residual, converged: Number.isFinite(residual) };
  }

  let p = z.slice();
  let rz = dot(r, z);

  for (let k = 0; k < maxIter; k++) {
    const Ap = matvec(p);
    const pAp = dot(p, Ap);
    if (!Number.isFinite(pAp) || pAp <= 1e-18) {
      return { x, iterations: k, residual, converged: residual < tol };
    }
    const alpha = rz / pAp;
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i];
      r[i] -= alpha * Ap[i];
    }
    residual = Math.sqrt(dot(r, r));
    if (!Number.isFinite(residual)) {
      return { x: x0.slice(), iterations: k + 1, residual: Number.POSITIVE_INFINITY, converged: false };
    }
    if (residual < tol) {
      return { x, iterations: k + 1, residual, converged: true };
    }

    let rzNew = 0;
    for (let i = 0; i < n; i++) {
      const invD = diag[i] > 1e-15 ? 1 / diag[i] : 1;
      z[i] = r[i] * invD;
      rzNew += r[i] * z[i];
    }
    if (!Number.isFinite(rzNew) || Math.abs(rz) < 1e-30) {
      return { x, iterations: k + 1, residual, converged: residual < tol };
    }
    const beta = rzNew / rz;
    const pNext = new Array<number>(n);
    for (let i = 0; i < n; i++) pNext[i] = z[i] + beta * p[i];
    p = pNext;
    rz = rzNew;
  }

  return { x, iterations: maxIter, residual, converged: residual < tol };
}

export function effectiveEdgeCost(edge: Graph['edges'][number]): number {
  return edge.length * Math.max(edge.costFactor ?? 1, 1);
}

/** Normalize positive node supplies to sum to +1 and negative demands to sum to -1. */
export function normalizedNodeFlows(graph: Graph): number[] {
  const n = graph.nodes.length;
  const flows = new Array<number>(n).fill(0);
  let posSum = 0;
  let negSum = 0;
  for (const node of graph.nodes) {
    if (node.flow > 0) posSum += node.flow;
    else if (node.flow < 0) negSum += -node.flow;
  }
  if (posSum <= 0 || negSum <= 0) return flows;
  for (let k = 0; k < n; k++) {
    const f = graph.nodes[k].flow;
    if (f > 0) flows[k] = f / posSum;
    else if (f < 0) flows[k] = f / negSum;
  }
  return flows;
}

function edgeConductance(edge: Graph['edges'][number]): number {
  if (edge.severed || edge.D <= 1e-12) return 0;
  const congestionScale = 1 + Math.max(edge.congestion ?? 0, 0);
  return edge.D / (effectiveEdgeCost(edge) * congestionScale);
}

/**
 * Solve the grounded weighted Laplacian L*p = b per connected component
 * using Jacobi-preconditioned Conjugate Gradient (PCG) with optional warm start.
 */
export function solvePressuresDetailed(
  graph: Graph,
  rhsFlows?: number[],
  prevPressures?: number[],
): SolveResult {
  const N = graph.nodes.length;
  if (N === 0) return { pressures: [], iterations: 0, residual: 0, converged: true };
  if (N === 1) return { pressures: [0], iterations: 0, residual: 0, converged: true };

  let rawFlows: number[];
  if (rhsFlows) {
    rawFlows = new Array<number>(N);
    for (let k = 0; k < N; k++) rawFlows[k] = rhsFlows[k] ?? 0;
  } else {
    rawFlows = normalizedNodeFlows(graph);
  }

  const visited = new Uint8Array(N);
  const pressures = new Array<number>(N).fill(0);
  let totalIterations = 0;
  let maxResidual = 0;
  let allConverged = true;

  for (let start = 0; start < N; start++) {
    if (visited[start]) continue;
    visited[start] = 1;
    const queue = [start];
    const compNodes: number[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      compNodes.push(u);
      for (const edgeIdx of graph.adj[u]) {
        const edge = graph.edges[edgeIdx];
        if (edgeConductance(edge) <= 0) continue;
        const v = edge.i === u ? edge.j : edge.i;
        if (!visited[v]) {
          visited[v] = 1;
          queue.push(v);
        }
      }
    }

    if (compNodes.length < 2) continue;
    compNodes.sort((a, b) => a - b);

    let compPos = 0;
    let compNeg = 0;
    for (const u of compNodes) {
      if (rawFlows[u] > 0) compPos += rawFlows[u];
      else if (rawFlows[u] < 0) compNeg += -rawFlows[u];
    }
    if (compPos <= 1e-12 || compNeg <= 1e-12) continue;

    // Ground the lowest-index node g in the component (p[g] = 0).
    const groundNode = compNodes[0];
    const localIdx = new Map<number, number>();
    for (let m = 0; m < compNodes.length; m++) localIdx.set(compNodes[m], m);

    const reducedN = compNodes.length - 1;
    const bReduced = new Array<number>(reducedN).fill(0);
    const needRebalance = Math.abs(compPos - compNeg) > 1e-9 * (compPos + compNeg);
    const targetFlux = rhsFlows ? 0.5 * (compPos + compNeg) : 1;

    for (let m = 1; m < compNodes.length; m++) {
      const u = compNodes[m];
      let f = rawFlows[u];
      if (needRebalance) {
        if (f > 0) f = (f / compPos) * targetFlux;
        else if (f < 0) f = (f / compNeg) * targetFlux;
      }
      bReduced[m - 1] = f;
    }

    // Collect local sparse edges and diagonal for fast Jacobi PCG.
    const localEdges: Array<{ a: number; b: number; w: number }> = [];
    const diag = new Array<number>(reducedN).fill(0);
    const compSet = new Set(compNodes);

    for (const edge of graph.edges) {
      if (!compSet.has(edge.i) || !compSet.has(edge.j)) continue;
      const w = edgeConductance(edge);
      if (w <= 0) continue;
      const la = localIdx.get(edge.i)!;
      const lb = localIdx.get(edge.j)!;
      if (la === lb) continue;
      localEdges.push({ a: la, b: lb, w });
      if (la > 0) diag[la - 1] += w;
      if (lb > 0) diag[lb - 1] += w;
    }

    const matvec = (v: number[]): number[] => {
      const out = new Array<number>(reducedN).fill(0);
      for (const e of localEdges) {
        if (e.a === 0) {
          out[e.b - 1] += e.w * v[e.b - 1];
        } else if (e.b === 0) {
          out[e.a - 1] += e.w * v[e.a - 1];
        } else {
          const va = v[e.a - 1];
          const vb = v[e.b - 1];
          out[e.a - 1] += e.w * (va - vb);
          out[e.b - 1] += e.w * (vb - va);
        }
      }
      return out;
    };

    const x0 = new Array<number>(reducedN).fill(0);
    if (
      prevPressures &&
      Number.isFinite(prevPressures[groundNode])
    ) {
      const pGround = prevPressures[groundNode];
      for (let m = 1; m < compNodes.length; m++) {
        const pu = prevPressures[compNodes[m]];
        if (Number.isFinite(pu)) x0[m - 1] = pu - pGround;
      }
    }

    const solved = pcg(matvec, diag, bReduced, x0, 1e-7, Math.max(300, reducedN * 4));
    for (let m = 1; m < compNodes.length; m++) {
      pressures[compNodes[m]] = solved.x[m - 1];
    }
    totalIterations += solved.iterations;
    maxResidual = Math.max(maxResidual, solved.residual);
    if (!solved.converged) allConverged = false;
  }

  return {
    pressures,
    iterations: totalIterations,
    residual: maxResidual,
    converged: allConverged,
  };
}

export function solvePressures(graph: Graph): number[] {
  return solvePressuresDetailed(graph).pressures;
}
