import './style.css';

import {
  addNode,
  buildCompleteGraph,
  buildDelaunayGraph,
  emptyGraph,
  hasSourceAndSink,
  type Graph,
  type GraphMode,
  type Node,
} from './graph';
import { PRESETS, getPreset } from './presets';
import { createRandom, normalizeSeed } from './random';
import { render } from './render';
import { step, type StepMetrics } from './sim';
import { encodeState, stateFromHash, type SharedState } from './state';

type PlacementTool = 'internal' | 'source' | 'sink';

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing #${id}`);
  return value as T;
};

const canvas = element<HTMLCanvasElement>('c');
const canvasContext = canvas.getContext('2d');
if (!canvasContext) throw new Error('Canvas 2D is unavailable');
const ctx: CanvasRenderingContext2D = canvasContext;

const runBtn = element<HTMLButtonElement>('run');
const stepBtn = element<HTMLButtonElement>('step');
const restartBtn = element<HTMLButtonElement>('restart');
const clearBtn = element<HTMLButtonElement>('clear');
const shareBtn = element<HTMLButtonElement>('share');
const exportBtn = element<HTMLButtonElement>('export');
const randomSeedBtn = element<HTMLButtonElement>('random-seed');
const muInput = element<HTMLInputElement>('mu');
const dtInput = element<HTMLInputElement>('dt');
const speedInput = element<HTMLInputElement>('speed');
const seedInput = element<HTMLInputElement>('seed');
const modeSelect = element<HTMLSelectElement>('mode');
const presetSelect = element<HTMLSelectElement>('preset');
const mapFile = element<HTMLInputElement>('mapfile');
const clearMapBtn = element<HTMLButtonElement>('clearmap');
const stats = element<HTMLParagraphElement>('stats');
const statusText = element<HTMLSpanElement>('status-text');
const canvasSummary = element<HTMLParagraphElement>('canvas-summary');
const muValue = element<HTMLOutputElement>('mu-value');
const dtValue = element<HTMLOutputElement>('dt-value');
const speedValue = element<HTMLOutputElement>('speed-value');
const toolButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tool]'));

let mode: GraphMode = 'complete';
let mu = 1.2;
let simulationDt = 0.05;
let speed = 8;
let seed = 1207;
let running = false;
let placementTool: PlacementTool = 'internal';
let graph: Graph = emptyGraph();
let iteration = 0;
let lastMetrics: StepMetrics = { maxChange: 0, meanChange: 0 };
let lastFrameTs = performance.now();
let fpsAverage = 0;
let mapImage: HTMLImageElement | null = null;
let mapObjectUrl: string | null = null;

function buildGraph(nodes: Node[]): Graph {
  const random = createRandom(seed);
  return mode === 'delaunay'
    ? buildDelaunayGraph(nodes, random)
    : buildCompleteGraph(nodes, random);
}

function setRunning(next: boolean): void {
  running = next && hasSourceAndSink(graph);
  runBtn.textContent = running ? 'Pause' : 'Run';
  runBtn.setAttribute('aria-pressed', String(running));
}

function updateControls(): void {
  muInput.value = String(mu);
  dtInput.value = String(simulationDt);
  speedInput.value = String(speed);
  seedInput.value = String(seed);
  modeSelect.value = mode;
  muValue.value = mu.toFixed(2);
  dtValue.value = simulationDt.toFixed(2);
  speedValue.value = `${speed}×`;
}

function statusLabel(): string {
  if (!hasSourceAndSink(graph)) return 'Add a source and a sink';
  if (running) return lastMetrics.maxChange < 1e-5 ? 'Converged' : 'Adapting';
  if (iteration > 0 && lastMetrics.maxChange < 1e-5) return 'Converged';
  return iteration > 0 ? 'Paused' : 'Ready';
}

function updateStats(fps: number): void {
  const activeEdges = graph.edges.filter((edge) => edge.D >= 0.08).length;
  const sources = graph.nodes.filter((node) => node.flow > 0).length;
  const sinks = graph.nodes.filter((node) => node.flow < 0).length;
  const status = statusLabel();
  statusText.textContent = status;
  statusText.dataset.state = status.toLowerCase().replace(/ /g, '-');
  stats.textContent = `${graph.nodes.length} nodes · ${activeEdges}/${graph.edges.length} visible paths · ${iteration.toLocaleString()} steps · ${fps.toFixed(0)} fps`;
  canvasSummary.textContent = `Network canvas: ${graph.nodes.length} nodes, ${sources} sources, ${sinks} sinks, and ${activeEdges} visible paths. Simulation status: ${status}.`;
}

function draw(): void {
  render(ctx, graph, { backgroundImage: mapImage });
}

function runSteps(count: number): void {
  if (!hasSourceAndSink(graph)) return;
  for (let index = 0; index < count; index++) {
    lastMetrics = step(graph, mu, simulationDt);
  }
  iteration += count;
}

function restartGraph(): void {
  setRunning(false);
  graph = buildGraph(graph.nodes);
  iteration = 0;
  lastMetrics = { maxChange: 0, meanChange: 0 };
  draw();
  updateStats(fpsAverage);
}

function clearGraph(): void {
  setRunning(false);
  graph = emptyGraph();
  iteration = 0;
  lastMetrics = { maxChange: 0, meanChange: 0 };
  presetSelect.value = '';
  draw();
  updateStats(fpsAverage);
}

