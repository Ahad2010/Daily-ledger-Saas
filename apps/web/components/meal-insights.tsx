'use client';
import {Wallet,Receipt,Repeat2} from 'lucide-react';
import {money,type Kind,type Snapshot} from '@ledger/shared';
import {mealInsights} from '../lib/meal-insights';
import {Entrance} from './animation';
import {AnimatedProgress} from './animation';

export function MealInsights({s,today,dates,onAdd}:{s:Snapshot;today:string;dates:string[];onAdd:(kind:Kind,initial?:Record<string,unknown>)=>void}){
 const i=mealInsights(s,today,dates),currency=s.profile.currency;const total=i.spent+i.remaining;
 if(!total&&!i.cookAgain.length)return null;
 const tomorrow=new Date(`${today}T12:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 return <Entrance className="panel meal-insights"><div className="panel-heading"><div><span className="eyebrow">FOOD SPENDING</span><h2>What your food costs</h2><p>Built from your grocery list and budgets.</p></div></div>
  <div className="meal-insight-grid">
   {total>0&&<div><span className="insight-icon"><Wallet size={16}/></span><small>Groceries this month</small><strong>{money(i.spent,currency)}</strong><p>{money(i.remaining,currency)} still on your list</p>{i.budget?<><AnimatedProgress value={i.budget?i.spent/i.budget*100:0}/><p>{Math.round(i.spent/i.budget*100)}% of your {money(i.budget,currency)} food budget</p></>:<p className="muted">Add a Groceries budget in Finance to track it.</p>}</div>}
   {i.perMeal!==null&&<div><span className="insight-icon"><Receipt size={16}/></span><small>Cost per planned meal</small><strong>{money(i.perMeal,currency)}</strong><p>Average for meals planned this week</p></div>}
   {i.cookAgain.length>0&&<div className="cook-again"><span className="insight-icon"><Repeat2 size={16}/></span><small>Cook again</small>{i.cookAgain.map(m=><button key={m.title} className="cook-again-item" onClick={()=>onAdd('meal',{title:m.title,slot:m.slot,ingredients:m.ingredients,date:tomorrow.toISOString().slice(0,10)})}><span>{m.title}</span><small>{m.times>1?`${m.times} times`:'Plan for tomorrow'}</small></button>)}</div>}
  </div></Entrance>;
}
