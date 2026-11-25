import type { Graph } from './graph';
import { effectiveEdgeCost, normalizedNodeFlows } from './solver';

export interface ExactFlowSolution {
  optimalCost: number;
  feasible: boolean;
  edgeOptimalFlows: number[];
  optimalEdgeIndices: number[];
}

export interface OptimizationMetrics {
  primalFlowCost: number;
  exactOptCost: number;
  optimalityGapPct: number;
  feasible: boolean;
  conductanceCost: number;
  electricalPower: number;
  lyapunovEnergy: number;
  maxCapacityViolation: number;
  activeMemristors: number;
  totalMemristors: number;
  sparsityPct: number;
  conductanceDynamicRange: number;
  effectiveResistance: number;
  optimalEdgeIndices: number[];
}

interface FlowArc {
  to: number;
  rev: number;
  cap: number;
  cost: number;
}

const INF_CAP = 1e6;
const FLOW_EPS = 1e-9;

/**
 * Exact Successive Shortest Augmenting Path (SPFA) solver for uncapacitated Shortest Path
 * and Capacitated Min-Cost Flow on the current graph and effective edge costs.
 */
export function solveExactMinCostFlow(graph: Graph): ExactFlowSolution {
  const n = graph.nodes.length;
  const flows = normalizedNodeFlows(graph);
  const totalSupply = flows.reduce((acc, f) => (f > 0 ? acc + f : acc), 0);

  if (n < 2 || graph.edges.length === 0 || totalSupply <= 1e-9) {
    return {
      optimalCost: 0,
      feasible: false,
      edgeOptimalFlows: new Array<number>(graph.edges.length).fill(0),
      optimalEdgeIndices: [],
    };
  }

  const S = n;
  const T = n + 1;
  const numV = n + 2;
  const adj: FlowArc[][] = Array.from({ length: numV }, () => []);

  const addDirected = (u: number, v: number, cap: number, cost: number): number => {
    const fwdIdx = adj[u].length;
    const revIdx = adj[v].length;
    adj[u].push({ to: v, rev: revIdx, cap, cost });
    adj[v].push({ to: u, rev: fwdIdx, cap: 0, cost: -cost });
    return fwdIdx;
  };

  for (let k = 0; k < n; k++) {
    if (flows[k] > 1e-12) addDirected(S, k, flows[k], 0);
    else if (flows[k] < -1e-12) addDirected(k, T, -flows[k], 0);
  }

  const trackedArcs: Array<{
    edgeIdx: number;
    fwdCap0: number;
    fwdArcIdx: number;
    bwdArcIdx: number;
  }> = [];

  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    if (edge.severed) continue;
    const cap =
      edge.capacity !== undefined && Number.isFinite(edge.capacity) && edge.capacity > 0
        ? edge.capacity
        : INF_CAP;
    const cost = effectiveEdgeCost(edge);
    const fwdArcIdx = addDirected(edge.i, edge.j, cap, cost);
    const bwdArcIdx = addDirected(edge.j, edge.i, cap, cost);
    trackedArcs.push({ edgeIdx: idx, fwdCap0: cap, fwdArcIdx, bwdArcIdx });
  }

  const dist = new Float64Array(numV);
  const parentV = new Int32Array(numV);
  const parentE = new Int32Array(numV);
  const inQueue = new Uint8Array(numV);

  let routedFlow = 0;
  const maxAug = graph.edges.length * 6 + graph.nodes.length * 4 + 64;
  const maxRelax = numV * (numV + 2) * 4;

  for (let aug = 0; aug < maxAug && routedFlow < totalSupply - FLOW_EPS; aug++) {
    dist.fill(Number.POSITIVE_INFINITY);
    parentV.fill(-1);
    parentE.fill(-1);
    inQueue.fill(0);

    dist[S] = 0;
    const queue: number[] = [S];
    inQueue[S] = 1;
    let qHead = 0;
    let relaxSteps = 0;

    while (qHead < queue.length && relaxSteps < maxRelax) {
      const u = queue[qHead++];
      inQueue[u] = 0;
      const du = dist[u];
      const uAdj = adj[u];
      for (let eIdx = 0; eIdx < uAdj.length; eIdx++) {
        const arc = uAdj[eIdx];
        if (arc.cap <= FLOW_EPS) continue;
        const nextDist = du + arc.cost;
        if (dist[arc.to] > nextDist + FLOW_EPS) {
          dist[arc.to] = nextDist;
          parentV[arc.to] = u;
          parentE[arc.to] = eIdx;
          relaxSteps++;
          if (!inQueue[arc.to]) {
            queue.push(arc.to);
            inQueue[arc.to] = 1;
          }
        }
      }
    }

    if (!Number.isFinite(dist[T]) || parentV[T] === -1) break;

    let push = totalSupply - routedFlow;
    for (let v = T; v !== S; v = parentV[v]) {
      const u = parentV[v];
      const arc = adj[u][parentE[v]];
      if (arc.cap < push) push = arc.cap;
    }
    if (push <= FLOW_EPS) break;

    for (let v = T; v !== S; v = parentV[v]) {
      const u = parentV[v];
      const arc = adj[u][parentE[v]];
      arc.cap -= push;
      adj[v][arc.rev].cap += push;
    }
    routedFlow += push;
  }

  const edgeOptimalFlows = new Array<number>(graph.edges.length).fill(0);
  const optimalEdgeIndices: number[] = [];
  let optimalCost = 0;

  for (const item of trackedArcs) {
    const edge = graph.edges[item.edgeIdx];
    const fwdUsed = item.fwdCap0 - adj[edge.i][item.fwdArcIdx].cap;
    const bwdUsed = item.fwdCap0 - adj[edge.j][item.bwdArcIdx].cap;
    const netFlow = Math.abs(fwdUsed - bwdUsed);
    edgeOptimalFlows[item.edgeIdx] = netFlow;
    if (netFlow > 1e-5) {
      optimalEdgeIndices.push(item.edgeIdx);
    }
    optimalCost += effectiveEdgeCost(edge) * netFlow;
  }

  return {
    optimalCost,
    feasible: Math.abs(routedFlow - totalSupply) < 1e-5,
    edgeOptimalFlows,
    optimalEdgeIndices,
  };
}

