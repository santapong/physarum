import type { Graph } from './graph';
import { effectiveEdgeCost } from './solver';
import type { TerrainField } from './terrain';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './terrain';

export const PLATE_WIDTH_MM = 90;
export const PLATE_HEIGHT_MM = 60;
export const PX_PER_MM = CANVAS_WIDTH / PLATE_WIDTH_MM;

export interface VascularMetrics {
  activeChannels: number;
  murrayRatio: number;
  murrayCompliancePct: number;
  bifurcationCount: number;
  hydraulicPower: number;
  pressureDrop: number;
  fluidVolumeMm3: number;
  shearUniformityCv: number;
  maxRadiusMm: number;
  minActiveRadiusMm: number;
  edgeRadiiMm: number[];
  edgeShearNorm: number[];
}

export function edgeRadiusMm(D: number, maxRadiusMm: number): number {
  if (!Number.isFinite(D) || D <= 0 || !Number.isFinite(maxRadiusMm) || maxRadiusMm <= 0) {
    return 0;
  }
  return maxRadiusMm * Math.pow(Math.min(1, D), 0.25);
}

/**
 * Evaluate Hagen-Poiseuille microfluidic channel radii, Murray's Law (r_p^3 = sum r_c^3)
 * bifurcation compliance, wall shear stress uniformity, and hydraulic dissipation.
 */
