'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Wallet,Receipt,Repeat2,Copy} from 'lucide-react';
import {money,recordsOf,schemas,type Kind,type Snapshot} from '@ledger/shared';
import {adapter} from '../lib/data';
import {Button} from './ui/button';
import {mealInsights} from '../lib/meal-insights';
import {Entrance} from './animation';
import {AnimatedProgress} from './animation';

export function MealInsights({s,today,dates,onAdd}:{s:Snapshot;today:string;dates:string[];onAdd:(kind:Kind,initial?:Record<string,unknown>)=>void}){
 const i=mealInsights(s,today,dates),currency=s.profile.currency,pro=s.profile.plan!=='Free';const total=i.spent+i.remaining;
 if(!total&&!i.cookAgain.length)return null;
 const tomorrow=new Date(`${today}T12:00:00Z`);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 return <Entrance className="panel meal-insights"><div className="panel-heading"><div><span className="eyebrow">FOOD SPENDING</span><h2>What your food costs</h2><p>Built from your grocery list and budgets.</p></div></div>
  <div className="meal-insight-grid">
   {total>0&&<div><span className="insight-icon"><Wallet size={16}/></span><small>Groceries this month</small><strong>{money(i.spent,currency)}</strong><p>{money(i.remaining,currency)} still on your list</p>{!pro?<p className="muted">Food budget tracking is in <Link href="/plans">Pro</Link>.</p>:i.budget?<><AnimatedProgress value={i.budget?i.spent/i.budget*100:0}/><p>{Math.round(i.spent/i.budget*100)}% of your {money(i.budget,currency)} food budget</p></>:<p className="muted">Add a Groceries budget in Finance to track it.</p>}</div>}
   {!pro&&<div className="meal-pro-lock"><span className="insight-icon"><Receipt size={16}/></span><small>Cost per meal and Cook again</small><strong>Pro</strong><p>See what each planned meal costs and repeat favourites in one tap.</p><Link className="button" href="/plans">See Pro</Link></div>}{pro&&i.perMeal!==null&&<div><span className="insight-icon"><Receipt size={16}/></span><small>Cost per planned meal</small><strong>{money(i.perMeal,currency)}</strong><p>Average for meals planned this week</p></div>}
   {pro&&i.cookAgain.length>0&&<div className="cook-again"><span className="insight-icon"><Repeat2 size={16}/></span><small>Cook again</small>{i.cookAgain.map(m=><button key={m.title} className="cook-again-item" onClick={()=>onAdd('meal',{title:m.title,slot:m.slot,ingredients:m.ingredients,date:tomorrow.toISOString().slice(0,10)})}><span>{m.title}</span><small>{m.times>1?`${m.times} times`:'Plan for tomorrow'}</small></button>)}</div>}
  </div></Entrance>;
}

// Pro: repeat last week's plan. Meals already planned this week are kept; only empty slots are filled, and groceries are not copied.
export function CopyLastWeek({s,dates}:{s:Snapshot;dates:string[]}){
 const client=useQueryClient();const [busy,setBusy]=useState(false),[note,setNote]=useState('');
 const meals=recordsOf(s.records,'meal');const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
 const last=meals.filter(m=>dates.includes(shift(m.data.date,7)));const missing=last.filter(m=>!meals.some(x=>x.data.date===shift(m.data.date,7)&&x.data.slot===m.data.slot));
 if(s.profile.plan==='Free')return <Link className="button" href="/plans" title="Pro feature">Copy last week · Pro</Link>;
 if(!last.length||!missing.length)return null;
 async function copy(){setBusy(true);setNote('');let done=0;try{for(const m of missing){const data=schemas.meal.parse({title:m.data.title,date:shift(m.data.date,7),slot:m.data.slot,notes:m.data.notes,ingredients:m.data.ingredients,servings:m.data.servings});await adapter.save({kind:'meal',data});done++;}setNote(`${done} meals copied.`);}catch(e){setNote(`${done} meals copied. ${(e as Error).message}`);}finally{await client.invalidateQueries({queryKey:['snapshot']});setBusy(false);}}
 return <><Button onClick={()=>void copy()} disabled={busy} loading={busy}><Copy size={15}/>Copy last week ({missing.length})</Button>{note&&<span role="status" className="muted">{note}</span>}</>;
}
