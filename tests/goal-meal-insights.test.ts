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
test('linked goals count transfers and income in the category since the start date, in the goal currency',()=>{
 const g={id:'g',kind:'goal',version:1,data:{title:'Save',description:'',current:5,target:1000,unit:'USD',deadline:'2026-12-31',active:true,startDate:'2026-09-10',linkedCategory:'savings'}} as unknown as LedgerRecord<'goal'>;
 const tx=(id:string,date:string,amount:number,category:string,type:string,currency='USD')=>rec(id,'transaction',{title:'x',date,amount,currency,type,category,account:'Cash',notes:''});
 const records=[g,tx('a','2026-09-12',20000,'Savings','transfer'),tx('b','2026-09-01',99900,'Savings','transfer'),tx('c','2026-09-15',5000,'Savings','expense'),tx('d','2026-09-20',10000,'Savings','income'),tx('e','2026-09-20',7000,'Savings','transfer','PKR'),tx('f','2026-09-20',7000,'Food','transfer')];
 assert.equal(goalProgress(g,records).current,300);
 const plain={...g,data:{...g.data,linkedCategory:undefined}} as unknown as LedgerRecord<'goal'>;assert.equal(goalProgress(plain,records).current,5);
});
import {goalHistory} from '@ledger/shared';
const goalWith=(auto:object,extra:object={})=>({id:'g2',kind:'goal',version:1,data:{title:'G',description:'',current:0,target:10,unit:'kg',deadline:'2026-12-31',active:true,startDate:'2026-09-01',autoSource:auto,...extra}}) as unknown as LedgerRecord<'goal'>;
test('goals follow weight, workouts, habits and lifts from the rest of the app',()=>{
 const metric=(id:string,date:string,weight:number)=>rec(id,'bodyMetric',{title:'c',date,weight,notes:''});
 const lose=goalWith({type:'weight',ref:'lose',baseline:80},{target:5});
 const r1=[lose,metric('a','2026-09-10',78),metric('b','2026-09-20',76.5),metric('c','2026-08-01',90)];
 assert.equal(goalProgress(lose,r1).current,3.5);assert.equal(goalHistory(lose,r1).length,2);assert.equal(goalHistory(lose,r1).at(-1)!.value,3.5);
 const gain=goalWith({type:'weight',ref:'gain',baseline:60},{target:4});assert.equal(goalProgress(gain,[gain,metric('d','2026-09-15',58)]).current,0);assert.equal(goalProgress(gain,[gain,metric('d','2026-09-15',62)]).current,2);
 const w=(id:string,date:string,done:boolean,exercises?:object[])=>rec(id,'workout',{title:'S',date,type:'Strength',duration:30,notes:'',done,exercises});
 const sessions=goalWith({type:'workouts'},{target:12});const wr=[sessions,w('1','2026-09-05',true),w('2','2026-09-08',true),w('3','2026-09-09',false),w('4','2026-08-20',true)];
 assert.equal(goalProgress(sessions,wr).current,2);assert.deepEqual(goalHistory(sessions,wr).map(p=>p.value),[1,2]);
 const lift=goalWith({type:'lift',ref:'Squat'},{target:100});const lr=[lift,w('5','2026-09-05',true,[{name:'Squat',sets:[{reps:5,weight:80}]}]),w('6','2026-09-12',true,[{name:'squat',sets:[{reps:3,weight:90},{reps:5,weight:70}]}]),w('7','2026-09-13',false,[{name:'Squat',sets:[{reps:1,weight:200}]}])];
 assert.equal(goalProgress(lift,lr).current,90);assert.deepEqual(goalHistory(lift,lr).map(p=>p.value),[80,90]);
 const habit=goalWith({type:'habit',ref:'h1'},{target:30});const comp=(id:string,date:string,h:string)=>rec(id,'completion',{habitId:h,date});
 assert.equal(goalProgress(habit,[habit,comp('c1','2026-09-02','h1'),comp('c2','2026-09-03','h1'),comp('c3','2026-09-03','h2')]).current,2);
 const manual={id:'g3',kind:'goal',version:1,data:{title:'M',description:'',current:40,target:100,unit:'x',deadline:'2026-12-31',active:true}} as unknown as LedgerRecord<'goal'>;
 const checks=[rec('k1','goalCheckin',{goalId:'g3',date:'2026-09-10',value:20,note:''}),rec('k2','goalCheckin',{goalId:'g3',date:'2026-09-20',value:40,note:''}),rec('k3','goalCheckin',{goalId:'other',date:'2026-09-20',value:99,note:''})];
 assert.deepEqual(goalHistory(manual,[manual,...checks]).map(p=>p.value),[20,40]);assert.equal(goalProgress(manual,[manual,...checks]).current,40);
});
