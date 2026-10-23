import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarWeeks,cmToFeetInches,defaultDisplay,displayToKg,feetInchesToCm,formatDate,formatWeight,kgToDisplay,money,setDisplay} from '@ledger/shared';

test('defaults are metric, Monday, month-first and US numbers',()=>{
 setDisplay(null);
 assert.deepEqual(defaultDisplay,{units:'metric',weekStart:1,dateFormat:'mdy',numberFormat:'us'});
 assert.equal(money(123456,'USD'),'$1,235');assert.equal(formatWeight(70),'70 kg');assert.equal(calendarWeeks('2026-09')[0][0],'2026-08-31');
});
test('imperial converts for display and back to kilograms for storage',()=>{
 setDisplay({units:'imperial'});
 assert.equal(kgToDisplay(100),220.5);assert.equal(formatWeight(100),'220 lb');assert.equal(Math.round(displayToKg(220.5)*10)/10,100);
 assert.deepEqual(cmToFeetInches(180),{feet:5,inches:11});assert.equal(feetInchesToCm(5,11),180);
 setDisplay(null);
});
test('week start and date format change what is shown',()=>{
 setDisplay({weekStart:0,dateFormat:'dmy',numberFormat:'eu'});
 assert.equal(calendarWeeks('2026-09')[0][0],'2026-08-30');assert.equal(formatDate('2026-09-30'),'30 Sep 2026');
 assert.match(money(123456,'USD'),/1\.235/);
 setDisplay({dateFormat:'iso'});assert.equal(formatDate('2026-09-30'),'2026-09-30');
 setDisplay(null);
});

test('changing currency re-labels amounts instead of hiding them',async()=>{
 const {relabelCurrency}=await import('@ledger/shared');
 const rows=[{kind:'transaction',data:{amount:1000,currency:'USD'}},{kind:'budget',data:{amount:500,currency:'USD'}},{kind:'goal',data:{unit:'USD',target:1000}},{kind:'goal',data:{unit:'kg',target:5}},{kind:'task',data:{title:'x'}}];
 const out=relabelCurrency(rows,'USD','AED') as typeof rows;
 assert.equal((out[0].data as any).currency,'AED');assert.equal((out[0].data as any).amount,1000);assert.equal((out[1].data as any).currency,'AED');assert.equal((out[2].data as any).unit,'AED');assert.equal((out[3].data as any).unit,'kg');assert.deepEqual(out[4],rows[4]);
 assert.equal(relabelCurrency(rows,'USD','USD'),rows);
});
