import { SHIFT_MIN_PER_DAY } from './fjsp';
import { shotsForLot } from './wax-molds';
import { DAY, gramsPerPiece, stockCatalog, isGold, type LaborStage, type Metal, type ShopOrder, type Stage, shopOrders } from './shop-orders';
import { LimitedStore, procure, type PurchaseTargets, type PurchasingPolicy, type Receipt } from './shop-materials';

export interface ShopSettings {
  setters: number; platingMin: number; tumbleMin: number; buyMolds: boolean;
  startingCash: number; wagePerHour: number; depositPct: number; collectionDays: number;
}
export const defaults: ShopSettings = {
  setters: 8, platingMin: 0, tumbleMin: 0, buyMolds: true,
  startingCash: 95000, wagePerHour: 4, depositPct: 20, collectionDays: 2,
};
export const castingLimit = 2000;
export const batchLimit = { plate: 50, tumble: 200 };
export const batchRecipes: Record<Metal, { plate: number; tumble: number }> = {
  '18K-Y': { plate: 12, tumble: 90 }, '18K-R': { plate: 18, tumble: 85 },
  '925': { plate: 15, tumble: 60 }, Bronze: { plate: 20, tumble: 120 }, Brass: { plate: 10, tumble: 105 },
};
const shift = SHIFT_MIN_PER_DAY;
export const workDay = (time: number) => 1 + Math.floor(time / DAY);
const cleanTime = (time: number) => Math.round(time * 1e6) / 1e6;

// Report calendar days while keeping every booking inside its working shift.
export function fitShift(after: number, duration: number): number {
  if (duration > shift || duration <= 0) throw new Error('Operation does not fit the working shift.');
  const start = cleanTime(after);
  const day = Math.floor(start / DAY);
  return cleanTime(start + duration) <= day * DAY + shift ? start : (day + 1) * DAY;
}

export function reserveCasting(ready: number, pieces: number, daily: Map<number, number>) {
  if (!Number.isInteger(pieces) || pieces <= 0 || pieces > castingLimit) throw new Error('Invalid casting lot size.');
  const duration = pieces * shift / castingLimit;
  let start = fitShift(ready, duration);
  if ((daily.get(workDay(start)) ?? 0) + pieces > castingLimit) start = workDay(start) * DAY;
  daily.set(workDay(start), (daily.get(workDay(start)) ?? 0) + pieces);
  return { start, end: cleanTime(start + duration) };
}

export interface Booking {
  stage: Stage; resource: string; cell?: number; start: number; end: number;
  members: { po: string; qty: number }[]; mold?: string; shots?: number;
}
export interface PlannedOrder extends ShopOrder { cell: number; ready: number }
export interface MoldStock {
  family: string; id: string; cavities: number; opening: number; used: number; available: number; free: number;
}
const toolDefaults: Record<string, { cavities: number; stock: number[] }> = {
  Solitaire: { cavities: 2, stock: [100] }, Halo: { cavities: 1, stock: [90, 60] },
  Mounting: { cavities: 4, stock: [65] },
};
export const replacement = { shots: 250, cost: 120, lead: 2 };
const minutesPerShot = 0.5;

function assignCells(source: ShopOrder[]): PlannedOrder[] {
  const loads = Array<number>(21).fill(0);
  return source.map(po => {
    const first = isGold(po.metal) ? 1 : 11;
    let cell = first;
    for (let i = first + 1; i < first + 10; i++) if (loads[i] < loads[cell]) cell = i;
    loads[cell] += po.pieces * ((po.rates.file ?? 0) / 3 + ((po.rates['pre-polish'] ?? 0) +
      (po.rates.polish ?? 0)) / 3 + (po.rates.qc ?? 0) / 2);
    return { ...po, cell, ready: Math.max((po.releaseDay - 1) * DAY, po.announcedAt ?? 0) };
  });
}

export interface ShopRun {
  goldCapacity?: number;
  purchaseTargets?: PurchaseTargets;
  resume?: { at: number; bookings: Booking[] };
}
export const limitedGold = '18K-Y grain';

