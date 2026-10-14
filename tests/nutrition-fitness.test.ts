import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schemas,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {foods,portion,searchFoods} from '../apps/web/lib/foods';
import {dayNutrition,suggestTarget,weekNutrition} from '../apps/web/lib/nutrition';
import {oneRepMax,personalRecords,programs,scheduleProgram,weekSummary,weightTrend,workoutVolume} from '../apps/web/lib/fitness';
const rec=(id:string,kind:string,data:object)=>({id,kind,version:1,data}) as unknown as LedgerRecord;
const snap=(records:LedgerRecord[])=>({profile:{currency:'USD'},records}) as unknown as Snapshot;

test('food database: every food is sane, search and portions scale per 100 g',()=>{
 assert.ok(foods.length>=60);
 for(const f of foods){assert.ok(f.calories>=0&&f.protein>=0&&f.carbs>=0&&f.fat>=0,f.name);assert.ok(f.serving>0,f.name);assert.ok(f.protein*4+f.carbs*4+f.fat*9<=f.calories*1.35+15,`${f.name} macros exceed its calories`);}
 assert.equal(new Set(foods.map(f=>f.name)).size,foods.length);
 assert.ok(searchFoods('daal').some(f=>f.name.startsWith('Daal')));
 const egg=foods.find(f=>f.name==='Egg, whole')!;const p=portion(egg,100);assert.equal(p.calories,143);assert.equal(portion(egg,200).calories,286);
});
test('target estimate follows goal and keeps macros consistent with calories',()=>{
 const base={sex:'male' as const,age:30,heightCm:180,weightKg:80,activity:'moderate' as const};
 const keep=suggestTarget({...base,goal:'maintain'}),lose=suggestTarget({...base,goal:'lose'}),gain=suggestTarget({...base,goal:'gain'});
 assert.ok(lose.calories<keep.calories&&keep.calories<gain.calories);
 assert.ok(keep.calories>2400&&keep.calories<3000);
 const kcal=keep.protein*4+keep.carbs*4+keep.fat*9;assert.ok(Math.abs(kcal-keep.calories)<25);
 assert.ok(suggestTarget({...base,sex:'female',goal:'maintain'}).calories<keep.calories);
});
test('day nutrition counts eaten meals only and prefers logged foods over the nutrition field',()=>{
 const s=snap([
  rec('a','meal',{title:'Eggs',date:'2026-09-30',slot:'Breakfast',eaten:true,foods:[{name:'Egg',grams:100,calories:143,protein:12.6,carbs:.7,fat:9.5}],nutrition:{calories:1}}),
  rec('b','meal',{title:'Lunch',date:'2026-09-30',slot:'Lunch',eaten:true,nutrition:{calories:500,protein:30}}),
  rec('c','meal',{title:'Dinner plan',date:'2026-09-30',slot:'Dinner',nutrition:{calories:700}}),
  rec('d','meal',{title:'Yesterday',date:'2026-09-29',slot:'Lunch',eaten:true,nutrition:{calories:900}})]);
 const day=dayNutrition(s,'2026-09-30');assert.equal(day.eaten.calories,643);assert.equal(day.planned.calories,700);assert.equal(Math.round(day.eaten.protein),43);
 assert.deepEqual(weekNutrition(s,['2026-09-29','2026-09-30']).map(d=>d.calories),[900,643]);
});
test('new record schemas validate and reject bad values',()=>{
 assert.ok(schemas.workout.safeParse({title:'Push',date:'2026-09-30',type:'Strength',duration:50,notes:'',exercises:[{name:'Bench',sets:[{reps:8,weight:60}]}]}).success);
 assert.ok(!schemas.workout.safeParse({title:'Push',date:'2026-09-30',type:'Strength',duration:50,notes:'',exercises:[{name:'Bench',sets:[{reps:-1,weight:60}]}]}).success);
 assert.ok(schemas.bodyMetric.safeParse({date:'2026-09-30',weight:70}).success);assert.ok(!schemas.bodyMetric.safeParse({date:'2026-09-30',weight:5}).success);
 assert.ok(schemas.nutritionTarget.safeParse({calories:2200,protein:140,carbs:250,fat:70}).success);assert.ok(!schemas.nutritionTarget.safeParse({calories:100,protein:1,carbs:1,fat:1}).success);
 assert.ok(schemas.meal.safeParse({title:'x',date:'2026-09-30',slot:'Lunch',foods:[{name:'Rice',grams:100,calories:130,protein:2.7,carbs:28,fat:.3}]}).success);
});
test('fitness maths: volume, one-rep max, personal records and week summary',()=>{
 assert.equal(oneRepMax(100,1),100);assert.equal(oneRepMax(100,10),133.3);
 const w=(id:string,date:string,done:boolean,exercises:object[])=>rec(id,'workout',{title:'S',date:date,type:'Strength',duration:40,notes:'',done,exercises}) as LedgerRecord<'workout'>;
 const a=w('a','2026-09-28',true,[{name:'Squat',sets:[{reps:5,weight:100},{reps:5,weight:100}]}]),b=w('b','2026-09-30',true,[{name:'Squat',sets:[{reps:3,weight:120}]},{name:'Plank',sets:[{reps:30,weight:0}]}]),c=w('c','2026-09-30',false,[{name:'Squat',sets:[{reps:1,weight:200}]}]);
 assert.equal(workoutVolume(a),1000);
 const s=snap([a,b,c]);const prs=personalRecords(s);assert.equal(prs.length,1);assert.equal(prs[0].name,'Squat');assert.equal(prs[0].weight,120);
 const week=weekSummary(s,'2026-09-30');assert.deepEqual([week.sessions,week.minutes,week.volume],[2,80,1360]);
});
test('body trend orders check-ins and reports change; programs schedule with rest days',()=>{
 const m=(id:string,date:string,weight:number)=>rec(id,'bodyMetric',{title:'c',date,weight,notes:''});
 const t=weightTrend(snap([m('b','2026-09-20',71),m('a','2026-09-01',74)]));assert.equal(t.rows[0].data.date,'2026-09-01');assert.equal(t.change,-3);assert.equal(t.latest,71);
 assert.equal(weightTrend(snap([])).change,null);
 const plan=scheduleProgram(programs[0],'2026-09-30');assert.deepEqual(plan.map(d=>d.date),['2026-10-01','2026-10-03','2026-10-05']);
 for(const p of programs)for(const d of p.days){assert.ok(schemas.workout.safeParse({title:d.title,date:'2026-10-01',type:d.type,duration:d.duration,notes:'',exercises:d.exercises,program:p.name}).success,d.title);}
});
