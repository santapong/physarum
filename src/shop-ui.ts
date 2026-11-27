import './style.css';
import './shop.css';
import { shopAccounts, overheadPerDay, type GoldPaymentTerms, type ShopAccounts } from './shop-finance';
import type { PurchasingPolicy } from './shop-materials';
import { buildShopPlan, purchaseTargets, defaults, batchLimit, castingLimit, limitedGold, workDay, replacement, type ShopPlan, type ShopSettings } from './shop-plan';
import { arrivalTrial, trialDefaults, unexpectedOrder } from './shop-arrival';
import { DAY, shopOrders, stageLabel, type LaborStage, type Stage } from './shop-orders';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const select = (id: string) => el<HTMLSelectElement>(id);
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });
const usd = (n: number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const at = (t: number) => 'D' + workDay(t) + ' +' + num(t % DAY) + 'm';
const orders = shopOrders();
const incoming = unexpectedOrder();
const trialParams = new URLSearchParams(location.search);
let trialActive = trialParams.get('trial') === 'arrival';
let trialOptions = {
  day: Number(trialParams.get('day') ?? trialDefaults.day),
  minute: Number(trialParams.get('minute') ?? trialDefaults.minute),
  capacity: Number(trialParams.get('capacity') ?? trialDefaults.capacity),
};
let report: ReturnType<typeof arrivalTrial>['report'] | undefined;
let plan: ShopPlan;
let accounts: ShopAccounts;
let goldTerms: GoldPaymentTerms = trialParams.get('goldPay') === 'delivery' ? 'delivery' : 'upfront';
let paymentLedgers: Record<GoldPaymentTerms, ShopAccounts>;
let purchasingPolicy: PurchasingPolicy = trialParams.get('purchasing') === 'po-start' ? 'po-start' : 'early';
interface PolicyCase {
  plan: ShopPlan;
  report?: ReturnType<typeof arrivalTrial>['report'];
  ledgers: Record<GoldPaymentTerms, ShopAccounts>;
}
let policyCases: Partial<Record<PurchasingPolicy, PolicyCase>> = {};
let policyErrors: Partial<Record<PurchasingPolicy, string>> = {};
let currentInputs: ShopSettings = { ...defaults };
const qty = (members: { qty: number }[]) => members.reduce((n,m) => n+m.qty, 0);

function table(id: string, headers: string[], data: (string | number)[][]) {
  const container = el(id);
  container.className = 'shop-table';
  const grid = document.createElement('table');
  const header = grid.createTHead().insertRow();
  for (const h of headers) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = h; header.append(th);
  }
  const body = grid.createTBody();
  for (const values of data) {
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = typeof value === 'number' ? num(value) : value;
  }
  container.replaceChildren(grid);
}

function numberField(parent: HTMLElement, name: string, title: string, value: number, min: number, max: number, step=1) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'number'; input.name = name; input.value = String(value);
  input.min = String(min); input.max = String(max); input.step = String(step); input.required = true;
  label.append(title, input); parent.append(label);
}
const fields = el('setting-fields');
numberField(fields, 'setters', 'Setters in cell 21', defaults.setters, 1, 160);
for (const [name,title,lo,hi] of [
  ['platingMin','Plating cycle',10,20], ['tumbleMin','Tumbling cycle',60,120],
] as const) {
  const label = document.createElement('label'), pick = document.createElement('select');
  pick.name = name; pick.add(new Option('By alloy ('+lo+'–'+hi+' min)', '0'));
  for (let minutes = lo; minutes <= hi; minutes++) pick.add(new Option(minutes+' min', String(minutes)));
  label.append(title, pick); fields.append(label);
}
numberField(fields, 'startingCash', 'Opening cash (USD)', defaults.startingCash, 0, 1000000000);
numberField(fields, 'wagePerHour', 'Cost per occupied hour (USD)', defaults.wagePerHour, 0, 1000, .01);
numberField(fields, 'depositPct', 'Deposit at order (%)', defaults.depositPct, 0, 100);
numberField(fields, 'collectionDays', 'Days from shipping to collection', defaults.collectionDays, 0, 365);
el('cost-assumptions').textContent = 'Model assumes 4 g of metal per cast piece, $' + overheadPerDay +
  ' overhead per production day. Other materials and tooling are paid on order. Replacement molds cost $' + replacement.cost +
  ' each, last ' + replacement.shots + ' shots and arrive in ' + replacement.lead +
  ' days. Finished unit price = 1.35 × 4 g metal cost + $55 with setting or $32 without. Tool changes take zero minutes.';

