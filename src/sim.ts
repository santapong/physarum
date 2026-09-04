import type { Graph } from "./graph";
import { solvePressures } from "./solver";

export interface StepMetrics {
  maxChange: number;
  meanChange: number;
}

export function step(graph: Graph, mu: number, dt: number): StepMetrics {
  if (graph.edges.length === 0) return { maxChange: 0, meanChange: 0 };
  const p = solvePressures(graph);
  let maxChange = 0;
  let totalChange = 0;
  for (const edge of graph.edges) {
    const w = edge.D / edge.length;
    const q = Math.abs(w * (p[edge.i] - p[edge.j]));
    const qm = Math.pow(q, mu);
    const f = qm / (1 + qm);
    const change = dt * (f - edge.D);
    edge.D = Math.max(0, Math.min(1, edge.D + change));
    maxChange = Math.max(maxChange, Math.abs(change));
    totalChange += Math.abs(change);
  }
  return { maxChange, meanChange: totalChange / graph.edges.length };
}
