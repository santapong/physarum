import type { CellSpec, FjspSolution, JewelryJobSpec, JewelryOpSpec } from './fjsp';
import { editableRoute, isOperationTime, MAX_OPERATION_MIN, type PoOperationEdit } from './po-routing';

const operationNames: Record<string, string> = {
  file: 'Filing', polish: 'Polishing', qc: 'QC', wax: 'Wax', cast: 'Casting',
  set: 'Stone setting', plate: 'Plating', 'pre-polish': 'Pre-polishing', asm: 'Assembly',
  'wh-in': 'Warehouse receipt', 'wh-out': 'Warehouse issue',
};

export function bindPoEditor(form: HTMLFormElement, onApply: (edits: PoOperationEdit[]) => void) {
  const select = form.querySelector<HTMLSelectElement>('[name="order"]')!;
  const rows = form.querySelector<HTMLElement>('.po-operations')!;
  const status = form.querySelector<HTMLOutputElement>('output')!;
  const routeSummary = form.querySelector<HTMLElement>('.po-route-summary')!;
  const usage = document.getElementById('plating-usage')!;
  let jobs: JewelryJobSpec[] = [];
  let edits: PoOperationEdit[] = [];
  let cells: CellSpec[] = [];
  let plating: JewelryOpSpec;
  let plan: FjspSolution | undefined;

  function updateAssignments() {
    const ops = plan?.feasible ? plan.ops.filter(op => op.jobId === select.value) : [];
    routeSummary.textContent = ops.map(op =>
      `${operationNames[op.stage] ?? op.stage} ${op.durMin} min`
    ).join(' → ');
    for (const label of rows.querySelectorAll<HTMLElement>('[data-assignment]')) {
      const stage = label.dataset.assignment;
      const op = ops.find(op => op.stage === stage);
      if (plan?.feasible) {
        label.textContent = op ? `${op.cellId} · ${op.durMin} min` : 'Skipped';
        if (op?.moldDraws) {
          label.textContent += ' · ' + op.moldDraws.map(draw => `${draw.moldId} × ${draw.shots}`).join(' → ');
        }
      } else {
        label.textContent = 'No feasible schedule';
      }
    }
  }

  function renderOrder() {
    rows.replaceChildren();
    status.textContent = '';
    const job = jobs.find(j => j.id === select.value);
    if (!job) return;
    for (const op of editableRoute(job, plating, edits)) {
      const row = document.createElement('fieldset');
      row.dataset.stage = op.stage;
      const legend = document.createElement('legend');
      legend.textContent = operationNames[op.stage] ?? op.stage;
      row.append(legend);
      if (op.stage === 'plate') {
        const label = document.createElement('label');
        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = !op.skipped;
        toggle.addEventListener('change', () => {
          for (const input of row.querySelectorAll<HTMLInputElement>('input[type=number]')) {
            input.disabled = !toggle.checked;
          }
        });
        label.append(toggle, ' Include plating');
        row.append(label);
      }
      for (const [cellId, minutes] of Object.entries(op.durations)) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.max = String(MAX_OPERATION_MIN);
        input.step = '1';
        input.required = true;
        input.disabled = op.skipped;
        input.dataset.cell = cellId;
        input.value = String(minutes);
        label.append(cells.find(c => c.id === cellId)?.label ?? cellId, input);
        row.append(label);
      }
      const assignment = document.createElement('small');
      assignment.dataset.assignment = op.stage;
      row.append(assignment);
      rows.append(row);
    }
    updateAssignments();
  }

  select.addEventListener('change', renderOrder);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const job = jobs.find(j => j.id === select.value);
    if (!job) return;
    const original = editableRoute(job, plating, []);
    const changed: PoOperationEdit[] = [];
    for (const row of rows.querySelectorAll('fieldset')) {
      const stage = row.dataset.stage!;
      const base = original.find(op => op.stage === stage)!;
      const toggle = row.querySelector<HTMLInputElement>('input[type=checkbox]');
      const skipped = toggle !== null && !toggle.checked;
      const durations: Record<string, number> = {};
      for (const input of row.querySelectorAll<HTMLInputElement>('input[type=number]')) {
        const cell = input.dataset.cell!;
        const minutes = input.valueAsNumber;
        if (isOperationTime(minutes) && minutes !== base.durations[cell]) {
          durations[cell] = minutes;
        }
      }
      if (skipped !== base.skipped || Object.keys(durations).length) {
        const edit: PoOperationEdit = { jobId: job.id, stage, durations };
        if (skipped !== base.skipped) edit.includePlating = !skipped;
        changed.push(edit);
      }
    }
    edits = [...edits.filter(edit => edit.jobId !== job.id), ...changed];
    onApply(edits);
    status.textContent = `Applied to ${job.id}.`;
  });

  return {
    setOrders(
      baseJobs: JewelryJobSpec[],
      baseCells: CellSpec[],
      platingTemplate: JewelryOpSpec,
      overrides: PoOperationEdit[],
    ) {
      jobs = baseJobs;
      cells = baseCells;
      plating = platingTemplate;
      edits = overrides;
      select.replaceChildren(...jobs.map(job => new Option(`${job.id} · ${job.name}`, job.id)));
      renderOrder();
    },
    showSchedule(solution: FjspSolution | undefined, offlineCells: string[]) {
      plan = solution;
      if (plan?.feasible) {
        const ops = plan.ops.filter(op => op.stage === 'plate');
        const baths = cells.filter(cell => cell.stage === 'Plating').map(cell => {
          if (offlineCells.includes(cell.id)) return `${cell.label}: offline`;
          const assigned = ops.filter(op => op.cellId === cell.id);
          const minutes = assigned.reduce((sum, op) => sum + op.durMin, 0);
          return `${cell.label}: ${assigned.length} ops, ${minutes} min`;
        });
        const orderCount = new Set(ops.map(op => op.jobId)).size;
        usage.textContent = [`Plating required by ${orderCount}/${jobs.length} orders`, ...baths].join(' · ');
      } else {
        usage.textContent = 'Plating assignments unavailable until the schedule is feasible.';
      }
      updateAssignments();
    },
  };
}