export function computeVascularMetrics(
  graph: Graph,
  pressures: number[],
  options: { maxRadiusMm?: number; activeThreshold?: number } = {},
): VascularMetrics {
  const maxRadiusMm = options.maxRadiusMm ?? 2.0;
  const activeThreshold = options.activeThreshold ?? 0.005;
  const edgeRadiiMm = new Array<number>(graph.edges.length).fill(0);
  const edgeShearNorm = new Array<number>(graph.edges.length).fill(0);
  const activeIncident = new Uint8Array(graph.nodes.length);

  let activeChannels = 0;
  let hydraulicPower = 0;
  let fluidVolumeMm3 = 0;
  let minActiveRadiusMm = Number.POSITIVE_INFINITY;
  const activeShears: number[] = [];

  for (let idx = 0; idx < graph.edges.length; idx++) {
    const edge = graph.edges[idx];
    if (edge.severed || edge.D <= 1e-12) continue;

    const rMm = edgeRadiusMm(edge.D, maxRadiusMm);
    edgeRadiiMm[idx] = rMm;

    const effCost = effectiveEdgeCost(edge);
    hydraulicPower += (edge.flow * edge.flow * effCost) / edge.D;

    if (edge.D >= activeThreshold) {
      activeChannels++;
      activeIncident[edge.i] = 1;
      activeIncident[edge.j] = 1;
      if (rMm < minActiveRadiusMm) minActiveRadiusMm = rMm;

      const lengthMm = edge.length / PX_PER_MM;
      fluidVolumeMm3 += Math.PI * rMm * rMm * lengthMm;

      const shear = Math.abs(edge.flow) / Math.pow(edge.D, 0.75);
      edgeShearNorm[idx] = shear;
      if (Math.abs(edge.flow) > 1e-5 && Number.isFinite(shear)) {
        activeShears.push(shear);
      }
    }
  }

  let minP = Number.POSITIVE_INFINITY;
  let maxP = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < graph.nodes.length; i++) {
    if (!activeIncident[i]) continue;
    const p = pressures[i];
    if (!Number.isFinite(p)) continue;
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  const pressureDrop =
    Number.isFinite(minP) && Number.isFinite(maxP) ? Math.max(0, maxP - minP) : 0;

  let ratioSum = 0;
  let deviationSum = 0;
  let bifurcationCount = 0;

  for (const node of graph.nodes) {
    if (node.flow !== 0) continue;
    const incident = graph.adj[node.id];
    let activeTouchCount = 0;
    let sumInR3 = 0;
    let sumOutR3 = 0;

    for (const edgeIdx of incident) {
      const edge = graph.edges[edgeIdx];
      if (edge.severed || edge.D < activeThreshold) continue;
      activeTouchCount++;
      const r3 = Math.pow(edgeRadiiMm[edgeIdx], 3);
      const signedOut = edge.i === node.id ? edge.flow : -edge.flow;
      if (signedOut > 1e-9) {
        sumOutR3 += r3;
      } else if (signedOut < -1e-9) {
        sumInR3 += r3;
      }
    }

    if (activeTouchCount >= 3 && sumInR3 > 1e-9 && sumOutR3 > 1e-9) {
      const ratio = sumOutR3 / sumInR3;
      ratioSum += ratio;
      deviationSum += Math.abs(ratio - 1);
      bifurcationCount++;
    }
  }

  const murrayRatio = bifurcationCount > 0 ? ratioSum / bifurcationCount : 0;
  const murrayCompliancePct =
    bifurcationCount > 0
      ? Math.max(0, 100 * (1 - deviationSum / bifurcationCount))
      : 0;

  let shearUniformityCv = 0;
  if (activeShears.length >= 2) {
    const mean = activeShears.reduce((acc, v) => acc + v, 0) / activeShears.length;
    if (mean > 1e-12) {
      const variance =
        activeShears.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) /
        activeShears.length;
      shearUniformityCv = Math.sqrt(variance) / mean;
    }
  }

  return {
    activeChannels,
    murrayRatio,
    murrayCompliancePct,
    bifurcationCount,
    hydraulicPower,
    pressureDrop,
    fluidVolumeMm3,
    shearUniformityCv,
    maxRadiusMm,
    minActiveRadiusMm: Number.isFinite(minActiveRadiusMm) ? minActiveRadiusMm : 0,
    edgeRadiiMm,
    edgeShearNorm,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export a 1:1 millimeter-scale SVG microfluidic mask (90 mm x 60 mm)
 * suitable for laser cutting, SLA mask lithography, or vector CAD import.
 */
export function exportVascularSvg(
  graph: Graph,
  terrain: TerrainField | null,
  options: { maxRadiusMm: number; seed: number; iteration: number; activeThreshold?: number },
): string {
  const activeThreshold = options.activeThreshold ?? 0.005;
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PLATE_WIDTH_MM}mm" height="${PLATE_HEIGHT_MM}mm" viewBox="0 0 ${PLATE_WIDTH_MM} ${PLATE_HEIGHT_MM}">`,
    `  <title>Physarum Vascular Scaffold (seed=${options.seed}, step=${options.iteration})</title>`,
    `  <rect x="0" y="0" width="${PLATE_WIDTH_MM}" height="${PLATE_HEIGHT_MM}" fill="#ffffff" stroke="#111827" stroke-width="0.3" />`,
  ];

  if (terrain) {
    const cellW = PLATE_WIDTH_MM / terrain.cols;
    const cellH = PLATE_HEIGHT_MM / terrain.rows;
    lines.push('  <g id="keepout-zones" fill="#fde68a" fill-opacity="0.65">');
    for (let row = 0; row < terrain.rows; row++) {
      for (let col = 0; col < terrain.cols; col++) {
        const val = terrain.data[row * terrain.cols + col];
        if (val <= 0.04) continue;
        lines.push(
          `    <rect x="${(col * cellW).toFixed(2)}" y="${(row * cellH).toFixed(2)}" width="${(cellW + 0.02).toFixed(2)}" height="${(cellH + 0.02).toFixed(2)}" opacity="${Math.min(1, val).toFixed(2)}" />`,
        );
      }
    }
    lines.push('  </g>');
  }

  lines.push('  <g id="microfluidic-channels" fill="none" stroke="#991b1b" stroke-linecap="round">');
  for (const edge of graph.edges) {
    if (edge.severed || edge.D < activeThreshold) continue;
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];
    const widthMm = Math.max(0.12, 2 * edgeRadiusMm(edge.D, options.maxRadiusMm));
    lines.push(
      `    <line x1="${(a.x / PX_PER_MM).toFixed(3)}" y1="${(a.y / PX_PER_MM).toFixed(3)}" x2="${(b.x / PX_PER_MM).toFixed(3)}" y2="${(b.y / PX_PER_MM).toFixed(3)}" stroke-width="${widthMm.toFixed(3)}" />`,
    );
  }
  lines.push('  </g>');

  lines.push('  <g id="manifold-ports">');
  for (const node of graph.nodes) {
    if (node.flow === 0) continue;
    const cx = (node.x / PX_PER_MM).toFixed(3);
    const cy = (node.y / PX_PER_MM).toFixed(3);
    const r = Math.max(0.7, options.maxRadiusMm * 0.9).toFixed(3);
    const fill = node.flow > 0 ? '#16a34a' : '#dc2626';
    const labelAttr = node.label ? ` data-label="${escapeXml(node.label)}"` : '';
    lines.push(`    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${labelAttr} />`);
  }
  lines.push('  </g>');
  lines.push('</svg>');
  return lines.join('\n');
}