function drawCash() {
  const canvas = el<HTMLCanvasElement>('cash-chart');
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (!width || !height) return;
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const c = canvas.getContext('2d')!;
  c.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const values = [currentInputs.startingCash, ...accounts.daily.map(d => d.closing)];
  const low = Math.min(0, ...values), high = Math.max(1, ...values);
  const x = (i: number) => 70 + i * (width - 92) / (values.length - 1);
  const y = (v: number) => 18 + (high - v) * (height - 50) / (high-low);
  c.clearRect(0,0,width,height); c.font = '13px system-ui';
  for (const level of new Set([high,0,low])) {
    c.strokeStyle = '#364c40'; c.beginPath(); c.moveTo(67,y(level)); c.lineTo(width-20,y(level)); c.stroke();
    c.fillStyle = '#bbccbd'; c.fillText((level<0?'−$':'$')+num(Math.round(Math.abs(level)/1000))+'k', 5, y(level)+4);
  }
  c.strokeStyle = '#b3dc8f'; c.lineWidth = 3; c.beginPath();
  values.forEach((v,i) => i ? c.lineTo(x(i),y(v)) : c.moveTo(x(i),y(v))); c.stroke(); c.lineWidth = 1;
  c.fillStyle = '#f4ae88'; c.beginPath(); c.arc(x(accounts.minDay),y(accounts.minCash),4.5,0,2*Math.PI); c.fill();
  c.fillStyle = '#b6c8b9'; c.fillText('Opening',x(0),height-8); c.textAlign='right';
  c.fillText('Day '+accounts.daily.length,x(values.length-1),height-8); c.textAlign='left';
}

function showStock() {
  const item = accounts.stock.find(s => s.id === select('stock-select').value);
  if (item) table('stock-ledger',['Day','Opening','Receipts','After receipts','Issues','Closing'],item.ledger.map(d => [d.day,d.opening,d.received,d.afterReceipt,d.issued,d.closing]));
}

function showOrder() {
  const po = plan.orders.find(p => p.id === select('po-select').value)!;
  const booked = plan.bookings.filter(b => b.members.some(m => m.po === po.id)).sort((a,b) => a.start-b.start);
  const sale = accounts.sales.find(s => s.po === po.id);
  el('po-route').textContent = po.metal+' · '+po.pieces+' pieces · Cell '+po.cell+' · '+po.stages.map(s => stageLabel[s]).join(' → ') +
    (po.feedsFrom ? ' · Uses '+po.feedsFrom : '') + (sale ? ' · Ships D'+sale.shipDay+' · Collect '+usd(sale.balance)+' D'+sale.collectDay : ' · Internal stock');
  table('po-detail',['Stage','Resource','Start','Finish','PO pieces','Mold / shots'],booked.map(b => [
    stageLabel[b.stage],b.resource,at(b.start),at(b.end),qty(b.members.filter(m=>m.po===po.id)),b.mold ? b.mold+' / '+b.shots : '—',
  ]));
  table('po-material',['Material issued','Quantity','Issue day'],accounts.issues.filter(i=>i.po===po.id).map(i=>[i.item,i.qty,i.day]));
  const purchases = accounts.purchases.filter(p=>p.triggerPo === po.id);
  el('po-buy-note').textContent = purchases.length ? 'Lot dates for shortages that triggered a purchase.' :
    'This PO draws from stock and lots already allocated to the plan.';
  table('po-buys',['Item','Buy qty','Planned PO start','Target use','Order day','Receipt day','Pay day'],
    purchases.map(p=>[p.item,p.qty,p.plannedStartDay ?? '—',p.needDay ?? '—',p.orderDay,p.arrivalDay,p.paymentDay]));
  const parent = el('po-fields'); parent.replaceChildren();
  for (const [stage, rate] of Object.entries(po.rates)) {
    numberField(parent,stage,stageLabel[stage as Stage]+' (min/piece)',rate,0.1,560,0.1);
  }
  if (!po.stock) {
    const label = document.createElement('label'), cb = document.createElement('input');
    cb.type='checkbox'; cb.name='includePlating'; cb.checked=po.stages.includes('plate');
    label.className='inline-check'; label.append(cb,' Include plating before QC'); parent.append(label);
  }
}

