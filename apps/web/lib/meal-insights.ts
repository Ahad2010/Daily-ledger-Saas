import {recordsOf,type Snapshot} from '@ledger/shared';
export type CookAgain={title:string;slot:'Breakfast'|'Lunch'|'Dinner'|'Snack';ingredients:string;times:number};
export type MealInsight={spent:number;remaining:number;budget:number|null;perMeal:number|null;cookAgain:CookAgain[]};
const foodBudget=/grocer|food|meal/i;
// Everything comes from the user's own meals, grocery list and budgets in their profile currency.
export function mealInsights(s:Snapshot,today:string,dates:string[]):MealInsight{
 const currency=s.profile.currency;const month=today.slice(0,7);
 const groceries=recordsOf(s.records,'grocery').filter(g=>g.data.currency===currency);
 const spent=groceries.filter(g=>g.data.done).reduce((n,g)=>n+g.data.cost,0),remaining=groceries.filter(g=>!g.data.done).reduce((n,g)=>n+g.data.cost,0);
 const match=recordsOf(s.records,'budget').filter(b=>b.data.currency===currency&&b.data.month===month&&b.data.category&&foodBudget.test(b.data.category));
 const budget=match.length?match.reduce((n,b)=>n+b.data.amount,0):null;
 const meals=recordsOf(s.records,'meal');const week=meals.filter(m=>dates.includes(m.data.date));const weekIds=new Set(week.map(m=>m.id));
 const weekCost=groceries.filter(g=>g.data.mealId&&weekIds.has(g.data.mealId)).reduce((n,g)=>n+g.data.cost,0);
 const perMeal=week.length&&weekCost>0?Math.round(weekCost/week.length):null;
 const groups=new Map<string,CookAgain>();
 meals.filter(m=>m.data.date<=today).forEach(m=>{const key=m.data.title.trim().toLowerCase();const found=groups.get(key);if(found)found.times++;else groups.set(key,{title:m.data.title,slot:m.data.slot,ingredients:m.data.ingredients||'',times:1});});
 const cookAgain=[...groups.values()].filter(g=>g.times>=2||groups.size<=3).sort((a,b)=>b.times-a.times).slice(0,3);
 return {spent,remaining,budget,perMeal,cookAgain};
}
