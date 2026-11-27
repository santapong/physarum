import { describe, expect, it } from 'vitest';
import { buildShopPlan, defaults, reserveCasting, workDay, batchLimit } from './shop-plan';
import { DAY, isGold, shopOrders } from './shop-orders';
import { shopAccounts } from './shop-finance';
import { SHIFT_MIN_PER_DAY } from './fjsp';

const plan = buildShopPlan();
const accounts = shopAccounts(plan);
const byId = new Map(plan.orders.map(po=>[po.id,po]));
const points = new Map<string, { start: number; end: number; qty: number }>();
for (const b of plan.bookings) {
  for (const m of b.members) {
    const key = m.po+'/'+b.stage;
    const span=points.get(key) ?? {start:Infinity,end:0,qty:0};
    span.start=Math.min(span.start,b.start); span.end=Math.max(span.end,b.end); span.qty+=m.qty;
    points.set(key,span);
  }
}

describe('20-cell, 300-PO factory plan',()=>{
  it('completes each operation for every piece, in route order, including stock dependencies',()=>{
    expect(plan.orders).toHaveLength(300);
    expect(plan.orders.every(p=>p.pieces===20)).toBe(true);
    expect(new Set(plan.orders.map(p=>p.id)).size).toBe(300);
    expect(plan.orders[0].rates.file).toBe(5);
    expect(plan.orders[1].rates.file).toBe(2);
    for (const po of plan.orders) {
      let ready=(po.releaseDay-1)*DAY;
      if(po.feedsFrom){
        const feeder=byId.get(po.feedsFrom)!;
        expect(feeder.stock).toBe(true); expect(feeder.metal).toBe(po.metal);
        ready=Math.max(ready,feeder.ready);
      }
      for(const stage of po.stages){
        const span=points.get(po.id+'/'+stage)!;
        expect(span.qty).toBe(20); expect(span.start).toBeGreaterThanOrEqual(ready);
        ready=span.end;
      }
      expect(po.ready).toBe(ready);
    }
    expect(new Set(plan.orders.filter(p=>p.feedsFrom).map(p=>p.feedsFrom)).size).toBe(50);
  });

  it('uses eligible workers exclusively, respects metal lanes, and keeps setting in cell 21',()=>{
    const lanes=new Map<string,{start:number;end:number}[]>();
    for(const b of plan.bookings){
      expect(b.start % DAY).toBeLessThan(SHIFT_MIN_PER_DAY);
      expect(b.end-(workDay(b.start)-1)*DAY).toBeLessThanOrEqual(SHIFT_MIN_PER_DAY+1e-6);
      for(const resource of [b.resource,...(b.mold ? [b.mold]:[])]){
        const list=lanes.get(resource)??[]; list.push(b);lanes.set(resource,list);
      }
      const [m]=b.members;
      if (b.stage==='set'){expect(b.cell).toBe(21);expect(b.resource).toMatch(/^C21 set [1-8]$/);}
      else if (b.cell){
        const po=byId.get(m.po)!;expect(b.cell).toBe(po.cell);
        expect(b.cell<=10).toBe(isGold(po.metal)); expect(b.cell).toBeLessThanOrEqual(20);
        expect(b.resource).toMatch(b.stage==='qc'?/ qc [12]$/:/ (file|polish) [123]$/);
      }
    }
    for(const slots of lanes.values()){
      slots.sort((a,b)=>a.start-b.start);
      for(let i=1;i<slots.length;i++) expect(slots[i].start).toBeGreaterThanOrEqual(slots[i-1].end-1e-6);
    }
    expect(new Set(plan.orders.map(po=>po.cell)).size).toBe(20);
  });

  it('conserves pieces when splitting and combining POs into compatible plating and tumbling batches',()=>{
    for(const [stage,lo,hi] of [['plate',10,20],['tumble',60,120]] as const){
      const bs=plan.bookings.filter(b=>b.stage===stage);
      expect(bs.some(b=>b.members.length>1)).toBe(true);
      expect(bs.some(b=>b.members.reduce((n,m)=>n+m.qty,0)===batchLimit[stage])).toBe(true);
      for(const b of bs){
        expect(b.members.reduce((n,m)=>n+m.qty,0)).toBeLessThanOrEqual(batchLimit[stage]);
        expect(new Set(b.members.map(m=>byId.get(m.po)!.metal)).size).toBe(1);
        expect(b.end-b.start).toBeGreaterThanOrEqual(lo-1e-6);expect(b.end-b.start).toBeLessThanOrEqual(hi+1e-6);
      }
    }
    expect(plan.bookings.some(b=>b.stage==='plate'&&b.members.some(m=>m.qty<20))).toBe(true);
    const daily=new Map<number,number>();let end=0;
    for(let i=0;i<101;i++)end=reserveCasting(end,20,daily).end;
    expect([...daily]).toEqual([[1,2000],[2,20]]);
    expect([...plan.castByDay.values()].reduce((a,b)=>a+b,0)).toBe(3000);
    expect(Math.max(...plan.castByDay.values())).toBeLessThanOrEqual(2000);
  });

  it('consumes mold shots on eligible tools only after receipt and charges each replacement once',()=>{
    for(const m of plan.molds) {
      const bookings=plan.bookings.filter(b=>b.mold===m.id);
      expect(bookings.reduce((n,b)=>n+b.shots!,0)).toBe(m.used);expect(m.used).toBeLessThanOrEqual(m.opening);
      for(const b of bookings) expect(b.start).toBeGreaterThanOrEqual(m.available);
    }
    const halo=plan.molds.filter(m=>m.family==='Halo');
    expect(halo.map(m=>m.used)).toEqual([90,60,250,250,250,100]);
    expect(plan.moldBuys).toHaveLength(7);
    expect(accounts.daily.reduce((n,r)=>n+r.tooling,0)).toBe(840);
    expect(()=>buildShopPlan({...defaults,buyMolds:false})).toThrow(/more mold shots/);
  });

  it('reconciles MRP receipts, actual issues, internal stock and daily collections against completed POs',()=>{
    expect(accounts.sales).toHaveLength(250);
    expect(accounts.sales.reduce((n,s)=>n+s.qty,0)).toBe(5000);
    expect(accounts.mountings.reduce((n,m)=>n+m.received,0)).toBe(1000);
    expect(accounts.mountings.reduce((n,m)=>n+m.issued,0)).toBe(1000);
    expect(accounts.mountings.every(m=>m.closing>=0)).toBe(true);
    for(const item of accounts.stock){
      expect(item.closing).toBe(item.starting+item.purchased-item.demand);
      for(const row of item.ledger) expect(row.closing).toBeGreaterThanOrEqual(0);
    }
    for(const i of accounts.issues){
      expect(i.day).toBeGreaterThanOrEqual(i.availableDay);
      expect(i.day).toBe(workDay(points.get(i.po+'/'+i.stage)!.start));
    }
    let cash=defaults.startingCash;
    for(const d of accounts.daily){
      cash+=d.deposits+d.balances-d.materials-d.tooling-d.labor-d.overhead;
      expect(d.closing).toBeCloseTo(cash,2);
    }
    const revenue=accounts.sales.reduce((n,s)=>n+s.value,0);
    expect(accounts.daily.reduce((n,d)=>n+d.balances+d.deposits,0)).toBeCloseTo(revenue,2);
    expect(accounts.daily.reduce((n,d)=>n+d.materials+d.tooling,0)).toBeCloseTo(accounts.purchases.reduce((n,p)=>n+p.cost,0),2);
  });

  it('updates routes, batch durations, materials and collections from edited inputs',()=>{
    const orders=shopOrders();const first=orders[0];
    first.stages.splice(first.stages.indexOf('qc'),0,'plate');
    first.rates.file=2;
    const changed=buildShopPlan({...defaults,platingMin:19,tumbleMin:110,collectionDays:5},orders);
    const a=shopAccounts(changed);
    expect(changed.bookings.filter(b=>b.stage==='plate').every(b=>Math.abs(b.end-b.start-19)<1e-6)).toBe(true);
    expect(changed.bookings.filter(b=>b.stage==='tumble').every(b=>Math.abs(b.end-b.start-110)<1e-6)).toBe(true);
    expect(a.stock.find(s=>s.id==='Plating consumable')!.demand).toBe(3020);
    expect(a.sales.every(s=>s.collectDay===s.shipDay+5)).toBe(true);
  });
});
