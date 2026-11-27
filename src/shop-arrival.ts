import { shopAccounts } from './shop-finance';
import { DAY, shopOrders, type ShopOrder } from './shop-orders';
import type { PurchasingPolicy } from './shop-materials';
import { purchaseTargets, buildShopPlan, limitedGold, workDay, type ShopPlan, type ShopSettings } from './shop-plan';
import { SHIFT_MIN_PER_DAY } from './fjsp';

export const trialDefaults = { day: 3, minute: 120, capacity: 2000 };

export function unexpectedOrder(): ShopOrder {
  const sample = shopOrders().find(po => po.id === 'PO-151')!;
  return { ...sample, id: 'PO-301', model: 'Incoming cast solitaire' };
}

export function arrivalTrial(settings: ShopSettings, original: ShopOrder[], incoming: ShopOrder, options = trialDefaults, policy: PurchasingPolicy = 'early') {
  if (!Number.isInteger(options.day) || options.day < 1 || options.day > 365 ||
      !Number.isInteger(options.minute) || options.minute < 0 || options.minute >= SHIFT_MIN_PER_DAY) {
    throw new Error('Choose an arrival day and a minute within the working shift.');
  }
  if (original.some(po=>po.id===incoming.id)) throw new Error('Incoming PO already exists in the starting queue.');
  const at = (options.day-1)*DAY + options.minute;
  const earlyBase = buildShopPlan(settings, original);
  const earlyCapped = buildShopPlan(settings, original, {goldCapacity:options.capacity});
  const phased = policy === 'po-start';
  const originalTargets = phased ? purchaseTargets(earlyCapped) : undefined;
  const base = phased ? buildShopPlan(settings, original, {purchaseTargets:purchaseTargets(earlyBase)}) : earlyBase;
  const capped = phased ? buildShopPlan(settings, original, {goldCapacity:options.capacity, purchaseTargets:originalTargets}) : earlyCapped;
  const newPo = { ...incoming, releaseDay: options.day, announcedAt: at };
  const resume = {at, bookings:capped.bookings};
  const allOrders = [...original,newPo];
  const rollingRun = {goldCapacity:options.capacity, resume, purchaseTargets:originalTargets};
  let updated = buildShopPlan(settings, allOrders, rollingRun);
  if (originalTargets) {
    // Size the incoming order against the queue observable at arrival. Keep original commitments.
    const forecast = purchaseTargets(updated);
    const pos = new Map(originalTargets.pos);
    pos.set(newPo.id, forecast.pos.get(newPo.id)!);
    const molds = new Map(originalTargets.molds);
    for (const [id, target] of forecast.molds) if (!molds.has(id)) molds.set(id, target);
    updated = buildShopPlan(settings, allOrders, {...rollingRun, purchaseTargets:{pos,molds}});
  }
  const frozen = capped.bookings.filter(b=>b.start < at);
  const revised = new Map(updated.orders.map(po=>[po.id,po.ready]));
  const changes = capped.orders.map(po=>({po:po.id, previous:po.ready, revised:revised.get(po.id)!}))
    .filter(row=>row.previous !== row.revised);
  const fresh = updated.orders.find(po=>po.id===incoming.id)!;
  const firstStart = Math.min(...updated.bookings.filter(b=>b.members.some(m=>m.po===fresh.id)).map(b=>b.start));
  const describe = (label: string, p: ShopPlan) => {
    const accounts=shopAccounts(p);
    const deliveryCashLow=shopAccounts(p, 'delivery').minCash;
    const gold=accounts.stock.find(s=>s.id===limitedGold)!;
    return { label, orders:p.orders.length, lastDay:accounts.shopDays, cashLow:accounts.minCash, deliveryCashLow, closingCash:accounts.closing,
      peakGold:Math.max(gold.starting,...gold.ledger.map(d=>d.afterReceipt)), boughtGold:gold.purchased,
      deliveries:gold.ledger.filter(d=>d.received).map(d=>({day:d.day,grams:d.received})),
    };
  };
  return { updated, capped, report: {
    at, day:options.day, minute:options.minute, capacity:options.capacity, incoming:fresh.id,
    firstStart, shipDay:workDay(fresh.ready-0.000001), completedBefore:capped.orders.filter(po=>po.ready<=at).length,
    frozenBookings:frozen.length, runningBookings:frozen.filter(b=>b.end>at).length,
    earlierDays:changes.filter(c=>workDay(c.revised-1e-6)<workDay(c.previous-1e-6)).length,
    laterDays:changes.filter(c=>workDay(c.revised-1e-6)>workDay(c.previous-1e-6)).length,
    changes, comparison:[describe('Original',base),describe('Storage limit',capped),describe('Storage limit + arrival',updated)],
  }};
}
