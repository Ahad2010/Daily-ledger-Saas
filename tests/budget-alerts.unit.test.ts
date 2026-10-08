import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetAlerts,budgetAlertEnd,budgetAlertText,type LedgerRecord} from '../packages/shared/src/index';
const tx=(id:string,amount:number,category='Food',date='2026-10-03',currency='USD',type='expense'):LedgerRecord=>({id,kind:'transaction',version:1,data:{title:id,date,amount,currency,type:type as 'expense',category,account:'Cash',notes:''}});
const budget=(id:string,amount:number,category?:string,month='2026-10'):LedgerRecord=>({id,kind:'budget',version:3,data:{title:category||'Monthly spending budget',month,amount,currency:'USD',category}});
test('alerts fire at 80% and 100% of the real spending, per category, and ignore other currencies, income and transfers',()=>{
 const records=[budget('b-food',10000,'Food'),budget('b-all',100000),tx('a',7999),tx('income',50000,'Food','2026-10-03','USD','income'),tx('euro',9000,'Food','2026-10-03','EUR')];
 assert.deepEqual(budgetAlerts(records,'2026-10','USD','2026-10-31'),[],'79.99% is below the first threshold');
 const at80=budgetAlerts([...records,tx('b',1)],'2026-10','USD','2026-10-31');assert.equal(at80.length,1);assert.equal(at80[0].threshold,80);assert.equal(at80[0].name,'Food');assert.equal(at80[0].spent,8000);
 const over=budgetAlerts([...records,tx('c',2501)],'2026-10','USD','2026-10-31');assert.equal(over[0].threshold,100);assert.equal(over[0].percent,105);
 assert.match(budgetAlertText(over[0]).body,/\$5 over/);assert.match(budgetAlertText(at80[0]).title,/80% of budget used/);
});
test('a repeating budget applies to later months and the evaluation window ends today in the current month',()=>{
 const repeating={...budget('r',10000,'Food','2026-09'),data:{...budget('r',10000,'Food','2026-09').data,repeats:true}} as LedgerRecord;
 const records=[repeating,tx('late',9000,'Food','2026-10-20')];
 assert.equal(budgetAlerts(records,'2026-10','USD','2026-10-31')[0].threshold,80);
 assert.equal(budgetAlerts(records,'2026-10','USD','2026-10-10').length,0,'spending after the evaluation end is not counted yet');
 assert.equal(budgetAlertEnd('2026-10','Asia/Karachi',new Date('2026-10-10T20:00:00Z')),'2026-10-11');assert.equal(budgetAlertEnd('2026-09','UTC',new Date('2026-10-10T00:00:00Z')),'2026-09-30');
});
