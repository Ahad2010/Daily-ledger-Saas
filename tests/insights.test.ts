import {test} from 'node:test';
import assert from 'node:assert/strict';
import {metrics,type LedgerRecord} from '@ledger/shared';
import {buildInsights} from '../apps/web/lib/insights';
const tx=(id:string,date:string,amount:number,category:string,type='expense',title='Item')=>({id,kind:'transaction',version:1,data:{title,date,amount,currency:'USD',type,category,account:'Cash',notes:''}}) as unknown as LedgerRecord;
const budget=(amount:number)=>({id:'b',kind:'budget',version:1,data:{month:'2026-09',category:'',amount,currency:'USD',repeats:true}}) as unknown as LedgerRecord;
const asOf=new Date('2026-09-20T12:00:00Z');
test('no expenses means no insights',()=>{const records=[tx('1','2026-09-02',400000,'Salary','income')];assert.deepEqual(buildInsights(records,metrics(records,'2026-09','USD','UTC',asOf)),[]);});
test('pace, category, savings and largest expense come from real records',()=>{
 const records=[tx('1','2026-09-01',400000,'Salary','income'),tx('2','2026-09-03',60000,'Food','expense','Groceries'),tx('3','2026-09-10',20000,'Transport'),budget(100000)];
 const m=metrics(records,'2026-09','USD','UTC',asOf);const list=buildInsights(records,m);const ids=list.map(i=>i.id);
 assert.ok(ids.includes('pace')&&ids.includes('category')&&ids.includes('savings'));
 const pace=list.find(i=>i.id==='pace')!;assert.equal(pace.tone,'warn');assert.match(pace.text,/\$1,200/);
 assert.match(list.find(i=>i.id==='category')!.title,/Food/);assert.ok(list.length<=4);
});
test('weekend spending is only flagged when the daily average really differs',()=>{
 const records=[tx('1','2026-09-05',90000,'Fun'),tx('2','2026-09-08',2000,'Food')]; // Saturday vs Tuesday
 const list=buildInsights(records,metrics(records,'2026-09','USD','UTC',asOf));
 assert.ok(list.some(i=>i.id==='weekend'&&/Weekends cost more/.test(i.title)));
 const even=[tx('1','2026-09-05',10000,'Fun'),tx('2','2026-09-08',10000,'Food'),tx('3','2026-09-09',10000,'Food'),tx('4','2026-09-10',10000,'Food'),tx('5','2026-09-11',10000,'Food'),tx('6','2026-09-12',10000,'Fun')];
 assert.ok(!buildInsights(even,metrics(even,'2026-09','USD','UTC',asOf)).some(i=>i.id==='weekend'&&i.tone!=='info'));
});
test('one lone expense does not produce a "100% of everything" insight',()=>{
 const records=[tx('1','2026-09-01',400000,'Salary','income'),tx('2','2026-09-18',90000,'Essentials','expense','Bill')];
 const ids=buildInsights(records,metrics(records,'2026-09','USD','UTC',asOf)).map(i=>i.id);
 assert.ok(!ids.includes('category')&&!ids.includes('largest'));
});
