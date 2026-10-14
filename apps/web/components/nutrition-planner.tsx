'use client';
import {useMemo,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Apple,Flame,Plus,Search,Target,Trash2,X} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,ReferenceLine,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {schemas,type Snapshot} from '@ledger/shared';
import {adapter} from '../lib/data';
import {foods,foodGroups,portion,searchFoods,type Food} from '../lib/foods';
import {addMacros,dayNutrition,nutritionTarget,pct,suggestTarget,weekNutrition,type Macros,type Profile} from '../lib/nutrition';
import {AnimatedProgress,Entrance} from './animation';
import {Button} from './ui/button';
import {Dialog} from './ui/dialog';

const slots=['Breakfast','Lunch','Dinner','Snack'] as const;
const slotNow=()=>{const h=new Date().getHours();return h<11?'Breakfast':h<16?'Lunch':h<21?'Dinner':'Snack';};
type Item={food:Food;grams:number};
const sumItems=(items:Item[])=>items.map(i=>portion(i.food,i.grams)).reduce<Macros>((n,p)=>addMacros(n,p),{calories:0,protein:0,carbs:0,fat:0});

function Bar1({label,value,target,unit,tone}:{label:string;value:number;target:number;unit:string;tone:string}){
 return <div className="np-bar"><div className="np-bar-head"><span>{label}</span><strong>{Math.round(value)}<small> / {target}{unit}</small></strong></div><div style={{['--bar' as string]:tone}}><AnimatedProgress value={pct(value,target)}/></div></div>;
}

