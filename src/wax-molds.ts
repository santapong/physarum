import type { JewelryJobSpec, ScheduledOp } from './fjsp';

interface MoldStock {
  id: string;
  remainingShots: number;
}

export interface WaxMoldRun extends MoldStock {
  cavities: number;
  pieces: number;
  // A standby is compatible with the primary's cavities and cycle times.
  spare?: MoldStock;
}

export interface MoldDraw {
  moldId: string;
  shots: number;
  pieces: number;
}

export interface WaxMoldUsage extends MoldStock {
  cavities: number;
  pieces: number;
  requiredShots: number;
}

export function shotsForLot(pieces: number, cavities: number): number {
  return Math.ceil(pieces / cavities);
}

// Assign entire shots in production order. A partial last shot still costs one cycle.
export function drawWaxShots(mold: WaxMoldRun, priorFamilyShots: number): MoldDraw[] {
  const shots = shotsForLot(mold.pieces, mold.cavities);
  const primaryShots = mold.spare
    ? Math.min(shots, Math.max(0, mold.remainingShots - priorFamilyShots))
    : shots;
  const draws: MoldDraw[] = [];
  const primaryPieces = Math.min(mold.pieces, primaryShots * mold.cavities);
  if (primaryShots > 0) draws.push({ moldId: mold.id, shots: primaryShots, pieces: primaryPieces });
  if (mold.spare && primaryShots < shots) {
    draws.push({ moldId: mold.spare.id, shots: shots - primaryShots, pieces: mold.pieces - primaryPieces });
  }
  return draws;
}

export function checkWaxMolds(jobs: JewelryJobSpec[]): { usage: WaxMoldUsage[]; error?: string } {
  const byId = new Map<string, WaxMoldUsage>();
  const familyById = new Map<string, string>();
  const standbyByPrimary = new Map<string, string | undefined>();
  const used = new Map<string, number>();
  for (const job of jobs) {
    for (const op of job.ops) {
      const mold = op.waxMold;
      if (!mold) continue;
      if (op.stage !== 'wax' || !Number.isSafeInteger(mold.cavities) || mold.cavities < 1 ||
          !Number.isSafeInteger(mold.pieces) || mold.pieces < 1 || mold.spare?.id === mold.id) {
        return { usage: [], error: `Invalid wax mold specification on ${job.id}` };
      }
      if (standbyByPrimary.has(mold.id) && standbyByPrimary.get(mold.id) !== mold.spare?.id) {
        return { usage: [], error: `Conflicting standby for wax mold ${mold.id}` };
      }
      standbyByPrimary.set(mold.id, mold.spare?.id);
      for (const tool of mold.spare ? [mold, mold.spare] : [mold]) {
        if (!tool.id || !Number.isSafeInteger(tool.remainingShots) || tool.remainingShots < 0) {
          return { usage: [], error: `Invalid wax mold specification on ${job.id}` };
        }
        const row = byId.get(tool.id);
        if (row && (familyById.get(tool.id) !== mold.id || row.cavities !== mold.cavities ||
                    row.remainingShots !== tool.remainingShots)) {
          return { usage: [], error: `Conflicting inventory for wax mold ${tool.id}` };
        }
        if (!row) {
          byId.set(tool.id, { id: tool.id, cavities: mold.cavities, remainingShots: tool.remainingShots,
            pieces: 0, requiredShots: 0 });
          familyById.set(tool.id, mold.id);
        }
      }
      const prior = used.get(mold.id) ?? 0;
      for (const draw of drawWaxShots(mold, prior)) {
        const row = byId.get(draw.moldId)!;
        row.pieces += draw.pieces;
        row.requiredShots += draw.shots;
      }
      used.set(mold.id, prior + shotsForLot(mold.pieces, mold.cavities));
    }
  }
  const usage = Array.from(byId.values());
  const short = usage.find(row => row.requiredShots > row.remainingShots);
  if (short) {
    return { usage, error: `Wax mold ${short.id} needs ${short.requiredShots} shots, only ${short.remainingShots} remain` };
  }
  return { usage };
}

// Shot demand per tool is fixed, but which PO contributes its last partially filled shot can vary.
export function scheduledMoldUsage(stock: WaxMoldUsage[], ops: ScheduledOp[]): WaxMoldUsage[] {
  const rows = new Map(stock.map(tool => [tool.id, { ...tool, pieces: 0, requiredShots: 0 }]));
  for (const op of ops) {
    for (const draw of op.moldDraws ?? []) {
      const row = rows.get(draw.moldId)!;
      row.pieces += draw.pieces;
      row.requiredShots += draw.shots;
    }
  }
  return Array.from(rows.values());
}
