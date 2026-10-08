import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot,metrics,reportRows,monthReport,weeklyReview,fullReportRows,reportSections,addDays,type LedgerRecord} from '../packages/shared/src/index';
const seed=demoSnapshot();
test('week-by-week rows add up to the month totals shown on the dashboard and in the CSV',()=>{
 const asOf=new Date('2026-09-30T07:00:00Z'),{timezone,currency}=seed.profile,m=metrics(seed.records,'2026-09',currency,timezone,asOf),report=monthReport(seed.records,'2026-09',currency,timezone,asOf);
 const sum=(key:'income'|'expenses'|'tasksDue'|'tasksDone'|'habitScheduled'|'habitDone'|'workoutMinutes')=>report.weeks.reduce((n,w)=>n+w[key],0);
 assert.equal(sum('income'),m.income);assert.equal(sum('expenses'),m.expenses);assert.equal(sum('tasksDue'),m.tasks.length);assert.equal(sum('tasksDone'),m.completed);assert.equal(sum('habitScheduled'),m.habitScheduled);assert.equal(sum('habitDone'),m.habitDone);
 const rows=reportRows(seed,'2026-09',asOf);assert.equal(sum('workoutMinutes'),rows.find(r=>r[0]==='Workout minutes')![1]);
 assert.equal(report.current.income,m.income);assert.equal(report.current.expenses,m.expenses);
 assert.deepEqual([report.weeks[0].label,report.weeks.at(-1)!.label],['Sep 1 – Sep 6','Sep 28 – Sep 30']);
 assert.ok(Math.abs(report.categories.reduce((n,c)=>n+c.percentage,0)-100)<1e-9);assert.equal(report.categories.reduce((n,c)=>n+c.amount,0),m.expenses);
 const csvRows=fullReportRows(seed,'2026-09',asOf);const header=csvRows.findIndex(r=>r[0]==='Week');assert.ok(header>0);assert.equal(csvRows[header+1][1],report.weeks[0].income/100);
 assert.deepEqual(reportSections(seed,'2026-09',asOf).map(x=>x.heading),['Overview','Goals','Week by week','Spending by category']);
});
test('a partial month is compared with the same days of the previous month',()=>{
 const report=monthReport(seed.records,'2026-09','USD','Asia/Karachi',new Date('2026-09-15T07:00:00Z'));
 assert.equal(report.partial,true);assert.equal(report.end,'2026-09-15');assert.equal(report.previousEnd,'2026-08-15');assert.equal(report.weeks.at(-1)!.to,'2026-09-15');
 assert.equal(report.previous.income,0,'the August income arrived on the 28th, after the comparison day');assert.equal(report.changes.income,null,'no comparison is invented without a baseline');
});
const tx=(id:string,date:string,amount:number,category:string):LedgerRecord=>({id,kind:'transaction',version:1,data:{title:id,date,amount,currency:'USD',type:'expense',category,account:'Cash',notes:''}});
const task=(id:string,due:string,done:boolean):LedgerRecord=>({id,kind:'task',version:1,data:{title:id,description:'',due,priority:'low',done,reminder:false,recurrence:'none'}});
test('weekly review reports only what the records show, with deterministic wins, slips and focus',()=>{
 const reading:LedgerRecord={id:'reading',kind:'habit',version:1,data:{title:'Reading',days:[1,2,3,4,5],active:true,startDate:'2026-09-20'}};
 const done=(date:string):LedgerRecord=>({id:'c'+date,kind:'completion',version:1,data:{habitId:'reading',date}});
 const workout=(id:string,date:string):LedgerRecord=>({id,kind:'workout',version:1,data:{title:id,date,type:'Run',duration:30,notes:'',done:true}});
 const budget:LedgerRecord={id:'b',kind:'budget',version:1,data:{title:'Food budget',month:'2026-10',amount:10000,currency:'USD',category:'Food'}};
 const records=[reading,...['2026-10-01','2026-10-02','2026-10-05','2026-09-24','2026-09-25'].map(done),task('T0','2026-09-01T10:00:00Z',false),task('T1','2026-10-02T10:00:00Z',true),task('T2','2026-10-04T10:00:00Z',true),task('T3','2026-10-06T10:00:00Z',false),tx('now','2026-10-03',8500,'Food'),tx('before','2026-09-25',20000,'Other'),workout('w1','2026-10-02'),workout('w2','2026-10-05'),budget];
 const review=weeklyReview(records,{currency:'USD',timezone:'UTC',asOf:new Date('2026-10-07T12:00:00Z')});
 assert.equal(review.current.from,'2026-10-01');assert.equal(review.previous.to,'2026-09-30');
 assert.deepEqual(review.wins,['You completed 2 of 3 tasks due.','Habit consistency rose to 60% (from 40%).','2 workouts · 60 minutes of movement.','Spending fell by $115 compared with the previous 7 days.']);
 assert.deepEqual(review.slips,['You missed 2 scheduled habit check-ins (Reading ×2).','2 tasks are overdue; the oldest is "T0".','Food budget is 85% used.']);
 assert.deepEqual(review.focus,['Clear or reschedule 2 overdue tasks.','Protect "Reading": 2 of 5 scheduled days were missed.','Hold Food spending: $15 left this month.']);assert.equal(review.empty,false);
});
test('weekly review says so when there is nothing to review, and never invents numbers',()=>{
 const review=weeklyReview([],{currency:'USD',timezone:'Asia/Karachi',asOf:new Date('2026-10-07T12:00:00Z')});
 assert.equal(review.empty,true);assert.deepEqual(review.wins,[]);assert.deepEqual(review.slips,[]);assert.deepEqual(review.focus,["Plan next week's priorities in Tasks & Habits."]);
 assert.equal(addDays('2026-03-01',-1),'2026-02-28');assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
