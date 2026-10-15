import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot} from '@ledger/shared';
import {localAnswer} from '../apps/web/lib/local-assistant';
const s=demoSnapshot(),asOf=new Date('2026-09-30T10:00:00Z');
test('demo assistant answers from the account\'s own records',()=>{
 assert.match(localAnswer(s,'Summarize my month','2026-09',asOf).answer,/This month you earned \$4,000 and spent \$1,280/);
 assert.match(localAnswer(s,'Where did my money go?','2026-09',asOf).answer,/Essentials/);
 assert.match(localAnswer(s,'What needs my attention?','2026-09',asOf).answer,/open task/);
 assert.match(localAnswer(s,'How are my goals doing?','2026-09',asOf).answer,/Emergency fund: 60%/);
 assert.match(localAnswer(s,'Help me plan my week','2026-09',asOf).answer,/Going well|Focus next|To watch/);
 assert.match(localAnswer(s,'How many calories today?','2026-09',asOf).answer,/kcal/);
});
test('demo assistant proposes validated actions and never invents answers',()=>{
 const task=localAnswer(s,'Add a task: call the bank','2026-09',asOf);assert.equal(task.actions?.[0].type,'create');assert.equal((task.actions![0] as {data:{title:string}}).data.title,'call the bank');
 const expense=localAnswer(s,'Log a $12 lunch expense today','2026-09',asOf);const e=expense.actions![0] as {kind:string;data:{amount:number;category:string}};assert.equal(e.kind,'transaction');assert.equal(e.data.amount,1200);assert.equal(e.data.category,'Food');
 const other=localAnswer(s,'What is the meaning of life','2026-09',asOf);assert.match(other.answer,/AI provider/);assert.equal(other.actions,undefined);
});