/**
 * Compute Bonifaci et al. (2012) & Straszak-Vishnoi (2016) optimization,
 * Lyapunov potential, capacity feasibility, and analog crossbar hardware telemetry.
 */
export function computeOptimizationMetrics(
  graph: Graph,
  pressures: number[],
  cachedExact?: ExactFlowSolution,
): OptimizationMetrics {
  const exact = cachedExact ?? solveExactMinCostFlow(graph);
  const flows = normalizedNodeFlows(graph);

  let primalFlowCost = 0;
  let conductanceCost = 0;
  let maxCapacityViolation = 0;
  let activeMemristors = 0;
  let totalMemristors = 0;
  let minG = Number.POSITIVE_INFINITY;
  let maxG = 0;

  for (const edge of graph.edges) {
    if (edge.severed) continue;
    totalMemristors++;
    const effCost = effectiveEdgeCost(edge);
    const qAbs = Math.abs(edge.flow);
    primalFlowCost += effCost * qAbs;
    conductanceCost += effCost * edge.D;

    if (edge.D >= 0.01) activeMemristors++;

    const congestionScale = 1 + Math.max(edge.congestion ?? 0, 0);
    const g = edge.D / (effCost * congestionScale);
    if (g > maxG) maxG = g;
    if (g < minG) minG = g;

    if (edge.capacity !== undefined && Number.isFinite(edge.capacity)) {
      const violation = Math.max(0, qAbs - edge.capacity);
      if (violation > maxCapacityViolation) maxCapacityViolation = violation;
    }
  }

  let electricalPower = 0;
  for (let k = 0; k < graph.nodes.length; k++) {
    const p = pressures[k];
    if (Number.isFinite(p)) electricalPower += flows[k] * p;
  }
  electricalPower = Math.max(0, electricalPower);

  const lyapunovEnergy = 0.5 * (conductanceCost + electricalPower);
  const optimalityGapPct =
    exact.feasible && exact.optimalCost > 0
      ? Math.max(0, ((primalFlowCost - exact.optimalCost) / exact.optimalCost) * 100)
      : 0;
  const sparsityPct =
    totalMemristors > 0 ? (1 - activeMemristors / totalMemristors) * 100 : 0;
  const conductanceDynamicRange =
    totalMemristors > 0 && maxG > 0 ? maxG / Math.max(minG, 1e-12) : 1;

  return {
    primalFlowCost,
    exactOptCost: exact.optimalCost,
    optimalityGapPct,
    feasible: exact.feasible,
    conductanceCost,
    electricalPower,
    lyapunovEnergy,
    maxCapacityViolation,
    activeMemristors,
    totalMemristors,
    sparsityPct,
    conductanceDynamicRange,
    effectiveResistance: electricalPower,
    optimalEdgeIndices: exact.optimalEdgeIndices,
  };
}