export function NutritionPlanner({s,today,dates}:{s:Snapshot;today:string;dates:string[]}){
 const client=useQueryClient();const target=nutritionTarget(s);const day=dayNutrition(s,today);
 const [query,setQuery]=useState(''),[group,setGroup]=useState('All'),[basket,setBasket]=useState<Item[]>([]),[slot,setSlot]=useState<typeof slots[number]>(slotNow()),[date,setDate]=useState(today),[name,setName]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[setup,setSetup]=useState(false);
 const results=useMemo(()=>searchFoods(query,40).filter(f=>group==='All'||f.group===group).slice(0,10),[query,group]);
 const totals=sumItems(basket);
 const add=(food:Food)=>{setBasket(b=>b.some(i=>i.food.name===food.name)?b:[...b,{food,grams:food.serving}]);setMessage('');};
 async function log(){
  if(!basket.length)return;setBusy(true);setMessage('');
  try{
   const parts=basket.map(i=>portion(i.food,i.grams));const title=(name.trim()||(basket.length===1?basket[0].food.name:`${basket[0].food.name} + ${basket.length-1} more`)).slice(0,160);
   const data=schemas.meal.parse({title,date,slot,notes:'',servings:1,eaten:true,foods:parts,ingredients:basket.map(i=>i.food.name).join(', ').slice(0,1000),nutrition:{calories:totals.calories,protein:Math.round(totals.protein),carbs:Math.round(totals.carbs),fat:Math.round(totals.fat)}});
   await adapter.save({kind:'meal',data});await client.invalidateQueries({queryKey:['snapshot']});
   setBasket([]);setName('');setMessage(`${title} logged: ${totals.calories} kcal.`);
  }catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 const week=weekNutrition(s,dates).map(d=>({...d,label:new Date(`${d.date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short'})}));
 const remaining=target?Math.max(0,target.data.calories-day.eaten.calories):null;
 return <Entrance className="panel nutrition-planner">
  <div className="panel-heading"><div><span className="eyebrow">NUTRITION</span><h2>Eat to your target</h2><p>Log foods, see calories and macros for the day, and plan against your own goal. Values are approximate.</p></div><div className="inline-actions"><Button onClick={()=>setSetup(true)}><Target size={15}/>{target?'Edit target':'Set daily target'}</Button></div></div>
  <div className="np-grid">
   <section className="np-today" aria-label="Today's nutrition">
    <div className="np-kcal"><Flame size={18}/><div><small>Today, eaten</small><strong>{Math.round(day.eaten.calories)} <span>kcal</span></strong></div>{remaining!==null&&<em>{remaining} left</em>}</div>
    {target?<><Bar1 label="Calories" value={day.eaten.calories} target={target.data.calories} unit=" kcal" tone="#b6f26b"/><Bar1 label="Protein" value={day.eaten.protein} target={target.data.protein} unit="g" tone="#4cc3ff"/><Bar1 label="Carbs" value={day.eaten.carbs} target={target.data.carbs} unit="g" tone="#f5b94a"/><Bar1 label="Fat" value={day.eaten.fat} target={target.data.fat} unit="g" tone="#ff9b7a"/>
     {day.planned.calories>0&&<p className="muted np-note">Plus {Math.round(day.planned.calories)} kcal planned but not ticked as eaten yet.</p>}</>
     :<div className="np-empty"><p>Set a daily target to see progress bars for calories, protein, carbs and fat.</p><Button variant="primary" onClick={()=>setSetup(true)}>Set daily target</Button></div>}
   </section>
   <section className="np-log" aria-label="Log food">
    <label className="np-search"><Search size={16}/><input aria-label="Search foods" placeholder="Search foods: roti, daal, chicken, banana…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button type="button" aria-label="Clear food search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>
    <div className="np-chips" role="group" aria-label="Food groups">{['All',...foodGroups].map(g=><button key={g} className={group===g?'selected':''} aria-pressed={group===g} onClick={()=>setGroup(g)}>{g}</button>)}</div>
    <ul className="np-results">{results.map(f=><li key={f.name}><button onClick={()=>add(f)} aria-label={`Add ${f.name}`}><span><strong>{f.name}</strong><small>{f.calories} kcal per 100 g{f.unit?` · ${f.unit} ≈ ${f.serving} g`:''}</small></span><Plus size={16}/></button></li>)}{!results.length&&<li className="muted">No food found. Try another name or group.</li>}</ul>
    {basket.length>0&&<div className="np-basket"><h3>Your meal</h3>
     {basket.map(i=>{const p=portion(i.food,i.grams);return <div className="np-item" key={i.food.name}><span>{i.food.name}<small>{p.calories} kcal · P {p.protein} C {p.carbs} F {p.fat}</small></span><label><input type="number" min={1} max={5000} aria-label={`Grams of ${i.food.name}`} value={i.grams} onChange={e=>setBasket(b=>b.map(x=>x.food.name===i.food.name?{...x,grams:Math.max(0,Number(e.target.value)||0)}:x))}/><small>g</small></label><button className="icon-button" aria-label={`Remove ${i.food.name}`} onClick={()=>setBasket(b=>b.filter(x=>x.food.name!==i.food.name))}><Trash2 size={14}/></button></div>;})}
     <div className="np-total"><strong>{totals.calories} kcal</strong><span>Protein {Math.round(totals.protein)}g · Carbs {Math.round(totals.carbs)}g · Fat {Math.round(totals.fat)}g</span></div>
     <div className="np-save"><input aria-label="Meal name" placeholder="Meal name (optional)" value={name} onChange={e=>setName(e.target.value)} maxLength={80}/><select aria-label="Meal slot" value={slot} onChange={e=>setSlot(e.target.value as typeof slots[number])}>{slots.map(x=><option key={x}>{x}</option>)}</select><input type="date" aria-label="Meal date" value={date} onChange={e=>setDate(e.target.value||today)}/><Button variant="primary" onClick={()=>void log()} disabled={busy} loading={busy}><Apple size={15}/>Log as eaten</Button></div>
    </div>}
    {message&&<p role="status" className="np-message">{message}</p>}
   </section>
  </div>
  <div className="np-week"><h3>This week, calories eaten</h3><div className="np-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={week} margin={{left:-18,right:6,top:8}}><CartesianGrid vertical={false} stroke="#282828" strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false}/><YAxis tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false}/><Tooltip cursor={{fill:'#ffffff06'}} content={({active,payload})=>active&&payload?.length?<div className="dark-tooltip"><strong>{String(payload[0].payload.date)}</strong><div><span>Calories</span><b>{Math.round(Number(payload[0].value))} kcal</b></div></div>:null}/>{target&&<ReferenceLine y={target.data.calories} stroke="#b6f26b" strokeDasharray="4 4"/>}<Bar dataKey="calories" fill="#80e4bd" radius={[6,6,0,0]} maxBarSize={34} animationDuration={500}/></BarChart></ResponsiveContainer></div></div>
  <TargetDialog s={s} open={setup} onOpenChange={setSetup}/>
 </Entrance>;
}

function TargetDialog({s,open,onOpenChange}:{s:Snapshot;open:boolean;onOpenChange:(v:boolean)=>void}){
 const client=useQueryClient();const current=nutritionTarget(s);
 const [p,setP]=useState<Profile>({sex:'female',age:28,heightCm:165,weightKg:65,activity:'light',goal:current?.data.goal||'maintain'});
 const [t,setT]=useState<Macros>(()=>current?{calories:current.data.calories,protein:current.data.protein,carbs:current.data.carbs,fat:current.data.fat}:suggestTarget({sex:'female',age:28,heightCm:165,weightKg:65,activity:'light',goal:'maintain'}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=(next:Profile)=>{setP(next);setT(suggestTarget(next));};
 const num=(v:string,min:number,max:number,fallback:number)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
 async function save(){
  setBusy(true);setError('');
  try{
   const data=schemas.nutritionTarget.parse({title:'Daily nutrition target',calories:Math.round(t.calories),protein:Math.round(t.protein),carbs:Math.round(t.carbs),fat:Math.round(t.fat),goal:p.goal});
   await adapter.save({kind:'nutritionTarget',data,...(current?{id:current.id,version:current.version}:{})});await client.invalidateQueries({queryKey:['snapshot']});onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}} title="Your daily target" description="Answer a few questions for a starting estimate, then adjust the numbers. This is a planning aid, not medical advice.">
  <div className="np-form">
   <label><span>Sex</span><select value={p.sex} onChange={e=>update({...p,sex:e.target.value as Profile['sex']})}><option value="female">Female</option><option value="male">Male</option></select></label>
   <label><span>Age</span><input type="number" value={p.age} min={14} max={90} onChange={e=>update({...p,age:num(e.target.value,14,90,p.age)})}/></label>
   <label><span>Height (cm)</span><input type="number" value={p.heightCm} min={120} max={230} onChange={e=>update({...p,heightCm:num(e.target.value,120,230,p.heightCm)})}/></label>
   <label><span>Weight (kg)</span><input type="number" value={p.weightKg} min={30} max={250} onChange={e=>update({...p,weightKg:num(e.target.value,30,250,p.weightKg)})}/></label>
   <label><span>Activity</span><select value={p.activity} onChange={e=>update({...p,activity:e.target.value as Profile['activity']})}><option value="low">Mostly sitting</option><option value="light">Light, 1 to 3 workouts a week</option><option value="moderate">Moderate, 3 to 5 workouts</option><option value="high">High, 6 to 7 workouts</option></select></label>
   <label><span>Goal</span><select value={p.goal} onChange={e=>update({...p,goal:e.target.value as Profile['goal']})}><option value="lose">Lose weight slowly</option><option value="maintain">Maintain weight</option><option value="gain">Build muscle</option></select></label>
  </div>
  <div className="np-form np-macros">
   <label><span>Calories (kcal)</span><input aria-label="Calories target" type="number" value={t.calories} onChange={e=>setT({...t,calories:num(e.target.value,800,10000,t.calories)})}/></label>
   <label><span>Protein (g)</span><input aria-label="Protein target" type="number" value={t.protein} onChange={e=>setT({...t,protein:num(e.target.value,0,600,t.protein)})}/></label>
   <label><span>Carbs (g)</span><input aria-label="Carbs target" type="number" value={t.carbs} onChange={e=>setT({...t,carbs:num(e.target.value,0,1200,t.carbs)})}/></label>
   <label><span>Fat (g)</span><input aria-label="Fat target" type="number" value={t.fat} onChange={e=>setT({...t,fat:num(e.target.value,0,500,t.fat)})}/></label>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="dialog-actions"><Button onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void save()} disabled={busy} loading={busy}>Save target</Button></div>
 </Dialog>;
}
export const foodCount=foods.length;
