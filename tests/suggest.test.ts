import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot} from '@ledger/shared';
import {transactionHint,taskHint} from '../apps/web/lib/suggest';
test('suggestions learn from the member\'s own history and common words',()=>{
 const s=demoSnapshot();const c=s.profile.currency;
 assert.equal(transactionHint('ab',s.records,c),null);
 const uber=transactionHint('Uber ride to office',s.records,c);assert.ok(uber?.categories.includes('Transport'));
 const salary=transactionHint('Salary from Acme',s.records,c);assert.equal(salary?.type,'income');
 const first=s.records.find(r=>r.kind==='transaction'&&(r.data as any).type==='expense'&&(r.data as any).currency===c)!;
 const again=transactionHint((first.data as any).title,s.records,c);assert.ok(again?.categories.includes((first.data as any).category));assert.ok(again?.amount&&again.amount.cents>0);
 assert.equal(transactionHint('zzzzzz qqqq',s.records,c),null);
});
test('task priority hints',()=>{assert.equal(taskHint('Pay electricity bill today')?.priority,'high');assert.equal(taskHint('Maybe read a book')?.priority,'low');assert.equal(taskHint('Call mum'),null);});
