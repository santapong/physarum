import type { Graph } from "./graph";
import { solvePressures } from "./solver";

export function step(graph: Graph, mu: number, dt: number): void {
  if (graph.edges.length === 0) return;
  const p = solvePressures(graph);
  for (const edge of graph.edges) {
    const w = edge.D / edge.length;
    const q = Math.abs(w * (p[edge.i] - p[edge.j]));
    const qm = Math.pow(q, mu);
    const f = qm / (1 + qm);
    edge.D += dt * (f - edge.D);
  }
}
