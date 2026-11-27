import { describe, expect, it } from 'vitest';
import { arrivalTrial, trialDefaults, unexpectedOrder } from './shop-arrival';
import { shopAccounts } from './shop-finance';
import { LimitedStore, procure } from './shop-materials';
import { DAY, shopOrders, stockCatalog } from './shop-orders';
import { defaults, limitedGold, workDay } from './shop-plan';

const initial = shopOrders();
const incoming = unexpectedOrder();
const { updated, capped, report } = arrivalTrial(defaults, initial, incoming);
const before = shopAccounts(capped);
const after = shopAccounts(updated);

describe('unannounced PO and limited warehouse intake', () => {
  it('freezes history and active reservations at the cutoff, including their posted finances', () => {
    const initialBookings = capped.bookings.filter(b=>b.start < report.at);
    expect(initialBookings.some(b=>b.end>report.at)).toBe(true);
    expect(updated.bookings.filter(b=>b.start<report.at)).toEqual(initialBookings);
    expect(capped.orders).toHaveLength(300);
    expect(updated.orders).toHaveLength(301);
    expect(initial.some(po=>po.id===incoming.id)).toBe(false);
    expect(report.firstStart).toBeGreaterThanOrEqual(report.at);
    expect(after.daily.slice(0,report.day-1)).toEqual(before.daily.slice(0,report.day-1));
    for (const row of before.stock) {
      const revised = after.stock.find(s=>s.id===row.id)!;
      expect(revised.ledger.slice(0,report.day-1)).toEqual(row.ledger.slice(0,report.day-1));
    }
    const sale=after.sales.find(s=>s.po===incoming.id)!;
    expect(sale.orderDay).toBe(report.day);
    expect(sale.qty).toBe(20);
    expect(sale.shipDay).toBe(report.shipDay);
    const goldIssue=after.issues.find(i=>i.po===incoming.id && i.item===limitedGold)!;
    expect(goldIssue.qty).toBe(80);
    expect(goldIssue.day).toBeGreaterThanOrEqual(report.day);
  });

  it('holds prepaid gold in whole supplier lots until there is space before daily production issues', () => {
    const gold=after.stock.find(s=>s.id===limitedGold)!;
    expect(gold.demand).toBe(6720);
    expect(gold.closing).toBe(80);
    expect(gold.purchased).toBe(6000);
    expect(gold.ledger.filter(d=>d.received).map(d=>[d.day,d.received])).toEqual([[3,2000],[4,2000],[5,2000]]);
    for (const row of gold.ledger) {
      expect(row.afterReceipt).toBe(row.opening+row.received);
      expect(row.afterReceipt).toBeLessThanOrEqual(report.capacity);
      expect(row.closing).toBe(row.afterReceipt-row.issued);
      expect(row.closing).toBeGreaterThanOrEqual(0);
      expect(row.received % gold.buyLot).toBe(0);
    }
    expect(report.comparison.map(r=>r.peakGold)).toEqual([6000,2000,2000]);
    const purchases=updated.materials.receipts.filter(r=>r.item===limitedGold);
    expect(purchases.every(r=>r.orderDay===1&&r.arrivalDay>=3)).toBe(true);
    expect(purchases.reduce((n,r)=>n+r.cost,0)).toBe(372000);
  });

  it('moves only the 18K-Y payments to each actual delivery and reconciles daily funding for PO-301', () => {
    const upfront = after;
    const delivery = shopAccounts(updated, 'delivery');
    const paid = (a: typeof upfront) => a.daily.filter(d=>d.goldPaid).map(d=>[d.day,d.goldPaid]);
    expect(paid(upfront)).toEqual([[1,372000]]);
    expect(paid(delivery)).toEqual([[3,124000],[4,124000],[5,124000]]);
    expect(delivery.stock).toEqual(upfront.stock);
    expect(delivery.sales).toEqual(upfront.sales);
    expect(delivery.purchases.filter(r=>r.item===limitedGold).every(r=>r.paymentDay===r.arrivalDay)).toBe(true);
    expect(delivery.purchases.filter(r=>r.item!==limitedGold)).toEqual(upfront.purchases.filter(r=>r.item!==limitedGold));
    let deferred = 0;
    for (const [i, day] of delivery.daily.entries()) {
      const old = upfront.daily[i];
      deferred += old.goldPaid-day.goldPaid;
      expect(day.materials - day.goldPaid).toBeCloseTo(old.materials-old.goldPaid,2);
      expect(day.closing-old.closing).toBeCloseTo(deferred,2);
    }
    expect([upfront.minDay,upfront.additionalCash,upfront.minimumOpeningCash]).toEqual([1,375151.16,470151.16]);
    expect([delivery.minDay,delivery.additionalCash,delivery.minimumOpeningCash]).toEqual([5,207438.31,302438.31]);
    expect(delivery.closing).toBe(upfront.closing);
    expect(deferred).toBe(0);
    const funded = shopAccounts({...updated, settings:{...updated.settings,startingCash:500000}}, 'delivery');
    expect(funded.additionalCash).toBe(0);
    expect(funded.minimumOpeningCash).toBe(delivery.minimumOpeningCash);
  });

  it('uses delivered quantities when a tighter store splits the same purchase into five payments', () => {
    const {updated: smaller} = arrivalTrial(defaults,initial,incoming,{...trialDefaults,capacity:1200});
    const delivery = shopAccounts(smaller,'delivery');
    expect(delivery.daily.filter(d=>d.goldPaid).map(d=>[d.day,d.goldPaid])).toEqual([
      [3,74400],[4,74400],[5,74400],[6,74400],[7,74400],
    ]);
  });

  it('schedules every piece exactly once per stage, respects dependencies, tools and cell availability after replanning', () => {
    const use=new Map<string,{start:number;end:number}[]>();
    const stages=new Map<string,{qty:number;start:number;end:number}>();
    for (const booking of updated.bookings) {
      for (const lane of booking.mold ? [booking.resource, booking.mold] : [booking.resource]) {
        const reservations=use.get(lane)??[]; reservations.push(booking); use.set(lane,reservations);
      }
      for (const member of booking.members) {
        const key=member.po+'/'+booking.stage;
        const span=stages.get(key)??{qty:0,start:Infinity,end:0};
        span.qty+=member.qty;span.start=Math.min(span.start,booking.start);span.end=Math.max(span.end,booking.end);
        stages.set(key,span);
      }
    }
    for (const reservations of use.values()) {
      reservations.sort((a,b)=>a.start-b.start);
      for(let i=1;i<reservations.length;i++) expect(reservations[i].start).toBeGreaterThanOrEqual(reservations[i-1].end-1e-6);
    }
    for (const po of updated.orders) {
      let ready=Math.max((po.releaseDay-1)*DAY,po.announcedAt??0);
      if(po.feedsFrom) ready=Math.max(ready,updated.orders.find(p=>p.id===po.feedsFrom)!.ready);
      for(const stage of po.stages) {
        const span=stages.get(po.id+'/'+stage)!;
        expect(span.qty).toBe(po.pieces);
        expect(span.start).toBeGreaterThanOrEqual(ready-1e-6);
        ready=span.end;
      }
      expect(po.ready).toBe(ready);
    }
    expect(updated.molds.every(tool=>tool.used<=tool.opening)).toBe(true);
    expect(Math.max(...updated.castByDay.values())).toBeLessThanOrEqual(2000);
    expect(after.mountings.every(m=>m.closing>=0)).toBe(true);
  });

  it('uses the actual arrival day for a newly required purchase, and rejects impossible storage or duplicate arrivals', () => {
    const rush={...incoming,pieces:400,releaseDay:4,announcedAt:3*DAY+100};
    const shortage=procure([rush]);
    for(const receipt of shortage.receipts) {
      expect(receipt.orderDay).toBeGreaterThanOrEqual(workDay(rush.announcedAt));
      expect(receipt.arrivalDay).toBeGreaterThanOrEqual(receipt.orderDay+stockCatalog.find(i=>i.id===receipt.item)!.lead);
    }
    const grain=stockCatalog.find(i=>i.id===limitedGold)!;
    expect(()=>new LimitedStore(grain,799,[])).toThrow(/opening stock/);
    expect(()=>arrivalTrial(defaults,initial,initial[0],trialDefaults)).toThrow(/already exists/);
    const store=new LimitedStore(grain,800,[{item:grain.id,qty:400,orderDay:1,arrivalDay:3,cost:24800}]);
    store.issue(3,400);
    expect(store.issue(3,480)).toEqual({day:4,availableDay:4});
    expect(store.delivered.map(r=>r.arrivalDay)).toEqual([4]);
  });
});
