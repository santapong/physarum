import type { FlowMode, Graph } from './graph';
import type { TerrainField } from './terrain';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export interface RenderOptions {
  backgroundImage?: HTMLImageElement | null;
  terrain?: TerrainField | null;
  flowMode?: FlowMode;
  showMst?: boolean;
  mstEdgeIndices?: number[];
  showPressure?: boolean;
  pressures?: number[];
  showFlowParticles?: boolean;
  phase?: number;
  hoveredEdgeIndex?: number | null;
  showLabels?: boolean;
}

function pressureColor(t: number): string {
  // Cool blue (low pressure) -> slate -> emerald-lime (high pressure)
  const clamped = clamp01(t);
  if (clamped < 0.5) {
    const u = clamped * 2;
    const r = Math.round(lerp(37, 148, u));
    const g = Math.round(lerp(99, 163, u));
    const b = Math.round(lerp(235, 184, u));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const u = (clamped - 0.5) * 2;
  const r = Math.round(lerp(148, 22, u));
  const g = Math.round(lerp(163, 163, u));
  const b = Math.round(lerp(184, 74, u));
  return `rgb(${r}, ${g}, ${b})`;
}

export function render(ctx: CanvasRenderingContext2D, graph: Graph, options: RenderOptions = {}): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (options.backgroundImage?.complete && options.backgroundImage.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(options.backgroundImage, 0, 0, w, h);
    ctx.restore();
  }

  // 1. Light / obstacle terrain mask
  const terrain = options.terrain;
  if (terrain) {
    const cellW = w / terrain.cols;
    const cellH = h / terrain.rows;
    ctx.save();
    for (let row = 0; row < terrain.rows; row++) {
      for (let col = 0; col < terrain.cols; col++) {
        const val = terrain.data[row * terrain.cols + col];
        if (val <= 0.04) continue;
        ctx.fillStyle = `rgba(217, 146, 28, ${(0.34 * val).toFixed(3)})`;
        ctx.fillRect(col * cellW, row * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
    ctx.restore();
  }

  // 2. Optional MST baseline overlay
  if (options.showMst && options.mstEdgeIndices && options.mstEdgeIndices.length > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.58)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([6, 4]);
    for (const idx of options.mstEdgeIndices) {
      const edge = graph.edges[idx];
      if (!edge) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Physarum tubes + severed markers
  ctx.save();
  ctx.lineCap = 'round';
  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];

    if (edge.severed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.setLineDash([]);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 4, my - 4);
      ctx.lineTo(mx + 4, my + 4);
      ctx.moveTo(mx + 4, my - 4);
      ctx.lineTo(mx - 4, my + 4);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    const d = clamp01(edge.D);
    if (d <= 0.003 && idx !== options.hoveredEdgeIndex) continue;

    if (idx === options.hoveredEdgeIndex) {
      ctx.save();
      ctx.strokeStyle = 'rgba(22, 163, 74, 0.35)';
      ctx.lineWidth = lerp(0.8, 8.5, d) + 6;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = Math.max(0.04, d);
    ctx.strokeStyle =
      idx === options.hoveredEdgeIndex
        ? '#15803d'
        : d > 0.6
          ? '#1c1917'
          : '#1e241b';
    ctx.lineWidth = lerp(0.6, 8.5, d);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  // 4. Optional animated flow pulses
  if (options.showFlowParticles) {
    const phase = options.phase ?? 0;
    ctx.save();
    for (const edge of graph.edges) {
      if (edge.severed || edge.D <= 0.08 || Math.abs(edge.flow) <= 0.03) continue;
      const a = graph.nodes[edge.i];
      const b = graph.nodes[edge.j];
      const forward = edge.flow >= 0;
      const sx = forward ? a.x : b.x;
      const sy = forward ? a.y : b.y;
      const ex = forward ? b.x : a.x;
      const ey = forward ? b.y : a.y;
      const count = edge.length > 90 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const t = (phase + k / count) % 1;
        const px = lerp(sx, ex, t);
        const py = lerp(sy, ey, t);
        ctx.fillStyle = '#a3e66f';
        ctx.strokeStyle = '#141812';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 5. Nodes (+ optional pressure coloring & station labels)
  let minP = 0;
  let maxP = 0;
  let hasPressureRange = false;
  if (options.showPressure && options.pressures && options.pressures.length === graph.nodes.length) {
    minP = Infinity;
    maxP = -Infinity;
    for (const p of options.pressures) {
      if (Number.isFinite(p)) {
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      }
    }
    hasPressureRange = Number.isFinite(minP) && Number.isFinite(maxP) && maxP - minP > 1e-12;
  }

  const isMulti = options.flowMode === 'multi-terminal';
  ctx.save();
  for (const node of graph.nodes) {
    if (hasPressureRange && options.pressures) {
      const pNorm = (options.pressures[node.id] - minP) / (maxP - minP);
      ctx.fillStyle = pressureColor(pNorm);
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(node.x, node.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    let radius = 4.5;
    if (isMulti) {
      if (node.flow !== 0) {
        ctx.fillStyle = '#d97706';
        radius = 6.5;
      } else {
        ctx.fillStyle = '#9ca3af';
        radius = 4;
      }
    } else if (node.flow > 0) {
      ctx.fillStyle = '#22c55e';
      radius = 6.5;
    } else if (node.flow < 0) {
      ctx.fillStyle = '#ef4444';
      radius = 6.5;
    } else {
      ctx.fillStyle = '#6b7280';
      radius = 4.5;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (node.flow !== 0) {
      ctx.strokeStyle = '#141812';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  if (options.showLabels) {
    ctx.font = '600 11px Inter, ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const node of graph.nodes) {
      if (!node.label) continue;
      const ly = Math.max(14, node.y - 9);
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = 'rgba(243, 242, 232, 0.92)';
      ctx.strokeText(node.label, node.x, ly);
      ctx.fillStyle = '#111827';
      ctx.fillText(node.label, node.x, ly);
    }
  }
  ctx.restore();
}
