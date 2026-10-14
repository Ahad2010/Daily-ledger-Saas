import {recordsOf,type LedgerRecord,type Snapshot} from '@ledger/shared';
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