/**
 * Export a parametric OpenSCAD 3D microfluidic plate / soft-actuator mold (.scad)
 * with embedded cylindrical channels (Murray-scaled radii) and vertical inlet/outlet ports.
 */
export function exportVascularOpenScad(
  graph: Graph,
  options: {
    maxRadiusMm: number;
    seed: number;
    iteration: number;
    plateThicknessMm?: number;
    activeThreshold?: number;
  },
): string {
  const activeThreshold = options.activeThreshold ?? 0.005;
  const plateH = options.plateThicknessMm ?? Math.max(4, options.maxRadiusMm * 2 + 2.4);
  const channelZ = plateH * 0.5;
  const toCadY = (yPx: number): number => (CANVAS_HEIGHT - yPx) / PX_PER_MM;

  const lines: string[] = [
    `// Physarum Vascular / Soft-Robotics Manifold Plate`,
    `// seed = ${options.seed}, step = ${options.iteration}, max_radius_mm = ${options.maxRadiusMm.toFixed(3)}`,
    `$fn = 24;`,
    `plate_w = ${PLATE_WIDTH_MM};`,
    `plate_h_y = ${PLATE_HEIGHT_MM};`,
    `plate_z = ${plateH.toFixed(2)};`,
    `channel_z = ${channelZ.toFixed(2)};`,
    ``,
    `module vascular_channel(x1, y1, x2, y2, r) {`,
    `  hull() {`,
    `    translate([x1, y1, channel_z]) sphere(r = r);`,
    `    translate([x2, y2, channel_z]) sphere(r = r);`,
    `  }`,
    `}`,
    ``,
    `module manifold_port(x, y, r) {`,
    `  translate([x, y, channel_z]) cylinder(h = plate_z, r = r, center = false);`,
    `}`,
    ``,
    `difference() {`,
    `  cube([plate_w, plate_h_y, plate_z], center = false);`,
    `  union() {`,
  ];

  for (const edge of graph.edges) {
    if (edge.severed || edge.D < activeThreshold) continue;
    const a = graph.nodes[edge.i];
    const b = graph.nodes[edge.j];
    const r = Math.max(0.1, edgeRadiusMm(edge.D, options.maxRadiusMm));
    lines.push(
      `    vascular_channel(${(a.x / PX_PER_MM).toFixed(3)}, ${toCadY(a.y).toFixed(3)}, ${(b.x / PX_PER_MM).toFixed(3)}, ${toCadY(b.y).toFixed(3)}, ${r.toFixed(3)});`,
    );
  }

  for (const node of graph.nodes) {
    if (node.flow === 0) continue;
    const portR = Math.max(0.6, options.maxRadiusMm * 0.75);
    const comment = node.label ? ` // ${node.label.replace(/\r?\n/g, ' ')}` : '';
    lines.push(
      `    manifold_port(${(node.x / PX_PER_MM).toFixed(3)}, ${toCadY(node.y).toFixed(3)}, ${portR.toFixed(3)});${comment}`,
    );
  }

  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}