function showTrial() {
  el('restore-baseline').hidden = !trialActive;
  el('arrival-results').hidden = !report;
  if (!report) return;
  el('arrival-summary').textContent = report.incoming+' arrived '+at(report.at)+' · first operation '+at(report.firstStart)+
    ' · ships D'+report.shipDay+'. '+report.completedBefore+' existing POs had finished. '+
    report.frozenBookings+' started or completed resource bookings were retained, including '+report.runningBookings+' in progress.';
  table('arrival-comparison',['Scenario','POs','Peak 18K-Y (g)','Last shop day','Lowest cash ($)','Ending cash ($)'],
    report.comparison.map(r=>[r.label,r.orders,r.peakGold,r.lastDay,goldTerms === 'delivery' ? r.deliveryCashLow : r.cashLow,r.closingCash]));
  const last = report.comparison[2];
  const drops = last.deliveries.map(d=>'D'+d.day+' · '+num(d.grams)+' g').join(' / ');
  el('delivery-notes').textContent = '18K-Y receipts: '+drops+'. The supplier holds lots until there is room in the warehouse. '+
    'Compared with the previous capped schedule, '+report.earlierDays+' existing POs finish on an earlier day and '+report.laterDays+' on a later day.';
  table('arrival-changes',['PO','Before arrival','Replanned finish'],report.changes.map(c=>[c.po,at(c.previous),at(c.revised)]));
}

function showGoldPayments() {
  const {upfront, delivery} = paymentLedgers;
  select('gold-terms').value = goldTerms;
  const saved = upfront.additionalCash - delivery.additionalCash;
  el('gold-savings').textContent = 'With '+usd(currentInputs.startingCash)+' opening cash, paying on delivery reduces the additional funding needed by '+
    usd(saved)+'. Both columns use the same production plan, gold price and receipts. Funding is measured at daily close.';
  table('gold-comparison', ['Cash measure','Pay upfront','Pay on delivery'], [
    ['Minimum opening cash',usd(upfront.minimumOpeningCash),usd(delivery.minimumOpeningCash)],
    ['Additional funding',usd(upfront.additionalCash),usd(delivery.additionalCash)],
    ['Lowest balance',usd(upfront.minCash),usd(delivery.minCash)],
    ['Lowest balance day',upfront.minDay || 'Opening',delivery.minDay || 'Opening'],
    ['Ending balance',usd(upfront.closing),usd(delivery.closing)],
  ]);
  const receipts = upfront.stock.find(s=>s.id===limitedGold)?.ledger;
  const rows: (string | number)[][] = [];
  upfront.daily.forEach((day,i)=>{
    const grams = receipts?.[i].received ?? 0;
    const other = delivery.daily[i];
    if (grams || day.goldPaid || other.goldPaid) rows.push([day.day,grams,usd(day.goldPaid),usd(other.goldPaid)]);
  });
  table('gold-payments',['Day','Received (g)','Upfront payment','On-delivery payment'],rows);
}

function showPurchasing() {
  select('purchase-policy').value = purchasingPolicy;
  const original = policyCases.early?.ledgers[goldTerms];
  const staged = policyCases['po-start']?.ledgers[goldTerms];
  if (!original || !staged) {
    const missing = !original ? 'early' : 'po-start';
    el('purchase-result').textContent = 'Comparison unavailable · '+policyErrors[missing];
    el('policy-comparison').replaceChildren();
  } else {
    comparePurchasing(original, staged);
  }
  const active = policyCases[purchasingPolicy]?.ledgers[goldTerms];
  if (!active) {
    el('supply-calendar').replaceChildren();
    return;
  }
  showSupplyCalendar(active);
}

