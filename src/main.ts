import { addNode, emptyGraph, hasSourceAndSink, rebuildGraph, type Graph, type GraphMode } from './graph';
import { step } from './sim';
import { render } from './render';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const runBtn = document.getElementById('run') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const muInput = document.getElementById('mu') as HTMLInputElement;
const dtInput = document.getElementById('dt') as HTMLInputElement;
const modeSelect = document.getElementById('mode') as HTMLSelectElement;
const mapFile = document.getElementById('mapfile') as HTMLInputElement;
const clearMapBtn = document.getElementById('clearmap') as HTMLButtonElement;
const mapImg = document.getElementById('map') as HTMLImageElement;
const stats = document.getElementById('stats') as HTMLParagraphElement;

const SUBSTEPS = 8;

const params = {
  mu: parseFloat(muInput.value),
  dt: parseFloat(dtInput.value),
  mode: modeSelect.value as GraphMode,
  running: false,
};

let graph: Graph = emptyGraph();
let lastFrameTs = performance.now();
let fpsAvg = 0;

function updateStats(fps: number): void {
  stats.textContent = `${graph.nodes.length} nodes · ${graph.edges.length} edges · ${fps.toFixed(0)} fps`;
}

function draw(): void {
  render(ctx, graph);
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * sx;
  const y = (e.clientY - rect.top) * sy;
  const flow = e.shiftKey ? 1 : e.altKey ? -1 : 0;
  const res = addNode(graph, x, y, flow, params.mode);
  graph = res.graph;
  draw();
});

runBtn.addEventListener('click', () => {
  params.running = !params.running;
  runBtn.textContent = params.running ? 'Pause' : 'Run';
});

resetBtn.addEventListener('click', () => {
  graph = emptyGraph();
  params.running = false;
  runBtn.textContent = 'Run';
  draw();
});

muInput.addEventListener('input', () => {
  params.mu = parseFloat(muInput.value);
});
dtInput.addEventListener('input', () => {
  params.dt = parseFloat(dtInput.value);
});

modeSelect.addEventListener('change', () => {
  params.mode = modeSelect.value as GraphMode;
  graph = rebuildGraph(graph, params.mode);
  draw();
});

mapFile.addEventListener('change', () => {
  const file = mapFile.files && mapFile.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  mapImg.src = url;
  mapImg.style.display = 'block';
});

clearMapBtn.addEventListener('click', () => {
  mapImg.removeAttribute('src');
  mapImg.style.display = 'none';
  mapFile.value = '';
});

function frame(): void {
  const now = performance.now();
  const dt = now - lastFrameTs;
  lastFrameTs = now;
  const instFps = dt > 0 ? 1000 / dt : 0;
  fpsAvg = fpsAvg === 0 ? instFps : fpsAvg * 0.9 + instFps * 0.1;

  if (params.running && hasSourceAndSink(graph)) {
    for (let s = 0; s < SUBSTEPS; s++) {
      step(graph, params.mu, params.dt);
    }
  }
  draw();
  updateStats(fpsAvg);
  requestAnimationFrame(frame);
}

draw();
updateStats(0);
requestAnimationFrame(frame);
