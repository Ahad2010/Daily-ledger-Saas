'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight,Dumbbell,Flame,ListChecks,Lock,PencilRuler,Scale,Wallet} from 'lucide-react';
import {recordsOf,schemas,kgToDisplay,displayToKg,weightUnit,type Snapshot} from '@ledger/shared';
import {adapter} from '../lib/data';
import {goalTypes,type GoalType,type GoalTypeId} from '../lib/goal-types';
import {exerciseNames} from '../lib/fitness';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';

const icons:Record<GoalTypeId,React.ReactNode>={money:<Wallet/>,weight:<Scale/>,workouts:<Dumbbell/>,lift:<Dumbbell/>,habit:<Flame/>,project:<ListChecks/>,custom:<PencilRuler/>};
const addDays=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);

// Step one: choose what kind of goal this is. Types that follow other parts of the app are Pro; free accounts see why and where to upgrade.
export function GoalTypePicker({s,onChoose}:{s:Snapshot;onChoose:(t:GoalType)=>void}){
 const pro=s.profile.plan!=='Free';
 return <div className="goal-types">{goalTypes.map(t=>{const locked=t.pro&&!pro;const body=<><span className="goal-type-icon">{icons[t.id]}</span><span className="goal-type-text"><strong>{t.label}{t.pro&&<em className="pro-chip">{locked?<><Lock size={10}/> Pro</>:'Auto'}</em>}</strong><small>{t.blurb}</small></span><ArrowRight size={16}/></>;
  return locked?<Link key={t.id} className="goal-type locked" href="/plans" aria-label={`${t.label}, Pro. See plans`}>{body}</Link>:<button key={t.id} className="goal-type" onClick={()=>onChoose(t)}>{body}</button>;})}</div>;
}

