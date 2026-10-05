import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarWeeks,parseMoneyInput } from '@ledger/shared';
test('human currency entry preserves cents and rejects unsupported precision',()=>{
 assert.equal(parseMoneyInput('12.50'),1250);assert.equal(parseMoneyInput('0.01'),1);assert.equal(parseMoneyInput('25'),2500);assert.equal(parseMoneyInput('1.5'),150);
 for(const value of ['1.999','1e4','-10','','text'])assert.ok(Number.isNaN(parseMoneyInput(value)));
});
test('meal weeks have seven Monday-to-Sunday dates across month and year boundaries',()=>{
 const weeks=calendarWeeks('2026-09');assert.equal(weeks[0][0],'2026-08-31');assert.equal(weeks.at(-1)?.at(-1),'2026-10-04');assert.equal(weeks.flat().filter(d=>d.startsWith('2026-09')).length,30);
 for(const week of weeks){assert.equal(week.length,7);assert.equal(new Date(week[0]).getUTCDay(),1);assert.equal(new Date(week[6]).getUTCDay(),0);}
 assert.equal(calendarWeeks('2027-01')[0][0],'2026-12-28');
});

import {habitStats,type LedgerRecord} from '@ledger/shared';
test('habit streaks ignore rest days, duplicates and future or unscheduled check-ins',()=>{
 const habit:LedgerRecord<'habit'>={id:'routine',kind:'habit',version:1,data:{title:'Reading',days:[1,3,5],startDate:'2026-09-01',active:true}};
 const dates=['2026-09-02','2026-09-04','2026-09-07','2026-09-07','2026-09-11','2026-09-14','2026-09-16','2026-09-17','2026-09-30'];
 const completions=dates.map((date,i)=>({id:String(i),kind:'completion' as const,version:1,data:{habitId:'routine',date}}));
 assert.deepEqual(habitStats(habit,[habit,...completions],'2026-09-16'),{current:3,best:3,total:6});
 assert.equal(habitStats(habit,[habit,...completions],'2026-09-18').current,3);
 assert.equal(habitStats(habit,[habit,...completions],'2026-09-19').current,0);
});
