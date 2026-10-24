'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Apple,CalendarPlus,Copy,Droplets,Pencil,Plus,Search,Sparkles,Target,Trash2,X} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {money,recordsOf,schemas,type Kind,type LedgerRecord,type Snapshot,dateLocale,isImperial,weightUnit,kgToDisplay,displayToKg,cmToFeetInches,feetInchesToCm} from '@ledger/shared';
import {adapter} from '../lib/data';
import {foodGroups,portion,searchFoods,type Food} from '../lib/foods';
import {addMacros,dayNutrition,defaultWaterMl,nextBites,nutritionTarget,pct,recentFoods,suggestTarget,waterToday,weekNutrition,weekStats,type Macros,type Profile} from '../lib/nutrition';
import {AnimatedProgress,Entrance} from './animation';
import {HabitToggle} from './habit-checklist';
import {Tick} from './today-view';
import {MealGroceries,MealHealth} from './meal-health';
import {CopyLastWeek,MealInsights} from './meal-insights';
import {Button} from './ui/button';
import {Select} from './ui/select';
import {Dialog} from './ui/dialog';

type Tools={add:(kind:Kind,initial?:Record<string,unknown>)=>void;edit:(r:LedgerRecord)=>void;toggle:(r:LedgerRecord,key?:string)=>void;remove:(r:LedgerRecord)=>void};
const slots=['Breakfast','Lunch','Dinner','Snack'] as const;
type Slot=typeof slots[number];
const slotNow=():Slot=>{const h=new Date().getHours();return h<11?'Breakfast':h<16?'Lunch':h<21?'Dinner':'Snack';};
type Item={food:Food;grams:number};
const sumItems=(items:Item[])=>items.map(i=>portion(i.food,i.grams)).reduce<Macros>((n,p)=>addMacros(n,p),{calories:0,protein:0,carbs:0,fat:0});
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const tabs=[['today','Today'],['plan','Plan'],['groceries','Groceries'],['insights','Insights']] as const;
type Tab=typeof tabs[number][0];

function Actions({r,tools}:{r:LedgerRecord;tools:Tools}){return <div className="row-actions"><button className="icon-button" aria-label={`Edit ${(r.data as {title:string}).title}`} onClick={()=>tools.edit(r)}><Pencil size={15}/></button><button className="icon-button" aria-label={`Delete ${(r.data as {title:string}).title}`} onClick={()=>tools.remove(r)}><Trash2 size={15}/></button></div>;}

export function MealsHub({s,month,today,tools,pending,weeks,week,setWeek,dates}:{s:Snapshot;month:string;today:string;tools:Tools;pending:boolean;weeks:string[][];week:number;setWeek:(n:number)=>void;dates:string[]}){
 const [tab,setTab]=useState<Tab>('today');
 return <div className="meals-hub">
  <div className="meals-tabs" role="tablist" aria-label="Meals sections">{tabs.map(([id,label])=><button key={id} role="tab" id={`meals-tab-${id}`} aria-selected={tab===id} aria-controls="meals-panel" className={tab===id?'selected':''} onClick={()=>setTab(id)}>{label}</button>)}</div>
  <div id="meals-panel" role="tabpanel" aria-labelledby={`meals-tab-${tab}`} className="meals-panel">
   {tab==='today'&&<TodayTab s={s} today={today} tools={tools} pending={pending}/>}
   {tab==='plan'&&<PlanTab s={s} month={month} today={today} tools={tools} pending={pending} weeks={weeks} week={week} setWeek={setWeek} dates={dates}/>}
   {tab==='groceries'&&<GroceriesTab s={s} today={today} dates={dates} tools={tools} pending={pending}/>}
   {tab==='insights'&&<InsightsTab s={s} today={today} dates={dates}/>}
  </div>
 </div>;
}

