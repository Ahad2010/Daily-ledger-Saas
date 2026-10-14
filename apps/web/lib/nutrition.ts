import {recordsOf,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {foods,portion,type Food} from './foods';
export type Macros={calories:number;protein:number;carbs:number;fat:number};
export type Profile={sex:'female'|'male';age:number;heightCm:number;weightKg:number;activity:'low'|'light'|'moderate'|'high';goal:'lose'|'maintain'|'gain'};
const factors={low:1.2,light:1.375,moderate:1.55,high:1.725} as const;
// Mifflin-St Jeor estimate. A starting point for planning, not medical advice.
export function suggestTarget(p:Profile):Macros{
 const bmr=10*p.weightKg+6.25*p.heightCm-5*p.age+(p.sex==='male'?5:-161);
 const maintenance=bmr*factors[p.activity];
 const calories=Math.round((p.goal==='lose'?maintenance-450:p.goal==='gain'?maintenance+300:maintenance)/10)*10;
 const protein=Math.round(p.weightKg*(p.goal==='gain'?2:1.8));
 const fat=Math.round(calories*.27/9);
 const carbs=Math.max(0,Math.round((calories-protein*4-fat*9)/4));
 return {calories,protein,carbs,fat};
}
const zero=():Macros=>({calories:0,protein:0,carbs:0,fat:0});
export function mealMacros(m:LedgerRecord<'meal'>):Macros{
 const foods=m.data.foods;
 if(foods?.length)return foods.reduce((n,x)=>({calories:n.calories+x.calories,protein:n.protein+x.protein,carbs:n.carbs+x.carbs,fat:n.fat+x.fat}),zero());
 const n=m.data.nutrition;return {calories:n?.calories||0,protein:n?.protein||0,carbs:n?.carbs||0,fat:n?.fat||0};
}
export const addMacros=(a:Macros,b:Macros):Macros=>({calories:a.calories+b.calories,protein:a.protein+b.protein,carbs:a.carbs+b.carbs,fat:a.fat+b.fat});
// Only meals ticked as eaten count towards the day; planned meals are shown separately.
export function dayNutrition(s:Snapshot,date:string){
 const meals=recordsOf(s.records,'meal').filter(m=>m.data.date===date);
 const eaten=meals.filter(m=>m.data.eaten).reduce((n,m)=>addMacros(n,mealMacros(m)),zero());
 const planned=meals.filter(m=>!m.data.eaten).reduce((n,m)=>addMacros(n,mealMacros(m)),zero());
 return {eaten,planned,count:meals.length};
}
export function nutritionTarget(s:Snapshot){return recordsOf(s.records,'nutritionTarget')[0];}
export function weekNutrition(s:Snapshot,dates:string[]){return dates.map(date=>({date,calories:dayNutrition(s,date).eaten.calories}));}
export const pct=(value:number,target:number)=>target>0?Math.min(100,Math.round(value/target*100)):0;

export const defaultWaterMl=2500;
export function waterToday(s:Snapshot,date:string){const log=recordsOf(s.records,'waterLog').find(w=>w.data.date===date);return {log,ml:log?.data.ml||0,goal:nutritionTarget(s)?.data.waterMl||defaultWaterMl};}
// Foods the account logged most recently, with the portion used last time, so repeat meals are one tap.
export function recentFoods(s:Snapshot,limit=8){
 const seen=new Map<string,{food:Food;grams:number}>();
 recordsOf(s.records,'meal').slice().sort((a,b)=>b.data.date.localeCompare(a.data.date)).forEach(m=>(m.data.foods||[]).forEach(x=>{
  if(seen.has(x.name))return;const food=foods.find(f=>f.name===x.name);if(food)seen.set(x.name,{food,grams:Math.max(1,Math.round(x.grams))});
 }));
 return [...seen.values()].slice(0,limit);
}
// Foods that fit what is left of the day: protein-dense when protein is short, otherwise the lightest options within the remaining calories.
export function nextBites(remaining:Macros,limit=4){
 if(remaining.calories<120)return [];
 const proteinShort=remaining.protein>=15;
 const fits=foods.filter(f=>{const k=f.serving/100;return f.calories*k<=remaining.calories+40&&f.calories*k>=40;});
 const score=(f:Food)=>{const k=f.serving/100;return proteinShort?(f.protein*k)/Math.max(1,f.calories*k)*100:-Math.abs(f.calories*k-remaining.calories/2);};
 return fits.sort((a,b)=>score(b)-score(a)).slice(0,limit).map(f=>({food:f,...portion(f,f.serving)}));
}
export function weekStats(s:Snapshot,dates:string[]){
 const target=nutritionTarget(s);const days=dates.map(d=>({date:d,...dayNutrition(s,d)})).filter(d=>d.eaten.calories>0);
 const avg=(pick:(m:Macros)=>number)=>days.length?Math.round(days.reduce((n,d)=>n+pick(d.eaten),0)/days.length):0;
 const onTarget=target?days.filter(d=>Math.abs(d.eaten.calories-target.data.calories)<=target.data.calories*.1).length:0;
 return {logged:days.length,avgCalories:avg(m=>m.calories),avgProtein:avg(m=>m.protein),onTarget};
}