function applyState(state: SharedState, presetId = ''): void {
  setRunning(false);
  mode = state.mode;
  mu = state.mu;
  simulationDt = state.dt;
  speed = state.speed;
  seed = normalizeSeed(state.seed);
  graph = buildGraph(state.nodes);
  iteration = 0;
  lastMetrics = { maxChange: 0, meanChange: 0 };
  presetSelect.value = presetId;
  updateControls();
  draw();
  updateStats(fpsAverage);
}

function loadPreset(id: string): void {
  const preset = getPreset(id);
  applyState({
    version: 1,
    nodes: preset.nodes,
    mode: preset.mode,
    mu: preset.id === 'city-ring' ? 0.85 : 1.2,
    dt: 0.05,
    speed: 8,
    seed: preset.seed,
  }, preset.id);
  history.replaceState(null, '', location.pathname + location.search);
}

function currentState(): SharedState {
  return {
    version: 1,
    nodes: graph.nodes.map((node) => ({ ...node })),
    mode,
    mu,
    dt: simulationDt,
    speed,
    seed,
  };
}

async function copyShareLink(): Promise<void> {
  const hash = `state=${encodeState(currentState())}`;
  history.replaceState(null, '', `${location.pathname}${location.search}#${hash}`);
  try {
    await navigator.clipboard.writeText(location.href);
    shareBtn.textContent = 'Link copied';
  } catch {
    shareBtn.textContent = 'Link ready';
  }
  window.setTimeout(() => { shareBtn.textContent = 'Copy link'; }, 1800);
}

function exportPng(): void {
  draw();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `physarum-${seed}-${iteration}.png`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function setPlacementTool(tool: PlacementTool): void {
  placementTool = tool;
  for (const button of toolButtons) {
    const selected = button.dataset.tool === tool;
    button.setAttribute('aria-pressed', String(selected));
  }
}

for (const preset of PRESETS) {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.name;
  presetSelect.append(option);
}

presetSelect.addEventListener('change', () => {
  if (presetSelect.value) loadPreset(presetSelect.value);
});

for (const button of toolButtons) {
  button.addEventListener('click', () => setPlacementTool(button.dataset.tool as PlacementTool));
}

canvas.addEventListener('pointerdown', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width;
  const y = (event.clientY - rect.top) * canvas.height / rect.height;
  if (graph.nodes.some((node) => Math.hypot(node.x - x, node.y - y) < 14)) return;
  const tool = event.shiftKey ? 'source' : event.altKey ? 'sink' : placementTool;
  const flow = tool === 'source' ? 1 : tool === 'sink' ? -1 : 0;
  setRunning(false);
  graph = addNode(graph, x, y, flow, mode, createRandom(seed)).graph;
  iteration = 0;
  presetSelect.value = '';
  draw();
  updateStats(fpsAverage);
});

runBtn.addEventListener('click', () => setRunning(!running));
stepBtn.addEventListener('click', () => {
  setRunning(false);
  runSteps(speed);
  draw();
  updateStats(fpsAverage);
});
restartBtn.addEventListener('click', restartGraph);
clearBtn.addEventListener('click', clearGraph);
shareBtn.addEventListener('click', () => void copyShareLink());
exportBtn.addEventListener('click', exportPng);

muInput.addEventListener('input', () => {
  mu = Number(muInput.value);
  muValue.value = mu.toFixed(2);
});
dtInput.addEventListener('input', () => {
  simulationDt = Number(dtInput.value);
  dtValue.value = simulationDt.toFixed(2);
});
speedInput.addEventListener('input', () => {
  speed = Number(speedInput.value);
  speedValue.value = `${speed}×`;
});
seedInput.addEventListener('change', () => {
  seed = normalizeSeed(Number(seedInput.value));
  seedInput.value = String(seed);
  restartGraph();
});
randomSeedBtn.addEventListener('click', () => {
  seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  seedInput.value = String(seed);
  restartGraph();
});
modeSelect.addEventListener('change', () => {
  mode = modeSelect.value as GraphMode;
  restartGraph();
});

mapFile.addEventListener('change', () => {
  const file = mapFile.files?.[0];
  if (!file) return;
  if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
  mapObjectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.addEventListener('load', () => {
    mapImage = image;
    draw();
  });
  image.src = mapObjectUrl;
});

clearMapBtn.addEventListener('click', () => {
  mapImage = null;
  if (mapObjectUrl) URL.revokeObjectURL(mapObjectUrl);
  mapObjectUrl = null;
  mapFile.value = '';
  draw();
});

function frame(): void {
  const now = performance.now();
  const elapsed = now - lastFrameTs;
  lastFrameTs = now;
  const instantFps = elapsed > 0 ? 1000 / elapsed : 0;
  fpsAverage = fpsAverage === 0 ? instantFps : fpsAverage * 0.9 + instantFps * 0.1;
  if (running) runSteps(speed);
  draw();
  updateStats(fpsAverage);
  requestAnimationFrame(frame);
}

const sharedState = stateFromHash(location.hash);
if (sharedState) applyState(sharedState);
else loadPreset('direct-route');
setPlacementTool('internal');
requestAnimationFrame(frame);
