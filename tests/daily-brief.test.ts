import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot,type LedgerRecord} from '@ledger/shared';
import {dailyBrief} from '../apps/web/lib/daily-brief';
const snapshot=(records:LedgerRecord[]=[])=>{const s=demoSnapshot();s.records=records;s.profile.name='Ahad Noor';s.profile.timezone='Asia/Karachi';return s;};
const task=(id:string,due:string,done=false)=>({id,kind:'task',version:1,data:{title:id,description:'',due,priority:'medium',done,reminder:true,recurrence:'none'}}) as unknown as LedgerRecord;
test('greeting follows the account holder’s own local time and first name',()=>{
 assert.equal(dailyBrief(snapshot(),new Date('2026-10-14T03:30:00Z')).greeting,'Good morning, Ahad'); // 08:30 in Karachi
 assert.equal(dailyBrief(snapshot(),new Date('2026-10-14T08:00:00Z')).greeting,'Good afternoon, Ahad'); // 13:00
 assert.equal(dailyBrief(snapshot(),new Date('2026-10-14T14:00:00Z')).greeting,'Good evening, Ahad'); // 19:00
 assert.equal(dailyBrief(snapshot(),new Date('2026-10-14T20:30:00Z')).greeting,'Good night, Ahad'); // 01:30 next day
});
test('the line counts only open tasks that are due today or overdue',()=>{
 const records=[task('a','2026-10-14T09:00:00+05:00'),task('b','2026-10-13T09:00:00+05:00'),task('c','2026-10-20T09:00:00+05:00'),task('d','2026-10-14T09:00:00+05:00',true)];
 const morning=dailyBrief(snapshot(records),new Date('2026-10-14T03:30:00Z'));assert.equal(morning.open.tasks,2);assert.match(morning.line,/2 tasks for today/);
 const evening=dailyBrief(snapshot(records),new Date('2026-10-14T14:00:00Z'));assert.match(evening.line,/2 tasks still open/);
 assert.match(dailyBrief(snapshot(),new Date('2026-10-14T14:00:00Z')).line,/done/);
});
