import {test} from 'node:test';
import assert from 'node:assert/strict';
import {goalProgress,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {goalPace} from '../apps/web/lib/goal-pace';
import {mealInsights} from '../apps/web/lib/meal-insights';
const goal=(current:number,startDate?:string)=>({id:'g',kind:'goal',version:1,data:{title:'Save',description:'',current,target:100,unit:'USD',deadline:'2026-10-31',active:true,startDate}}) as unknown as LedgerRecord<'goal'>;
const pace=(g:LedgerRecord<'goal'>,today='2026-10-01')=>goalPace(g,goalProgress(g,[g]),today);
test('goal pace: ahead, on track, behind, overdue, done and legacy goals',()=>{
 assert.equal(pace(goal(60,'2026-09-01')).status,'ahead');
 assert.equal(pace(goal(50,'2026-09-01')).status,'on-track');
 assert.equal(pace(goal(10,'2026-09-01')).status,'at-risk');
 assert.equal(pace(goal(10,'2026-09-01'),'2026-11-05').status,'overdue');
 assert.equal(pace(goal(100,'2026-09-01')).status,'done');
 const legacy=pace(goal(40));assert.equal(legacy.status,'on-track');assert.equal(legacy.projected,null);assert.ok(legacy.perWeek!>0);
 assert.equal(pace(goal(0,'2026-09-01')).projected,null);
});
const rec=(id:string,kind:string,data:object)=>({id,kind,version:1,data}) as unknown as LedgerRecord;
test('meal insights: grocery spend, food budget, cost per meal and cook again',()=>{
 const dates=['2026-09-28','2026-09-29','2026-09-30'];
 const s={profile:{currency:'USD'},records:[
  rec('m1','meal',{title:'Daal',date:'2026-09-28',slot:'Dinner'}),rec('m2','meal',{title:'Daal',date:'2026-09-29',slot:'Dinner'}),rec('m3','meal',{title:'Eggs',date:'2026-09-30',slot:'Breakfast'}),
  rec('g1','grocery',{title:'Lentils',cost:600,currency:'USD',done:true,mealId:'m1'}),rec('g2','grocery',{title:'Eggs',cost:400,currency:'USD',done:false,mealId:'m3'}),rec('g3','grocery',{title:'Rupees',cost:900,currency:'PKR',done:true}),
  rec('b1','budget',{month:'2026-09',amount:5000,currency:'USD',category:'Groceries'}),rec('b2','budget',{month:'2026-09',amount:9000,currency:'USD',category:'Rent'})]} as unknown as Snapshot;
 const r=mealInsights(s,'2026-09-30',dates);
 assert.deepEqual([r.spent,r.remaining,r.budget,r.perMeal],[600,400,5000,333]);
 assert.equal(r.cookAgain[0].title,'Daal');assert.equal(r.cookAgain[0].times,2);
});