function CalorieRing({eaten,target}:{eaten:number;target:number|null}){
 const size=132,r=56,c=2*Math.PI*r;const share=target?Math.min(1,eaten/target):0;const left=target?target-eaten:null;
 return <div className="cal-ring" role="img" aria-label={target?`${Math.round(eaten)} of ${target} calories eaten`:`${Math.round(eaten)} calories eaten`}>
  <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true"><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1d1f1e" strokeWidth="12"/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={left!==null&&left<0?'#ff9b7a':'#b6f26b'} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c*(1-share)} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dashoffset .9s cubic-bezier(.22,.8,.3,1)'}}/></svg>
  <div><strong>{left!==null?Math.abs(Math.round(left)):Math.round(eaten)}</strong><small>{left!==null?(left<0?'kcal over':'kcal left'):'kcal eaten'}</small></div>
 </div>;
}
function MacroBar({label,value,target,tone}:{label:string;value:number;target:number;tone:string}){return <div className="np-bar"><div className="np-bar-head"><span>{label}</span><strong>{Math.round(value)}<small> / {target}g</small></strong></div><div style={{['--bar' as string]:tone}}><AnimatedProgress value={pct(value,target)}/></div></div>;}

function TodayTab({s,today,tools,pending}:{s:Snapshot;today:string;tools:Tools;pending:boolean}){
 const client=useQueryClient();const target=nutritionTarget(s);const day=dayNutrition(s,today);const water=waterToday(s,today);
 const [setup,setSetup]=useState(false);
 const meals=recordsOf(s.records,'meal').filter(m=>m.data.date===today);
 const yesterday=recordsOf(s.records,'meal').filter(m=>m.data.date===shift(today,-1));
 const [busy,setBusy]=useState(''),[note,setNote]=useState('');
 const remaining:Macros|null=target?{calories:target.data.calories-day.eaten.calories,protein:target.data.protein-day.eaten.protein,carbs:target.data.carbs-day.eaten.carbs,fat:target.data.fat-day.eaten.fat}:null;
 const bites=remaining?nextBites(remaining):[];
 async function addWater(ml:number){
  setBusy('water');setNote('');
  try{const next=Math.max(0,water.ml+ml);const data=schemas.waterLog.parse({title:'Water',date:today,ml:next});
   await adapter.save({kind:'waterLog',data,...(water.log?{id:water.log.id,version:water.log.version}:{})});await client.invalidateQueries({queryKey:['snapshot']});
  }catch(e){setNote((e as Error).message);}finally{setBusy('');}
 }
 async function copyYesterday(){
  setBusy('copy');setNote('');let n=0;
  try{for(const m of yesterday){const {eaten:_eaten,generatedPlanId:_plan,...rest}=m.data;void _eaten;void _plan;await adapter.save({kind:'meal',data:schemas.meal.parse({...rest,date:today})});n++;}
   await client.invalidateQueries({queryKey:['snapshot']});setNote(`${n} meal${n===1?'':'s'} copied from yesterday. Tick them as you eat.`);
  }catch(e){setNote(`${n} copied. ${(e as Error).message}`);await client.invalidateQueries({queryKey:['snapshot']});}finally{setBusy('');}
 }
 const grouped=slots.map(slot=>({slot,items:meals.filter(m=>m.data.slot===slot)})).filter(g=>g.items.length);
 return <div className="meals-today">
  <Entrance className="panel np-summary">
   <div className="np-summary-top"><CalorieRing eaten={day.eaten.calories} target={target?.data.calories??null}/>
    <div className="np-macros-col">{target?<><MacroBar label="Protein" value={day.eaten.protein} target={target.data.protein} tone="#4cc3ff"/><MacroBar label="Carbs" value={day.eaten.carbs} target={target.data.carbs} tone="#f5b94a"/><MacroBar label="Fat" value={day.eaten.fat} target={target.data.fat} tone="#ff9b7a"/></>:<div className="np-empty"><p>Set a daily target to see calories left and protein, carbs and fat.</p></div>}</div></div>
   <div className="np-summary-foot"><span>{target?`Target ${target.data.calories} kcal`:'No target yet'}{day.planned.calories>0?` · ${Math.round(day.planned.calories)} kcal planned`:''}</span><Button onClick={()=>setSetup(true)}><Target size={14}/>{target?'Edit target':'Set daily target'}</Button></div>
  </Entrance>
  <FoodLogger s={s} today={today}/>
  <Entrance className="panel np-today-log"><div className="panel-heading"><div><h2>Today’s food</h2><p>{meals.length?`${meals.length} item${meals.length===1?'':'s'} · tick as you eat`:'Nothing logged yet today.'}</p></div>{yesterday.length>0&&meals.length===0&&<Button onClick={()=>void copyYesterday()} disabled={!!busy} loading={busy==='copy'}><Copy size={14}/>Copy yesterday</Button>}<Button onClick={()=>tools.add('meal',{date:today,slot:slotNow()})}><Plus size={14}/>Add meal</Button></div>
   {grouped.length?grouped.map(g=><div className="np-slot" key={g.slot}><h3>{g.slot}</h3>{g.items.map(m=>{const k=dayNutritionOf(m);return <div className="np-meal-row" key={m.id} data-record-id={`meal-${m.id}`} data-motion-state={String(m.version)}><HabitToggle checked={!!m.data.eaten} disabled={pending} label={`Eaten ${m.data.title} on ${m.data.date}`} onChange={()=>tools.toggle(m,'eaten')}/><Link href={`/meals/${m.id}`} className={m.data.eaten?'completed':''}>{m.data.title}</Link>{k>0&&<small>{k} kcal</small>}<Actions r={m} tools={tools}/></div>;})}</div>)
    :<p className="muted np-note">Search a food above, or copy yesterday’s meals in one tap.</p>}
   {note&&<p role="status" className="np-message">{note}</p>}
  </Entrance>
  <Entrance className="panel np-water"><div className="panel-heading"><div><h2><Droplets size={18}/> Water</h2><p>{water.ml.toLocaleString()} of {water.goal.toLocaleString()} ml</p></div></div>
   <AnimatedProgress value={pct(water.ml,water.goal)}/>
   <div className="np-water-actions"><Button onClick={()=>void addWater(250)} disabled={!!busy}>+ 250 ml</Button><Button onClick={()=>void addWater(500)} disabled={!!busy}>+ 500 ml</Button><Button onClick={()=>void addWater(-250)} disabled={!!busy||water.ml===0} aria-label="Remove 250 ml">Undo</Button></div></Entrance>
  {bites.length>0&&remaining&&<Entrance className="panel np-next"><div className="panel-heading"><div><h2><Sparkles size={18}/> What to eat next</h2><p>{remaining.protein>=15?`You still need about ${Math.round(remaining.protein)} g of protein.`:`Light options that fit your remaining ${Math.round(remaining.calories)} kcal.`}</p></div></div>
   <ul className="np-bites">{bites.map(b=><li key={b.food.name}><span><strong>{b.food.name}</strong><small>{b.food.unit?`${b.food.unit} · `:''}{b.grams} g · {b.calories} kcal · {b.protein} g protein</small></span></li>)}</ul></Entrance>}
  <TargetDialog s={s} open={setup} onOpenChange={setSetup}/>
 </div>;
}
function dayNutritionOf(m:LedgerRecord<'meal'>){const f=m.data.foods;if(f?.length)return Math.round(f.reduce((n,x)=>n+x.calories,0));return Math.round(m.data.nutrition?.calories||0);}

