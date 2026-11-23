import type { FlowMode, Graph } from './graph';
import { solvePressuresDetailed } from './solver';

export const D_LIVING_FLOOR = 1e-5;

export interface StepOptions {
  flowMode?: FlowMode;
  random?: () => number;
  prevPressures?: number[];
  pairSamples?: number;
}

export interface StepMetrics {
  maxChange: number;
  meanChange: number;
  pressures: number[];
  iterations: number;
  residual: number;
  converged: boolean;
  activePair?: [number, number];
}

function clampConductivity(value: number): number {
  return Math.max(D_LIVING_FLOOR, Math.min(1, value));
}

function sampleTerminalPairs(
  terminals: number[],
  maxPairs: number,
  random: () => number,
): Array<[number, number]> {
  const k = terminals.length;
  const totalPossible = Math.floor((k * (k - 1)) / 2);
  const count = Math.min(maxPairs, totalPossible);
  if (totalPossible <= count) {
    const all: Array<[number, number]> = [];
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        all.push([terminals[i], terminals[j]]);
      }
    }
    return all;
  }

  const pairs: Array<[number, number]> = [];
  const seen = new Set<string>();
  let attempts = 0;
  const maxAttempts = count * 12;
  while (pairs.length < count && attempts < maxAttempts) {
    attempts++;
    const aIdx = Math.floor(random() * k);
    let bIdx = Math.floor(random() * (k - 1));
    if (bIdx >= aIdx) bIdx++;
    const lo = Math.min(aIdx, bIdx);
    const hi = Math.max(aIdx, bIdx);
    const key = `${lo}_${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([terminals[aIdx], terminals[bIdx]]);
  }
  return pairs;
}

/**
 * Advance one Tero et al. (2010) conductivity adaptation tick using
 * unconditionally stable semi-implicit Euler integration.
 */
export function step(
  graph: Graph,
  mu: number,
  dt: number,
  options: StepOptions = {},
): StepMetrics {
  const flowMode = options.flowMode ?? 'source-sink';
  if (graph.edges.length === 0) {
    return {
      maxChange: 0,
      meanChange: 0,
      pressures: new Array<number>(graph.nodes.length).fill(0),
      iterations: 0,
      residual: 0,
      converged: true,
    };
  }

  if (flowMode === 'multi-terminal') {
    const terminals: number[] = [];
    for (const node of graph.nodes) {
      if (node.flow !== 0) terminals.push(node.id);
    }
    if (terminals.length < 2) {
      return {
        maxChange: 0,
        meanChange: 0,
        pressures: new Array<number>(graph.nodes.length).fill(0),
        iterations: 0,
        residual: 0,
        converged: true,
      };
    }

    const rand = options.random ?? Math.random;
    const pairs = sampleTerminalPairs(terminals, options.pairSamples ?? 8, rand);
    const nEdges = graph.edges.length;
    const flowSqSum = new Float64Array(nEdges);
    const lastSignedFlow = new Float64Array(nEdges);
    // Variance-normalized injection: each terminal is sampled in 2/K pairs, so
    // i0 = 0.65 * sqrt(K / 2) keeps RMS terminal load invariant to K.
    const i0 = 0.65 * Math.sqrt(terminals.length / 2);

    let lastPressures = new Array<number>(graph.nodes.length).fill(0);
    let totalIterations = 0;
    let maxResidual = 0;
    let allConverged = true;

    for (const [src, snk] of pairs) {
      const rhs = new Array<number>(graph.nodes.length).fill(0);
      rhs[src] = i0;
      rhs[snk] = -i0;
      const solved = solvePressuresDetailed(graph, rhs);
      lastPressures = solved.pressures;
      totalIterations += solved.iterations;
      maxResidual = Math.max(maxResidual, solved.residual);
      if (!solved.converged) allConverged = false;

      for (let eIdx = 0; eIdx < nEdges; eIdx++) {
        const edge = graph.edges[eIdx];
        if (edge.severed) continue;
        const w = edge.D / (edge.length * Math.max(edge.costFactor ?? 1, 1));
        const qSigned = w * (lastPressures[edge.i] - lastPressures[edge.j]);
        flowSqSum[eIdx] += qSigned * qSigned;
        lastSignedFlow[eIdx] = qSigned;
      }
    }

    const m = Math.max(1, pairs.length);
    let maxChange = 0;
    let totalChange = 0;
    for (let eIdx = 0; eIdx < nEdges; eIdx++) {
      const edge = graph.edges[eIdx];
      if (edge.severed) {
        edge.D = 0;
        edge.flow = 0;
        continue;
      }
      const rmsFlow = Math.sqrt(flowSqSum[eIdx] / m);
      const sign = lastSignedFlow[eIdx] < 0 ? -1 : 1;
      edge.flow = rmsFlow * sign;
      const qm = Math.pow(rmsFlow, mu);
      const f = qm / (1 + qm);
      const nextD = clampConductivity((edge.D + dt * f) / (1 + dt));
      const change = nextD - edge.D;
      edge.D = nextD;
      maxChange = Math.max(maxChange, Math.abs(change));
      totalChange += Math.abs(change);
    }

    return {
      maxChange,
      meanChange: totalChange / nEdges,
      pressures: lastPressures,
      iterations: totalIterations,
      residual: maxResidual,
      converged: allConverged,
      activePair: pairs[pairs.length - 1],
    };
  }

  const solved = solvePressuresDetailed(graph, undefined, options.prevPressures);
  const p = solved.pressures;
  let maxChange = 0;
  let totalChange = 0;

  for (const edge of graph.edges) {
    if (edge.severed) {
      edge.D = 0;
      edge.flow = 0;
      continue;
    }
    const w = edge.D / (edge.length * Math.max(edge.costFactor ?? 1, 1));
    const qSigned = w * (p[edge.i] - p[edge.j]);
    edge.flow = qSigned;
    const qm = Math.pow(Math.abs(qSigned), mu);
    const f = qm / (1 + qm);
    const nextD = clampConductivity((edge.D + dt * f) / (1 + dt));
    const change = nextD - edge.D;
    edge.D = nextD;
    maxChange = Math.max(maxChange, Math.abs(change));
    totalChange += Math.abs(change);
  }

  return {
    maxChange,
    meanChange: totalChange / graph.edges.length,
    pressures: p,
    iterations: solved.iterations,
    residual: solved.residual,
    converged: solved.converged,
  };
}