export function buildShopPlan(settings: ShopSettings = defaults, source: ShopOrder[] = shopOrders(), run: ShopRun = {}) {
  const { setters, platingMin, tumbleMin } = settings;
  if (!Number.isInteger(setters) || setters < 1 || setters > 160 ||
      !(platingMin === 0 || (platingMin >= 10 && platingMin <= 20)) ||
      !(tumbleMin === 0 || (tumbleMin >= 60 && tumbleMin <= 120))) throw new Error('Check the capacity and timing assumptions.');
  if (!Number.isFinite(settings.startingCash) || !Number.isFinite(settings.wagePerHour) || settings.wagePerHour < 0 ||
      !(settings.depositPct >= 0 && settings.depositPct <= 100) ||
      !Number.isInteger(settings.collectionDays) || settings.collectionDays < 0 || settings.collectionDays > 365) {
    throw new Error('Check the cash flow assumptions.');
  }
  const orders = assignCells(source);
  const materials = procure(orders, run.purchaseTargets);
  const goldIssues = new Map(materials.issues.filter(i=>i.item === limitedGold).map(i=>[i.po,i]));
  const moldBuys: Receipt[] = [];
  const cutoff = run.resume?.at ?? 0;
  const bookings: Booking[] = run.resume?.bookings.filter(b => b.start < cutoff) ?? [];
  const frozen = new Map<string, { qty: number; end: number }>();
  const store = run.goldCapacity === undefined ? undefined : new LimitedStore(
    stockCatalog.find(item => item.id === limitedGold)!, run.goldCapacity, materials.receipts);

  const molds: MoldStock[] = [];
  const castByDay = new Map<number, number>();
  const free = new Map<string, number>();
  for (const booking of bookings) {
    free.set(booking.resource, Math.max(free.get(booking.resource) ?? 0, booking.end));
    for (const m of booking.members) {
      const key = m.po + '/' + booking.stage;
      const state = frozen.get(key) ?? {qty:0, end:0};
      state.qty += m.qty;
      state.end = Math.max(state.end, booking.end);
      frozen.set(key, state);
    }
  }
  const history = (po: PlannedOrder, stage: Stage) => frozen.get(po.id + '/' + stage);
  const gate = (po: PlannedOrder, stage: Stage) => Math.max(cutoff, po.ready, materials.gates.get(po.id + '/' + stage) ?? 0);
  const ordered = (stage: Stage) => orders.filter(po => po.stages.includes(stage))
    .sort((a,b) => gate(a, stage) - gate(b, stage) || a.id.localeCompare(b.id));
  const single = (po: PlannedOrder) => [{ po: po.id, qty: po.pieces }];

  // Plan mold receipts from the demand of PO lots. Expired physical tools are never reset.
  for (const [family, spec] of Object.entries(toolDefaults)) {
    const make = (name: string, life: number, available: number): MoldStock => ({
      id: name, family, cavities: spec.cavities, opening: life, used: 0, available, free: available,
    });
    spec.stock.forEach((life, i) => molds.push(make(i ? family + ' spare' : family, life, 0)));
    const demandOrders = orders.filter(po => po.mold === family)
      .sort((a,b) => (a.announcedAt ?? 0) - (b.announcedAt ?? 0));
    const demand = demandOrders.reduce((n, po) => n + shotsForLot(po.pieces, spec.cavities), 0);
    const gap = demand - spec.stock.reduce((a,b) => a+b, 0);
    if (gap > 0 && !settings.buyMolds) throw new Error(family + ' needs ' + gap + ' more mold shots for this plan.');
    let budget = spec.stock.reduce((a,b)=>a+b,0);
    let count = 0;
    for (const po of demandOrders) {
      budget -= shotsForLot(po.pieces, spec.cavities);
      while (budget < 0) {
        const id = family + ' replacement ' + (++count);
        const target = run.purchaseTargets?.molds.get(id);
        const startDay = target && run.purchaseTargets?.pos.get(target.po)?.startDay;
        const orderDay = Math.max(workDay(po.announcedAt ?? 0), startDay ?? 1, (target?.needDay ?? 1)-replacement.lead);
        const arrivalDay = orderDay + replacement.lead;
        molds.push(make(id, replacement.shots, (arrivalDay-1)*DAY));
        moldBuys.push({item:id, qty:1, orderDay, arrivalDay, cost:replacement.cost,
          triggerPo:target?.po ?? po.id, plannedStartDay:startDay, needDay:target?.needDay});
        budget += replacement.shots;
      }
    }
  }

  // Allocate a wax station and each physical mold, then reserve casting on one shared line.
  const ordersById = new Map(orders.map(po=>[po.id, po]));
  for (const b of [...bookings].sort((a,b)=>a.start-b.start)) {
    if (b.mold) {
      const tool = molds.find(m => m.id === b.mold)!;
      tool.used += b.shots!;
      tool.free = Math.max(tool.free, b.end);
    }
    if (b.stage === 'cast') {
      const day = workDay(b.start);
      for (const m of b.members) {
        castByDay.set(day,(castByDay.get(day) ?? 0)+m.qty);
        if (store && ordersById.get(m.po)!.metal === '18K-Y') {
          const issue = store.issue(day, m.qty*gramsPerPiece);
          if (issue.day !== day) throw new Error('Historical gold issue cannot be reproduced.');
          goldIssues.get(m.po)!.availableDay = issue.availableDay;
        }
      }
    }
  }
  if (cutoff) store?.openThrough(workDay(cutoff));
  let castFree = Math.max(cutoff, free.get('Casting line') ?? 0);
  const castRelease = (po: PlannedOrder) => Math.max(gate(po, 'wax'), gate(po, 'cast'));
  for (const po of ordered('wax').sort((a, b) => castRelease(a) - castRelease(b) || a.id.localeCompare(b.id))) {
    const priorCast = history(po,'cast');
    if (priorCast) {
      po.ready = priorCast.end;
      continue;
    }
    const priorWax = history(po,'wax');
    const family = molds.filter(m => m.family === po.mold);
    if (!family.length) throw new Error('Missing wax mold for ' + po.id);
    let pieces = po.pieces - (priorWax?.qty ?? 0);
    let shots = shotsForLot(pieces, family[0].cavities);
    const draws: { mold: MoldStock; shots: number; qty: number }[] = [];
    for (const mold of family) {
      const take = Math.min(shots, mold.opening - mold.used);
      if (!take) continue;
      const qty = Math.min(pieces, take * mold.cavities);
      draws.push({ mold, shots: take, qty });
      shots -= take;
      pieces -= qty;
      if (!shots) break;
    }
    if (shots) throw new Error('Mold shots exhausted for ' + po.id);
    const waxStation = (free.get('Wax 1') ?? 0) <= (free.get('Wax 2') ?? 0) ? 'Wax 1' : 'Wax 2';
    const waxTime = draws.reduce((total, d) => total + d.shots * minutesPerShot, 0);
    let t = priorWax?.end ?? 0;
    if (waxTime) t = fitShift(Math.max(t, gate(po,'wax'), free.get(waxStation) ?? 0, ...draws.map(d=>d.mold.free)), waxTime);
    for (const d of draws) {
      const end = cleanTime(t + d.shots * minutesPerShot);
      bookings.push({ stage: 'wax', resource: waxStation, mold: d.mold.id, shots: d.shots,
        start: t, end, members: [{ po: po.id, qty: d.qty }] });
      d.mold.free = end;
      d.mold.used += d.shots;
      t = end;
    }
    if (waxTime) free.set(waxStation, t);
    let castReady = Math.max(t, gate(po, 'cast'), castFree);
    if (store && po.metal === '18K-Y') {
      const slot = fitShift(castReady, po.pieces * shift / castingLimit);
      let day = workDay(slot);
      if ((castByDay.get(day) ?? 0) + po.pieces > castingLimit) day++;
      const admitted = store.issue(day, po.pieces * gramsPerPiece);
      goldIssues.get(po.id)!.availableDay = admitted.availableDay;
      castReady = Math.max(castReady, (admitted.day-1)*DAY);
    }
    const cast = reserveCasting(castReady, po.pieces, castByDay);
    const castStart = cast.start;
    castFree = cast.end;
    bookings.push({ stage: 'cast', resource: 'Casting line', start: castStart, end: castFree, members: single(po) });
    po.ready = castFree;
  }

  function labor(stage: LaborStage) {
    for (const po of ordered(stage)) {
      const cell = stage === 'set' ? 21 : po.cell;
      const count = stage === 'set' ? setters : stage === 'qc' ? 2 : 3;
      const skill = stage === 'pre-polish' ? 'polish' : stage;
      const resources = Array.from({ length: count }, (_, i) => 'C' + cell + ' ' + skill + ' ' + (i+1));
      const rate = po.rates[stage]!;
      if (!(rate > 0 && rate <= shift)) throw new Error('Invalid piece time for ' + po.id + ' ' + stage);
      const priorStage = history(po,stage);
      const left = po.pieces - (priorStage?.qty ?? 0);
      if (!left) {
        po.ready = Math.max(po.ready, priorStage!.end);
        continue;
      }
      const ready = gate(po, stage);
      const last = new Map<string, Booking>();
      let finish = Math.max(ready, priorStage?.end ?? 0);
      for (let i = 0; i < left; i++) {
        let best = resources[0];
        let start = Infinity;
        for (const resource of resources) {
          const slot = fitShift(Math.max(ready, free.get(resource) ?? 0), rate);
          if (slot < start) { best = resource; start = slot; }
        }
        const end = cleanTime(start + rate);
        const prior = last.get(best);
        if (prior?.end === start) { prior.end = end; prior.members[0].qty++; }
        else {
          const booking = { stage, resource: best, cell, start, end, members: [{ po: po.id, qty: 1 }] };
          bookings.push(booking);
          last.set(best, booking);
        }
        free.set(best, end);
        finish = Math.max(finish, end);
      }
      po.ready = finish;
    }
  }

  function batch(stage: 'plate' | 'tumble', override: number) {
    const pending: { ready: number; metal: Metal; members: Booking['members']; qty: number }[] = [];
    const open = new Map<string, typeof pending[number]>();
    for (const po of ordered(stage)) {
      const priorBatch = history(po,stage);
      let left = po.pieces - (priorBatch?.qty ?? 0);
      // The rest of a split PO can join a later batch; downstream still waits for both.
      const materialReady = gate(po,stage);
      po.ready = Math.max(po.ready, priorBatch?.end ?? 0);
      while (left > 0) {
        let row = open.get(po.metal);
        if (!row || row.qty === batchLimit[stage]) {
          row = { ready: 0, metal: po.metal, members: [], qty: 0 };
          pending.push(row);
          open.set(po.metal, row);
        }
        const qty = Math.min(left, batchLimit[stage] - row.qty);
        row.members.push({ po: po.id, qty });
        row.qty += qty;
        row.ready = Math.max(row.ready, materialReady);
        left -= qty;
      }
    }
    const byId = new Map(orders.map(po => [po.id, po]));
    const resource = stage === 'plate' ? 'Plating bath' : 'Tumbling barrel';
    for (const row of pending.sort((a,b) => a.ready - b.ready)) {
      const duration = override || batchRecipes[row.metal][stage];
      const start = fitShift(Math.max(row.ready, free.get(resource) ?? 0), duration);
      const end = start + duration;
      bookings.push({ stage, resource, start, end, members: row.members });
      free.set(resource, end);
      for (const m of row.members) {
        const po = byId.get(m.po)!;
        po.ready = Math.max(po.ready, end);
      }
    }
  }

  labor('file');
  const byId = new Map(orders.map(po => [po.id, po]));
  for (const po of orders) {
    if (!po.feedsFrom) continue;
    const stock = byId.get(po.feedsFrom);
    if (!stock?.stock || stock.metal !== po.metal || stock.pieces < po.pieces) throw new Error('Missing compatible mounting for ' + po.id);
    po.ready = Math.max(po.ready, stock.ready);
  }
  batch('tumble', tumbleMin);
  labor('pre-polish');
  labor('set');
  labor('polish');
  batch('plate', platingMin);
  labor('qc');
  if (store) {
    store.finish();
    for (const issue of goldIssues.values()) materials.gates.set(issue.po + '/cast', (issue.availableDay-1)*DAY);
    materials.receipts = [...materials.receipts.filter(r=>r.item !== limitedGold), ...store.delivered];
  }
  return { settings, orders, bookings, molds, moldBuys, materials, castByDay, goldCapacity: run.goldCapacity, purchasingPolicy: (run.purchaseTargets ? 'po-start' : 'early') as PurchasingPolicy };
}

export type ShopPlan = ReturnType<typeof buildShopPlan>;


// Target days come from a feasible dispatch plan, before changing purchasing policy.
export function purchaseTargets(plan: ShopPlan): PurchaseTargets {
  const pos: PurchaseTargets['pos'] = new Map();
  const molds: PurchaseTargets['molds'] = new Map();
  for (const b of plan.bookings) {
    const day = workDay(b.start);
    for (const member of b.members) {
      const target = pos.get(member.po) ?? {startDay:day, stageDays:{} as Partial<Record<Stage,number>>};
      target.startDay = Math.min(target.startDay, day);
      target.stageDays[b.stage] = Math.min(target.stageDays[b.stage] ?? day, day);
      pos.set(member.po, target);
      if (b.mold && day < (molds.get(b.mold)?.needDay ?? Infinity)) {
        molds.set(b.mold, {po:member.po, needDay:day});
      }
    }
  }
  return {pos, molds};
}