// Step two: only the questions this type needs. The goal is saved with its automatic source so progress follows the data.
export function GoalSetupDialog({s,today,type,emergency,onOpenChange}:{s:Snapshot;today:string;type:GoalType;emergency:number;onOpenChange:(v:boolean)=>void}){
 const client=useQueryClient();const pro=s.profile.plan!=='Free';const currency=s.profile.currency;
 const habits=recordsOf(s.records,'habit').filter(h=>h.data.active);
 const lastWeight=recordsOf(s.records,'bodyMetric').slice().sort((a,b)=>a.data.date.localeCompare(b.data.date)).at(-1)?.data.weight;
 const lifts=[...new Set([...exerciseNames,...recordsOf(s.records,'workout').flatMap(w=>(w.data.exercises||[]).map(e=>e.name))])];
 const defaults:Record<GoalTypeId,{title:string;target:number;days:number}>={money:{title:'Save for something important',target:1000,days:90},weight:{title:'Reach my weight goal',target:5,days:90},workouts:{title:'Train 12 times',target:12,days:42},lift:{title:'Lift 100 kg',target:100,days:90},habit:{title:'Keep my habit for 30 days',target:30,days:45},project:{title:'Finish my project',target:100,days:30},custom:{title:'My goal',target:100,days:60}};
 const d=defaults[type.id];
 const [title,setTitle]=useState(d.title),[target,setTarget]=useState(String(d.target)),[deadline,setDeadline]=useState(addDays(today,d.days)),[unit,setUnit]=useState(type.id==='money'?currency:type.id==='custom'?'units':type.id==='weight'||type.id==='lift'?'kg':type.id==='workouts'?'sessions':'days');
 const [category,setCategory]=useState('Savings'),[follow,setFollow]=useState(false),[habitId,setHabitId]=useState(habits[0]?.id||''),[exercise,setExercise]=useState('Squat'),[startWeight,setStartWeight]=useState(lastWeight?String(kgToDisplay(lastWeight)):''),[goalWeight,setGoalWeight]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){
  setBusy(true);setError('');
  try{
   const base={title:title.trim(),description:'',active:true,startDate:today,deadline,current:0,tracking:'manual' as const};
   let data:Record<string,unknown>;
   if(type.id==='weight'){const from=displayToKg(Number(startWeight)),to=displayToKg(Number(goalWeight));if(!from||!to||from===to)throw new Error('Enter your current weight and a different goal weight.');data={...base,title:title.trim()||`Reach ${to} kg`,target:Math.round(Math.abs(from-to)*10)/10,unit:'kg',autoSource:{type:'weight',ref:to<from?'lose':'gain',baseline:from}};}
   else if(type.id==='workouts')data={...base,target:Number(target),unit:'sessions',autoSource:{type:'workouts'}};
   else if(type.id==='lift')data={...base,target:displayToKg(Number(target)),unit:'kg',autoSource:{type:'lift',ref:exercise.trim()}};
   else if(type.id==='habit'){if(!habitId)throw new Error('Create a habit first, then link a goal to it.');data={...base,target:Number(target),unit:'days',autoSource:{type:'habit',ref:habitId}};}
   else if(type.id==='money')data={...base,target:Number(target),unit:unit||currency,...(follow&&pro&&category.trim()?{autoSource:{type:'savings',ref:category.trim()}}:{})};
   else data={...base,target:Number(target),unit:unit.trim()||'units'};
   await adapter.save({kind:'goal',data:schemas.goal.parse(data)});await client.invalidateQueries({queryKey:['snapshot']});onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Dialog variant="drawer" open onOpenChange={v=>{if(!busy)onOpenChange(v);}} title={type.label} description={type.blurb}>
  <div className="goal-setup">
   <label><span>Goal name</span><input value={title} maxLength={120} onChange={e=>setTitle(e.target.value)}/></label>
   {type.id==='weight'&&<div className="goal-setup-row"><label><span>Current weight ({weightUnit()})</span><input type="number" step="0.1" inputMode="decimal" value={startWeight} onChange={e=>setStartWeight(e.target.value)}/></label><label><span>Goal weight ({weightUnit()})</span><input type="number" step="0.1" inputMode="decimal" value={goalWeight} onChange={e=>setGoalWeight(e.target.value)}/></label></div>}
   {type.id==='lift'&&<label><span>Exercise</span><input list="goal-lifts" value={exercise} maxLength={80} onChange={e=>setExercise(e.target.value)}/><datalist id="goal-lifts">{lifts.map(l=><option key={l} value={l}/>)}</datalist></label>}
   {type.id==='habit'&&<label><span>Habit</span><select value={habitId} onChange={e=>setHabitId(e.target.value)}>{habits.length?habits.map(h=><option key={h.id} value={h.id}>{h.data.title}</option>):<option value="">No active habits yet</option>}</select></label>}
   {type.id!=='weight'&&<div className="goal-setup-row"><label><span>{type.id==='workouts'?'Sessions to complete':type.id==='habit'?'Days to complete':type.id==='lift'?`Target weight (${weightUnit()})`:'Target amount'}</span><input type="number" min={1} inputMode="decimal" value={target} onChange={e=>setTarget(e.target.value)}/></label>{(type.id==='money'||type.id==='custom')&&<label><span>Unit</span><input value={unit} maxLength={30} onChange={e=>setUnit(e.target.value)}/></label>}</div>}
   <label><span>Target date</span><input type="date" min={today} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
   {type.id==='money'&&<>{emergency>0&&<button type="button" className="goal-chip" onClick={()=>{setTitle('Emergency fund');setTarget(String(emergency));}}>Use emergency fund: {emergency.toLocaleString()} {currency} (3 months of your spending)</button>}
    {pro?<label className="goal-follow"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/><span>Follow a Finance category automatically</span></label>:<p className="muted goal-note">Pro can fill this goal from a Finance category such as Savings. <Link href="/plans">See Pro</Link></p>}
    {follow&&pro&&<label><span>Finance category</span><input value={category} maxLength={80} onChange={e=>setCategory(e.target.value)}/><small className="muted">Transfers and income in this category count as progress.</small></label>}</>}
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="dialog-actions"><Button onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void save()} disabled={busy||!title.trim()} loading={busy}>Create goal</Button></div>
 </Dialog>;
}