/**
 * Export an equivalent steady-state resistive crossbar SPICE netlist (.cir)
 * ready for ngspice / LTspice operating-point (.op) verification.
 */
export function exportSpiceNetlist(
  graph: Graph,
  pressures: number[],
  options: { seed: number; iteration: number; activeThreshold?: number },
): string {
  const activeThreshold = options.activeThreshold ?? 0.01;
  const flows = normalizedNodeFlows(graph);

  let groundNode = 0;
  for (let k = 0; k < graph.nodes.length; k++) {
    if (graph.adj[k].some((eIdx) => !graph.edges[eIdx].severed)) {
      groundNode = k;
      break;
    }
  }

  const lines: string[] = [
    `* Physarum Analog Resistor-Crossbar Netlist (seed=${options.seed}, step=${options.iteration})`,
    `* Effective conductance G_e = D_e / (c_e * (1 + lambda_e))`,
    `V_GND n${groundNode} 0 DC 0`,
  ];

  for (let k = 0; k < graph.nodes.length; k++) {
    const f = flows[k];
    if (Math.abs(f) <= 1e-9) continue;
    const comment = graph.nodes[k].label ? ` ; ${graph.nodes[k].label}` : '';
    // Positive current from 0 -> n_k injects +f A into node n_k.
    lines.push(`I_node_${k} 0 n${k} DC ${f.toFixed(6)}${comment}`);
  }

  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    if (edge.severed || edge.D < activeThreshold) {
      lines.push(`R_${idx} n${edge.i} n${edge.j} 1.000000e+09 ; OFF / pruned`);
      continue;
    }
    const congestionScale = 1 + Math.max(edge.congestion ?? 0, 0);
    const g = edge.D / (effectiveEdgeCost(edge) * congestionScale);
    const resistance = g > 1e-12 ? 1 / g : 1e9;
    lines.push(
      `R_${idx} n${edge.i} n${edge.j} ${resistance.toFixed(6)} ; D=${edge.D.toFixed(4)} |Q|=${Math.abs(edge.flow).toFixed(4)}`,
    );
  }

  if (pressures.length === graph.nodes.length && graph.nodes.length > 0) {
    const pRef = Number.isFinite(pressures[groundNode]) ? pressures[groundNode] : 0;
    const summary = graph.nodes
      .slice(0, 8)
      .map((n, k) => `V(n${n.id})=${((pressures[k] ?? 0) - pRef).toFixed(3)}`)
      .join(' ');
    lines.push(`* Predicted node potentials: ${summary}`);
  }

  lines.push('.op');
  lines.push('.end');
  return lines.join('\n');
}