function comparePurchasing(original: ShopAccounts, staged: ShopAccounts) {
  const orderDays = (a: ShopAccounts) => new Set(a.purchases.map(p=>p.orderDay)).size;
  const receiptDays = (a: ShopAccounts) => new Set(a.purchases.map(p=>p.arrivalDay)).size;
  const paidAtOpening = (a: ShopAccounts) => a.daily[0].materials + a.daily[0].tooling;
  const ship = (a: ShopAccounts) => a.sales.find(s=>s.po===incoming.id)?.shipDay ?? '—';
  const originalShipDays = new Map(original.sales.map(s=>[s.po,s.shipDay]));
  const later = staged.sales.filter(s=>s.shipDay > originalShipDays.get(s.po)!).length;
  const earlier = staged.sales.filter(s=>s.shipDay < originalShipDays.get(s.po)!).length;
  el('purchase-result').textContent = 'Same customer orders, lot sizes and lead times. 18K-Y is paid '+
    (goldTerms === 'delivery' ? 'on delivery' : 'on order')+'. Under staged purchasing, '+earlier+
    ' finished POs ship on an earlier day and '+later+' on a later day.';
  table('policy-comparison',['Measure','Release-date buying','Staged buying'],[
    ['Days placing supplier orders',orderDays(original),orderDays(staged)],
    ['Days receiving supplier deliveries',receiptDays(original),receiptDays(staged)],
    ['Day 1 supplier payments',usd(paidAtOpening(original)),usd(paidAtOpening(staged))],
    ['Additional funding',usd(original.additionalCash),usd(staged.additionalCash)],
    ['Lowest cash day',original.minDay || 'Opening',staged.minDay || 'Opening'],
    ['Last production day',original.shopDays,staged.shopDays],
    ...(trialActive ? [['PO-301 ship day',ship(original),ship(staged)]] : []),
  ]);
}

function showSupplyCalendar(active: ShopAccounts) {
  const supplierDays = active.daily.map(day=>{
    const ordered=active.purchases.filter(p=>p.orderDay===day.day);
    const received=active.purchases.filter(p=>p.arrivalDay===day.day);
    const shipped=active.sales.filter(s=>s.shipDay===day.day);
    return [day.day,usd(ordered.reduce((sum,p)=>sum+p.cost,0)),usd(received.reduce((sum,p)=>sum+p.cost,0)),
      usd(day.materials+day.tooling),shipped.length,shipped.reduce((sum,s)=>sum+s.qty,0)];
  });
  table('supply-calendar',['Day','Ordered value','Received value','Supplier payments','POs shipped','Pieces shipped'],supplierDays);
}

