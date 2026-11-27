import type { JewelryJobSpec, JewelryOpSpec } from './fjsp';

// The interactive simulator draws the time horizon and builds daily ERP ledger rows.
export const MAX_OPERATION_MIN = 7 * 24 * 60;

export interface PoOperationEdit {
  jobId: string;
  stage: string;
  durations: Record<string, number>;
  includePlating?: boolean;
}

export interface RouteOperation extends JewelryOpSpec {
  skipped: boolean;
}

export function isOperationTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_OPERATION_MIN;
}

export function readPoEdits(raw: unknown): PoOperationEdit[] {
  if (!Array.isArray(raw)) return [];
  const edits: PoOperationEdit[] = [];
  // A 300-order batch can have up to eight editable operation rows per order.
  for (const edit of raw.slice(0, 300 * 8)) {
    if (!edit || typeof edit.jobId !== 'string' || typeof edit.stage !== 'string') continue;
    if (!edit.durations || typeof edit.durations !== 'object' || Array.isArray(edit.durations)) continue;

    const durations: Record<string, number> = {};
    for (const [cell, minutes] of Object.entries(edit.durations)) {
      if (/^[a-z][a-z0-9-]{0,30}$/.test(cell) && isOperationTime(minutes)) {
        durations[cell] = minutes;
      }
    }
    const change: PoOperationEdit = { jobId: edit.jobId, stage: edit.stage, durations };
    if (edit.stage === 'plate' && typeof edit.includePlating === 'boolean') {
      change.includePlating = edit.includePlating;
    }
    edits.push(change);
  }
  return edits;
}

export function editableRoute(
  job: JewelryJobSpec,
  plating: JewelryOpSpec,
  edits: PoOperationEdit[],
): RouteOperation[] {
  const route = job.ops.map(op => ({ ...op, durations: { ...op.durations }, skipped: false }));
  const qc = route.findIndex(op => op.stage === 'qc');
  if (qc >= 0 && job.poType !== 'SG-STOCK' && !route.some(op => op.stage === 'plate')) {
    route.splice(qc, 0, { ...plating, durations: { ...plating.durations }, skipped: true });
  }
  for (const edit of edits) {
    if (edit.jobId !== job.id) continue;
    const op = route.find(op => op.stage === edit.stage);
    if (!op) continue;
    if (op.stage === 'plate' && edit.includePlating !== undefined) op.skipped = !edit.includePlating;
    for (const cell of Object.keys(op.durations)) {
      const minutes = edit.durations[cell];
      if (isOperationTime(minutes)) op.durations[cell] = minutes;
    }
  }
  return route;
}

export function scheduledRoute(route: RouteOperation[]): JewelryOpSpec[] {
  return route.filter(op => !op.skipped).map(({ skipped: _skipped, ...op }) => op);
}
