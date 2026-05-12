import type { Graph } from './graph';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function render(ctx: CanvasRenderingContext2D, graph: Graph): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#000';
  for (const edge of graph.edges) {
    const d = Math.max(0, Math.min(1, edge.D));
    ctx.globalAlpha = d;
    ctx.lineWidth = lerp(0.5, 8, d);
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  for (const node of graph.nodes) {
    if (node.flow > 0) ctx.fillStyle = '#22c55e';
    else if (node.flow < 0) ctx.fillStyle = '#ef4444';
    else ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