function render() {
  el('plan-error').hidden = true; el('result').hidden = false; el<HTMLButtonElement>('save-plan').disabled = false;
  el('plan-title-detail').textContent = 'Jewelry FJSP · '+plan.orders.length+' production orders · 20 pieces per order · 560-minute shifts';
  showTrial();
  showPurchasing();
  showGoldPayments();
  const kpis = [
    ['Production orders',num(plan.orders.length)+' × 20 pc'],['Shop completion','Day '+accounts.shopDays],
    ['Lowest daily cash',usd(accounts.minCash)],['Ending cash',usd(accounts.closing)],
  ];
  el('kpis').replaceChildren(...kpis.map(([k,v])=>{
    const a=document.createElement('article'), label=document.createElement('small'), value=document.createElement('strong');
    label.textContent=k; value.textContent=v; a.append(label,value); return a;
  }));
  el('cash-caption').textContent = 'Daily closing balance in simulated USD. Opening '+usd(currentInputs.startingCash)+
    ' · Lowest '+usd(accounts.minCash)+' on '+(accounts.minDay ? 'day '+accounts.minDay : 'opening')+
    ' · Last customer collection on day '+Math.max(...accounts.sales.map(s=>s.collectDay))+
    (accounts.minCash<0 ? ' · Unfunded cash requirement '+usd(-accounts.minCash)+'.' : '.');
  drawCash();
  table('cash-ledger',['Day','Deposits $','Collections $','Materials $','Tooling $','Resource cost $','Overhead $','Net $','Closing $'],
    accounts.daily.map(d=>[d.day,d.deposits,d.balances,d.materials,d.tooling,d.labor,d.overhead,d.net,d.closing]));
  const sold = accounts.sales.reduce((n,s)=>n+s.qty,0);
  const total = plan.orders.reduce((n,o)=>n+o.pieces,0);
  el('material-caption').textContent = num(total)+' pieces across POs · '+num(sold)+' finished for sale · '+num(total-sold)+' stock mountings issued to dependent orders.';
  table('mrp',['Material','Unit','Opening','Required','Buy','Ending','Unit cost $','Lead days'],
    accounts.stock.map(s=>[s.id,s.unit,s.starting,s.demand,s.purchased,s.closing,s.price,s.lead]));
  table('mounting-ledger',['Metal','Day','Received from stock POs','Issued to finishing POs','Closing pieces'],
    accounts.mountings.map(row=>[row.metal,row.day,row.received,row.issued,row.closing]));
  const grouped = new Map<string, (typeof accounts.purchases)[number]>();
  for (const p of accounts.purchases) {
    const key=[p.item,p.orderDay,p.arrivalDay].join('/');
    const row=grouped.get(key) ?? {...p,qty:0,cost:0}; row.qty+=p.qty; row.cost+=p.cost; grouped.set(key,row);
  }
  table('purchases',['Purchase item','Order day','Receipt day','Payment day','Buy qty','Payment $'],
    [...grouped.values()].sort((a,b)=>a.orderDay-b.orderDay||a.item.localeCompare(b.item)).map(r=>[r.item,r.orderDay,r.arrivalDay,r.paymentDay,r.qty,r.cost]));
  const old = select('stock-select').value;
  select('stock-select').replaceChildren(...accounts.stock.map(s=>new Option(s.id,s.id)));
  if (accounts.stock.some(s=>s.id===old)) select('stock-select').value=old;
  showStock();
  const lastCast = Math.max(...plan.castByDay.keys());
  table('casting',['Day','Cast pieces','Daily limit','Unused'],Array.from({length:lastCast},(_,i)=>{
    const n=plan.castByDay.get(i+1)??0;return [i+1,n,castingLimit,castingLimit-n];
  }));
  const batches=plan.bookings.filter(b=>b.stage==='plate'||b.stage==='tumble');
  table('batch-summary',['Stage','Pieces / batch','Cycle min','Runs','Pieces'],(['plate','tumble'] as const).map(stage=>{
    const rows=batches.filter(b=>b.stage===stage);const times=rows.map(b=>b.end-b.start);
    return [stageLabel[stage],batchLimit[stage],times.length ? num(Math.min(...times))+'–'+num(Math.max(...times)) : '—',rows.length,rows.reduce((a,r)=>a+qty(r.members),0)];
  }));
  const byPo=new Map(plan.orders.map(po=>[po.id,po]));
  table('batches',['Stage','Alloy','Start','End','Pieces','PO contributions'],batches.map(b=>[
    stageLabel[b.stage],byPo.get(b.members[0].po)!.metal,at(b.start),at(b.end),qty(b.members),b.members.map(m=>m.po+' × '+m.qty).join(', '),
  ]));
  table('cells',['Cell','Eligible metals','Filers','Polishers','QC','Setters','POs served','Booked hours'],Array.from({length:21},(_,i)=>{
    const cell=i+1, rs=plan.bookings.filter(b=>b.cell===cell);
    return [cell,cell===21?'All · setting':cell<=10?'Gold':'Silver / bronze / brass',cell===21?0:3,cell===21?0:3,cell===21?0:2,
      cell===21?currentInputs.setters:0,new Set(rs.flatMap(r=>r.members.map(m=>m.po))).size,Math.round(rs.reduce((s,b)=>s+b.end-b.start,0)/60*10)/10];
  }));
  table('molds',['Physical mold','Ready day','Pieces / shot','Initial shots','Used','Left'],plan.molds.map(m=>[
    m.id,workDay(m.available),m.cavities,m.opening,m.used,m.opening-m.used,
  ]));
  const oldPo = select('po-select').value;
  select('po-select').replaceChildren(...plan.orders.map(p=>new Option(p.id+' · '+p.model+' · '+p.metal,p.id)));
  if (plan.orders.some(p=>p.id===oldPo)) select('po-select').value=oldPo;
  showOrder();
}

function activatePurchasingPolicy() {
  const selected = policyCases[purchasingPolicy];
  if (!selected) {
    el('arrival-results').hidden = true;
    el('restore-baseline').hidden = !trialActive;
    el('result').hidden = true;
    el<HTMLButtonElement>('save-plan').disabled = true;
    el('plan-error').hidden = false;
    el('plan-error').textContent = 'Plan unavailable · '+policyErrors[purchasingPolicy];
    showPurchasing();
    return;
  }
  plan = selected.plan;
  report = selected.report;
  paymentLedgers = selected.ledgers;
  accounts = paymentLedgers[goldTerms];
  render();
}

