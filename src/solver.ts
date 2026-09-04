import type { Graph } from './graph';

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
  maxIter: number
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

export function solvePressures(graph: Graph): number[] {
  const N = graph.nodes.length;
  if (N === 0) return [];
  if (N === 1) return [0];

  let posSum = 0;
  let negSum = 0;
  for (const node of graph.nodes) {
    if (node.flow > 0) posSum += node.flow;
    else if (node.flow < 0) negSum += -node.flow;
  }

  const reducedN = N - 1;
  const bReduced = new Array<number>(reducedN).fill(0);
  for (let k = 1; k < N; k++) {
    const f = graph.nodes[k].flow;
    let nf = 0;
    if (f > 0 && posSum > 0) nf = f / posSum;
    else if (f < 0 && negSum > 0) nf = f / negSum;
    bReduced[k - 1] = nf;
  }

  // Grounded reduced Laplacian matvec: row/col 0 dropped, p[0]=0 implicit.
  const matvec = (v: number[]): number[] => {
    const out = new Array<number>(reducedN).fill(0);
    for (const edge of graph.edges) {
      const w = edge.D / edge.length;
      const a = edge.i;
      const c = edge.j;
      if (a === 0 && c === 0) continue;
      if (a === 0) {
        out[c - 1] += w * v[c - 1];
      } else if (c === 0) {
        out[a - 1] += w * v[a - 1];
      } else {
        const va = v[a - 1];
        const vc = v[c - 1];
        out[a - 1] += w * (va - vc);
        out[c - 1] += w * (vc - va);
      }
    }
    return out;
  };

  const x0 = new Array<number>(reducedN).fill(0);
  const pReduced = cg(matvec, bReduced, x0, 1e-6, 200);

  const result = new Array<number>(N).fill(0);
  for (let k = 1; k < N; k++) result[k] = pReduced[k - 1];
  return result;
}
