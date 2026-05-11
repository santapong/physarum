import { addNode, emptyGraph, hasSourceAndSink, type Graph } from './graph';
import { step } from './sim';
import { render } from './render';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const runBtn = document.getElementById('run') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const muInput = document.getElementById('mu') as HTMLInputElement;
const dtInput = document.getElementById('dt') as HTMLInputElement;

const SUBSTEPS = 8;

const params = {
  mu: parseFloat(muInput.value),
  dt: parseFloat(dtInput.value),
  running: false,
};

let graph: Graph = emptyGraph();

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
  addNode(graph, x, y, flow);
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

function frame(): void {
  if (params.running && hasSourceAndSink(graph)) {
    for (let s = 0; s < SUBSTEPS; s++) {
      step(graph, params.mu, params.dt);
    }
  }
  draw();
  requestAnimationFrame(frame);
}

draw();
requestAnimationFrame(frame);