function recalc() {
  policyCases = {};
  policyErrors = {};
  for (const policy of ['early','po-start'] as const) {
    try {
      const experiment = trialActive ? arrivalTrial(currentInputs,orders,incoming,trialOptions,policy) : undefined;
      const reference = policy === 'po-start' && !trialActive ? policyCases.early?.plan : undefined;
      if (policy === 'po-start' && !trialActive && !reference) throw new Error('No feasible reference schedule.');
      const schedule = experiment?.updated ?? buildShopPlan(currentInputs,orders,
        reference ? {purchaseTargets:purchaseTargets(reference)} : {});
      policyCases[policy] = {plan:schedule, report:experiment?.report,
        ledgers:{upfront:shopAccounts(schedule), delivery:shopAccounts(schedule,'delivery')}};
    } catch (err) {
      policyErrors[policy] = err instanceof Error ? err.message : String(err);
    }
  }
  activatePurchasingPolicy();
}
const arrivalForm = el<HTMLFormElement>('arrival-form');
function setTrialUrl() {
  const url = new URL(location.href);
  for (const key of ['trial','day','minute','capacity']) url.searchParams.delete(key);
  if (trialActive) {
    url.searchParams.set('trial','arrival');
    for (const key of ['day','minute','capacity'] as const) {
      if (trialOptions[key] !== trialDefaults[key]) url.searchParams.set(key,String(trialOptions[key]));
    }
  }
  history.replaceState(null,'',url);
}
for (const [name, value] of Object.entries({arrivalDay:trialOptions.day,arrivalMinute:trialOptions.minute,goldLimit:trialOptions.capacity})) {
  (arrivalForm.elements.namedItem(name) as HTMLInputElement).value = String(value);
}
el('arrival-form').addEventListener('submit',e=>{
  e.preventDefault();
  const data = new FormData(el<HTMLFormElement>('arrival-form'));
  trialOptions = {day:Number(data.get('arrivalDay')), minute:Number(data.get('arrivalMinute')), capacity:Number(data.get('goldLimit'))};
  trialActive = true;
  recalc();
  if (!el('result').hidden) { setTrialUrl(); select('po-select').value = incoming.id; showOrder(); }
});
el('restore-baseline').addEventListener('click',()=>{
  trialActive = false;
  setTrialUrl();
  recalc();
});
select('purchase-policy').addEventListener('change',()=>{
  purchasingPolicy = select('purchase-policy').value === 'po-start' ? 'po-start' : 'early';
  const url = new URL(location.href);
  if (purchasingPolicy === 'po-start') url.searchParams.set('purchasing','po-start');
  else url.searchParams.delete('purchasing');
  history.replaceState(null,'',url);
  activatePurchasingPolicy();
});
select('gold-terms').addEventListener('change',()=>{
  goldTerms = select('gold-terms').value === 'delivery' ? 'delivery' : 'upfront';
  accounts = paymentLedgers[goldTerms];
  const url = new URL(location.href);
  if (goldTerms === 'delivery') url.searchParams.set('goldPay','delivery');
  else url.searchParams.delete('goldPay');
  history.replaceState(null,'',url);
  render();
});
select('po-select').addEventListener('change',showOrder);
select('stock-select').addEventListener('change',showStock);
el('settings-form').addEventListener('submit',e=>{
  e.preventDefault();
  const data=new FormData(el<HTMLFormElement>('settings-form'));
  currentInputs={ ...defaults, buyMolds:el<HTMLInputElement>('buy-molds').checked };
  for (const key of ['setters','platingMin','tumbleMin','startingCash','wagePerHour','depositPct','collectionDays'] as const) {
    currentInputs[key]=Number(data.get(key));
  }
  recalc();
});
el('po-edit').addEventListener('submit',e=>{
  e.preventDefault();
  const id=select('po-select').value;
  const po=id===incoming.id ? incoming : orders.find(p=>p.id===id)!;
  const data=new FormData(el<HTMLFormElement>('po-edit'));
  for (const stage of Object.keys(po.rates) as LaborStage[]) po.rates[stage]=Number(data.get(stage));
  if (!po.stock) {
    po.stages=po.stages.filter(s=>s!=='plate');
    if (data.has('includePlating')) po.stages.splice(po.stages.indexOf('qc'),0,'plate');
  }
  recalc();
});
el('save-plan').addEventListener('click',()=>{
  const payload={settings:currentInputs,purchasingPolicy,arrivalTrial:report,orders:plan.orders,bookings:plan.bookings,molds:plan.molds,
    castingByDay:Object.fromEntries(plan.castByDay),accounts};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a'); a.href=url; a.download='physarum-20-cell-production-plan.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
recalc();
if (trialActive && report) { select('po-select').value=incoming.id; showOrder(); }
new ResizeObserver(() => { if (accounts) drawCash(); }).observe(el('cash-chart'));