function FoodLogger({s,today}:{s:Snapshot;today:string}){
 const client=useQueryClient();const recents=useMemo(()=>recentFoods(s),[s]);
 const [query,setQuery]=useState(''),[group,setGroup]=useState('All'),[basket,setBasket]=useState<Item[]>([]),[slot,setSlot]=useState<Slot>(slotNow()),[date,setDate]=useState(today),[name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const results=useMemo(()=>query||group!=='All'?searchFoods(query,60).filter(f=>group==='All'||f.group===group).slice(0,8):[],[query,group]);
 const totals=sumItems(basket);
 const add=(food:Food,grams?:number)=>{setBasket(b=>b.some(i=>i.food.name===food.name)?b:[...b,{food,grams:grams||food.serving}]);setMessage('');};
 async function log(){
  if(!basket.length)return;setBusy(true);setMessage('');
  try{
   const parts=basket.map(i=>portion(i.food,i.grams));const title=(name.trim()||(basket.length===1?basket[0].food.name:`${basket[0].food.name} + ${basket.length-1} more`)).slice(0,160);
   const data=schemas.meal.parse({title,date,slot,notes:'',servings:1,eaten:true,foods:parts,ingredients:basket.map(i=>i.food.name).join(', ').slice(0,1000),nutrition:{calories:totals.calories,protein:Math.round(totals.protein),carbs:Math.round(totals.carbs),fat:Math.round(totals.fat)}});
   await adapter.save({kind:'meal',data});await client.invalidateQueries({queryKey:['snapshot']});
   setBasket([]);setName('');setQuery('');setGroup('All');setMessage(`${title} logged: ${totals.calories} kcal.`);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <Entrance className="panel np-log-card" aria-label="Log food">
  <div className="panel-heading"><div><h2><span className="np-title-icon"><Apple size={16}/></span>Log food</h2><p>Search, tap a food and log it as eaten. Values are approximate.</p></div></div>
  <label className="np-search"><Search size={16}/><input aria-label="Search foods" placeholder="Search foods: roti, daal, chicken, banana…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Clear food search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>
  {!query&&recents.length>0&&<div className="np-recents"><small>Recent</small><div>{recents.map(r=><button key={r.food.name} onClick={()=>add(r.food,r.grams)} aria-label={`Add recent ${r.food.name}`}>{r.food.name} <em>{r.grams} g</em></button>)}</div></div>}
  <div className="np-chips" role="group" aria-label="Food groups">{['All',...foodGroups].map(g=><button key={g} className={group===g?'selected':''} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
  {results.length>0&&<ul className="np-results">{results.map(f=><li key={f.name}><button onClick={()=>add(f)} aria-label={`Add ${f.name}`}><span className="np-food"><strong>{f.name}</strong><small>{f.unit?`${f.unit} ≈ ${f.serving} g`:`per 100 g`}</small><span className="np-macro-chips"><em className="kcal">{f.calories} kcal</em><em>P {f.protein}</em><em>C {f.carbs}</em><em>F {f.fat}</em></span></span><span className="np-add" aria-hidden="true"><Plus size={16}/></span></button></li>)}</ul>}
  {query&&!results.length&&<p className="muted np-note">No food found. Try another name or group.</p>}
  {basket.length>0&&<div className="np-basket"><h3>Your meal</h3>
   {basket.map(i=>{const p=portion(i.food,i.grams);return <div className="np-item" key={i.food.name}><span>{i.food.name}<small>{p.calories} kcal · P {p.protein} C {p.carbs} F {p.fat}</small></span><div className="np-qty" role="group" aria-label={`How many ${i.food.name}`}>{[1,2,3,4].map(n=><button type="button" key={n} className={Math.round(i.grams)===Math.round(i.food.serving*n)?'on':''} onClick={()=>setBasket(b=>b.map(x=>x.food.name===i.food.name?{...x,grams:Math.round(i.food.serving*n)}:x))}>{n}×</button>)}</div><div className="np-stepper"><button type="button" aria-label={`Less ${i.food.name}`} onClick={()=>setBasket(b=>b.map(x=>x.food.name===i.food.name?{...x,grams:Math.max(10,x.grams-10)}:x))}>−</button><label><input type="number" min={1} max={5000} aria-label={`Grams of ${i.food.name}`} value={i.grams} onChange={e=>setBasket(b=>b.map(x=>x.food.name===i.food.name?{...x,grams:Math.max(0,Number(e.target.value)||0)}:x))}/><small>g</small></label><button type="button" aria-label={`More ${i.food.name}`} onClick={()=>setBasket(b=>b.map(x=>x.food.name===i.food.name?{...x,grams:Math.min(5000,x.grams+10)}:x))}>+</button></div><button className="icon-button" aria-label={`Remove ${i.food.name}`} onClick={()=>setBasket(b=>b.filter(x=>x.food.name!==i.food.name))}><Trash2 size={14}/></button></div>;})}
   <div className="np-total"><strong>{totals.calories} kcal</strong><span className="np-macro-chips"><em>Protein {Math.round(totals.protein)} g</em><em>Carbs {Math.round(totals.carbs)} g</em><em>Fat {Math.round(totals.fat)} g</em></span></div>
   <div className="np-save"><input aria-label="Meal name" placeholder="Meal name (optional)" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><select aria-label="Meal slot" value={slot} onChange={e=>setSlot(e.target.value as Slot)}>{slots.map(x=><option key={x}>{x}</option>)}</select><input type="date" aria-label="Meal date" value={date} onChange={e=>setDate(e.target.value||today)}/><Button variant="primary" onClick={()=>void log()} disabled={busy} loading={busy}><Apple size={15}/>Log as eaten</Button></div>
  </div>}
  {message&&<p role="status" className="np-message">{message}</p>}
 </Entrance>;
}

function PlanTab({s,month,today,tools,pending,weeks,week,setWeek,dates}:{s:Snapshot;month:string;today:string;tools:Tools;pending:boolean;weeks:string[][];week:number;setWeek:(n:number)=>void;dates:string[]}){
 const meals=recordsOf(s.records,'meal');
 const [selected,setSelected]=useState(dates.includes(today)?today:dates[0]);
 const weekStart=dates[0];
 useEffect(()=>{setSelected(dates.includes(today)?today:dates[0]);},[weekStart,today]);
 const dayLabel=(d:string)=>new Date(`${d}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'short',timeZone:'UTC'});
 return <Entrance className="panel meal-plan-panel">
  <div className="panel-heading"><div><h2>Weekly meal plan</h2><p>Pick a day, plan its meals, tick them as you eat.</p></div><div className="inline-actions"><select aria-label="Meal plan week" value={week} onChange={e=>setWeek(Number(e.target.value))}>{weeks.map((ds,i)=><option value={i} key={i}>{new Date(ds[0]+'T12:00:00Z').toLocaleDateString(dateLocale(),{month:'short',day:'numeric'})} – {new Date(ds[6]+'T12:00:00Z').toLocaleDateString(dateLocale(),{month:'short',day:'numeric'})}</option>)}</select></div></div>
  <div className="plan-actions"><Link className="button primary" href={`/meals/planner?month=${month}&week=${week}`}><CalendarPlus size={15}/>Build weekly plan</Link><CopyLastWeek s={s} dates={dates}/></div>
  <div className="plan-days" role="group" aria-label="Choose a day">{dates.map(d=>{const count=meals.filter(m=>m.data.date===d).length;return <button key={d} className={'plan-day'+(selected===d?' selected':'')+(d===today?' today':'')} aria-pressed={selected===d} aria-label={`${dayLabel(d)} ${Number(d.slice(8))}, ${count} planned`} onClick={()=>setSelected(d)}><small>{dayLabel(d)}</small><strong>{Number(d.slice(8))}</strong><i className={count?'on':''}/></button>;})}</div>
  <div className="meal-grid plan-slots">{slots.map(slot=>{const items=meals.filter(m=>m.data.date===selected&&m.data.slot===slot);return <div className="plan-slot meal-slot" data-slot={slot} key={slot}><div className="plan-slot-head"><span>{slot}</span><button className="meal-plan-action" onClick={()=>tools.add('meal',{date:selected,slot})}><Plus size={16} strokeWidth={2.6}/>Plan meal</button></div>
   {items.map(r=><div className="np-meal-row" key={r.id} data-record-id={`meal-${r.id}`} data-motion-state={String(r.version)}><Tick checked={!!r.data.eaten} label={`Eaten ${r.data.title} on ${r.data.date}`} onChange={()=>{if(!pending)tools.toggle(r,'eaten');}}/><Link href={`/meals/${r.id}`} className={r.data.eaten?'completed':''}>{r.data.title}{(r.data.servings||1)>1&&<b className="qty-badge">×{r.data.servings}</b>}</Link><Actions r={r} tools={tools}/></div>)}
   {!items.length&&<button type="button" className="plan-empty" onClick={()=>tools.add('meal',{date:selected,slot})}>Nothing planned yet. Tap to add {slot.toLowerCase()}.</button>}</div>;})}</div>
 </Entrance>;
}

function GroceriesTab({s,today,dates,tools,pending}:{s:Snapshot;today:string;dates:string[];tools:Tools;pending:boolean}){
 const groceries=recordsOf(s.records,'grocery'),meals=recordsOf(s.records,'meal');
 const remaining=groceries.filter(r=>!r.data.done&&r.data.currency===s.profile.currency).reduce((n,r)=>n+r.data.cost,0);
 return <>
  <Entrance className="panel"><div className="panel-heading"><div><h2>Grocery list</h2><p>Estimated remaining cost: {money(remaining,s.profile.currency)}</p></div><Button onClick={()=>tools.add('grocery')}><Plus size={16}/>Add item</Button></div>
   <MealGroceries s={s} dates={dates}/>
   {groceries.map(r=><div className={`task-detail grocery-row${r.data.done?' is-done':''}`} key={r.id} data-record-id={`task-detail-${r.id}`} data-motion-state={String(r.version)}><Tick checked={r.data.done} label={`Purchased ${r.data.title}`} onChange={()=>{if(!pending)tools.toggle(r);}}/><div><strong className={r.data.done?'completed':''}>{r.data.title}</strong><p>{r.data.mealId&&(meals.find(m=>m.id===r.data.mealId)?.data.title||'Linked meal')}</p></div>{r.data.quantity&&<span className="qty-chip">{r.data.quantity}</span>}<span className="grocery-cost">{money(r.data.cost,r.data.currency)}</span><Actions r={r} tools={tools}/></div>)}
   {!groceries.length&&<p className="muted np-note">Your list is clear. Add what you need for your next meal, or let the plan fill it in.</p>}</Entrance>
  <MealInsights s={s} today={today} dates={dates} onAdd={tools.add}/>
 </>;
}

function InsightsTab({s,today,dates}:{s:Snapshot;today:string;dates:string[]}){
 const target=nutritionTarget(s);const stats=weekStats(s,dates);
 const week=weekNutrition(s,dates).map(d=>({...d,label:new Date(`${d.date}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'short',timeZone:'UTC'})}));
 return <>
  <Entrance className="panel"><div className="panel-heading"><div><h2>This week</h2><p>Based on meals you ticked as eaten.</p></div></div>
   <div className="np-stats"><div><small>Days logged</small><strong>{stats.logged}</strong></div><div><small>Avg calories</small><strong>{stats.avgCalories||'—'}</strong></div><div><small>Avg protein</small><strong>{stats.avgProtein?`${stats.avgProtein} g`:'—'}</strong></div><div><small>Days on target</small><strong>{target?stats.onTarget:'—'}</strong></div></div>
   <div className="np-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={week} margin={{left:-18,right:6,top:8}}><CartesianGrid vertical={false} stroke="#282828" strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false}/><YAxis tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'#ffffff06'}} content={({active,payload})=>active&&payload?.length?<div className="dark-tooltip"><strong>{String(payload[0].payload.date)}</strong><div><span>Calories</span><b>{Math.round(Number(payload[0].value))} kcal</b></div></div>:null}/>{target&&<ReferenceLine y={target.data.calories} stroke="#b6f26b" strokeDasharray="4 4"/>}<Bar dataKey="calories" fill="#80e4bd" radius={[6,6,0,0]} maxBarSize={34} animationDuration={500}/></BarChart></ResponsiveContainer></div></Entrance>
  <MealHealth s={s} dates={dates}/>
  <p className="muted np-note">General food-planning information, not medical advice. {today.slice(0,4)}</p>
 </>;
}

function TargetDialog({s,open,onOpenChange}:{s:Snapshot;open:boolean;onOpenChange:(v:boolean)=>void}){
 const client=useQueryClient();const current=nutritionTarget(s);
 const [p,setP]=useState<Profile>({sex:'female',age:28,heightCm:165,weightKg:65,activity:'light',goal:current?.data.goal||'maintain'});
 const [t,setT]=useState<Macros>(()=>current?{calories:current.data.calories,protein:current.data.protein,carbs:current.data.carbs,fat:current.data.fat}:suggestTarget({sex:'female',age:28,heightCm:165,weightKg:65,activity:'light',goal:'maintain'}));
 const [water,setWater]=useState(current?.data.waterMl||defaultWaterMl);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=(next:Profile)=>{setP(next);setT(suggestTarget(next));};
 const num=(v:string,min:number,max:number,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
 async function save(){
  setBusy(true);setError('');
  try{
   const data=schemas.nutritionTarget.parse({title:'Daily nutrition target',calories:Math.round(t.calories),protein:Math.round(t.protein),carbs:Math.round(t.carbs),fat:Math.round(t.fat),waterMl:Math.round(water),goal:p.goal});
   await adapter.save({kind:'nutritionTarget',data,...(current?{id:current.id,version:current.version}:{})});await client.invalidateQueries({queryKey:['snapshot']});onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Dialog variant="drawer" open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}} title="Your daily target" description="Answer a few questions for a starting estimate, then adjust the numbers. This is a planning aid, not medical advice.">
  <div className="np-form">
   <label><span>Sex</span><Select label="Sex" value={p.sex} onChange={v=>update({...p,sex:v})} options={[{value:'female',label:'Female'},{value:'male',label:'Male'}]}/></label>
   <label><span>Age</span><input type="number" value={p.age} min={14} max={90} onChange={e=>update({...p,age:num(e.target.value,14,90,p.age)})}/></label>
   {isImperial()?<div className="np-height"><label><span>Height (ft)</span><input type="number" value={cmToFeetInches(p.heightCm).feet} min={4} max={7} onChange={e=>update({...p,heightCm:num(String(feetInchesToCm(Number(e.target.value)||5,cmToFeetInches(p.heightCm).inches)),120,230,p.heightCm)})}/></label><label><span>(in)</span><input type="number" value={cmToFeetInches(p.heightCm).inches} min={0} max={11} onChange={e=>update({...p,heightCm:num(String(feetInchesToCm(cmToFeetInches(p.heightCm).feet,Math.min(11,Math.max(0,Number(e.target.value)||0)))),120,230,p.heightCm)})}/></label></div>:<label><span>Height (cm)</span><input type="number" value={p.heightCm} min={120} max={230} onChange={e=>update({...p,heightCm:num(e.target.value,120,230,p.heightCm)})}/></label>}
   <label><span>Weight ({weightUnit()})</span><input type="number" value={kgToDisplay(p.weightKg,0)} min={kgToDisplay(30,0)} max={kgToDisplay(250,0)} onChange={e=>update({...p,weightKg:num(String(displayToKg(Number(e.target.value)||0)),30,250,p.weightKg)})}/></label>
   <label><span>Activity</span><Select label="Activity" value={p.activity} onChange={v=>update({...p,activity:v})} options={[{value:'low',label:'Mostly sitting'},{value:'light',label:'Light',hint:'1 to 3 workouts a week'},{value:'moderate',label:'Moderate',hint:'3 to 5 workouts'},{value:'high',label:'Very active',hint:'6+ workouts or physical job'}]}/></label>
   <label><span>Goal</span><Select label="Goal" value={p.goal} onChange={v=>update({...p,goal:v})} options={[{value:'lose',label:'Lose weight slowly'},{value:'maintain',label:'Maintain weight'},{value:'gain',label:'Build muscle'}]}/></label>
  </div>
  <div className="np-form np-macros">
   <label><span>Calories (kcal)</span><input aria-label="Calories target" type="number" value={t.calories} onChange={e=>setT({...t,calories:num(e.target.value,800,10000,t.calories)})}/></label>
   <label><span>Protein (g)</span><input aria-label="Protein target" type="number" value={t.protein} onChange={e=>setT({...t,protein:num(e.target.value,0,600,t.protein)})}/></label>
   <label><span>Carbs (g)</span><input aria-label="Carbs target" type="number" value={t.carbs} onChange={e=>setT({...t,carbs:num(e.target.value,0,1200,t.carbs)})}/></label>
   <label><span>Fat (g)</span><input aria-label="Fat target" type="number" value={t.fat} onChange={e=>setT({...t,fat:num(e.target.value,0,500,t.fat)})}/></label>
   <label><span>Water (ml)</span><input aria-label="Water target" type="number" step={250} value={water} onChange={e=>setWater(num(e.target.value,0,10000,water))}/></label>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="dialog-actions"><Button onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void save()} disabled={busy} loading={busy}>Save target</Button></div>
 </Dialog>;
}
