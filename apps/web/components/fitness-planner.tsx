'use client';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarPlus,Dumbbell,Flame,Plus,Scale,Trash2,Trophy} from 'lucide-react';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {schemas,type LedgerRecord,type Snapshot,dateLocale,formatDate,formatWeight,kgToDisplay,displayToKg,weightUnit} from '@ledger/shared';
import {adapter} from '../lib/data';
import {exerciseNames,personalRecords,programs,scheduleProgram,weekSummary,weightTrend,workoutVolume,type Exercise} from '../lib/fitness';
import {Entrance} from './animation';
import {Button} from './ui/button';
import {Dialog} from './ui/dialog';
import {PremiumFeature} from './plan-options';

const blank=():Exercise=>({name:'',sets:[{reps:8,weight:0}]});
const kg=(n:number)=>formatWeight(n);

export function FitnessPlanner({s,today,onRemove,part}:{s:Snapshot;today:string;onRemove:(r:LedgerRecord)=>void;part:'train'|'progress'}){
 const client=useQueryClient();const week=weekSummary(s,today);const records=personalRecords(s);const trend=weightTrend(s);
 const [logOpen,setLogOpen]=useState(false),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 const [weight,setWeight]=useState(''),[fat,setFat]=useState(''),[metricDate,setMetricDate]=useState(today);
 async function schedule(id:string){
  const program=programs.find(p=>p.id===id)!;setBusy(id);setMessage('');
  try{for(const day of scheduleProgram(program,today))await adapter.save({kind:'workout',data:schemas.workout.parse({title:day.title,date:day.date,type:day.type,duration:day.duration,notes:`Part of ${program.name}.`,done:false,exercises:day.exercises,program:program.name})});
   await client.invalidateQueries({queryKey:['snapshot']});setMessage(`${program.name} scheduled: ${program.days.length} sessions, with rest days between.`);
  }catch(e){setMessage((e as Error).message);}finally{setBusy('');}
 }
 async function addMetric(){
  setBusy('metric');setMessage('');
  try{const data=schemas.bodyMetric.parse({title:'Body check-in',date:metricDate,weight:displayToKg(Number(weight)),...(fat?{bodyFat:Number(fat)}:{}),notes:''});
   await adapter.save({kind:'bodyMetric',data});await client.invalidateQueries({queryKey:['snapshot']});setWeight('');setFat('');setMessage('Check-in saved.');
  }catch(e){setMessage(e instanceof Error&&e.message.includes('weight')?`Enter a weight between ${kgToDisplay(20,0)} and ${kgToDisplay(500,0)} ${weightUnit()}.`:(e as Error).message);}finally{setBusy('');}
 }
 const chart=trend.rows.map(r=>({date:r.data.date,label:new Date(`${r.data.date}T12:00:00Z`).toLocaleDateString(dateLocale(),{month:'short',day:'numeric'}),weight:kgToDisplay(r.data.weight)}));
 return <div className="fitness-planner">
  {part==='train'&&<><Entrance className="panel fp-stats"><div className="panel-heading"><div><span className="eyebrow">THIS WEEK</span><h2>Your training at a glance</h2><p>The last 7 days of completed sessions.</p></div><Button variant="primary" onClick={()=>setLogOpen(true)}><Plus size={16}/>Log a session with sets</Button></div>
   <div className="fp-stat-grid"><div><Flame size={16}/><small>Sessions</small><strong>{week.sessions}</strong></div><div><Dumbbell size={16}/><small>Minutes</small><strong>{week.minutes}</strong></div><div><Trophy size={16}/><small>Volume lifted</small><strong>{week.volume?kg(week.volume):'—'}</strong></div></div>
  </Entrance>
  <PremiumFeature s={s} title="Training programs">
   <Entrance className="panel fp-programs"><div className="panel-heading"><div><span className="eyebrow">PROGRAMS</span><h2>Start a plan in one tap</h2><p>Pick a program and its sessions are added to your checklist with the exercises, sets and reps filled in.</p></div><CalendarPlus size={22}/></div>
    <div className="fp-program-grid">{programs.map(p=><article key={p.id}><span className="tag">{p.level}</span><h3>{p.name}</h3><p>{p.blurb}</p><small>{p.days.length} sessions · {p.days.map(d=>d.title).join(', ')}</small><Button onClick={()=>void schedule(p.id)} disabled={!!busy} loading={busy===p.id}>Schedule from tomorrow</Button></article>)}</div></Entrance>
  </PremiumFeature></>}
  {part==='progress'&&<PremiumFeature s={s} title="Personal records">
   <Entrance className="panel fp-records"><div className="panel-heading"><div><span className="eyebrow">PERSONAL RECORDS</span><h2>Your best lifts</h2><p>Estimated one-rep max from your completed sessions.</p></div><Trophy size={22}/></div>
    {records.length?<div className="table-scroll"><table><thead><tr><th>Exercise</th><th>Best set</th><th>Est. 1RM</th><th>Date</th></tr></thead><tbody>{records.slice(0,8).map(r=><tr key={r.name}><td>{r.name}</td><td>{kgToDisplay(r.weight)} {weightUnit()} × {r.reps}</td><td><strong>{kgToDisplay(r.e1rm)} {weightUnit()}</strong></td><td>{formatDate(r.date)}</td></tr>)}</tbody></table></div>:<p className="muted">Log a completed session with weights and your best lifts appear here.</p>}</Entrance>
  </PremiumFeature>}
  {part==='progress'&&<Entrance className="panel fp-body"><div className="panel-heading"><div><span className="eyebrow">BODY PROGRESS</span><h2>Weight and measurements</h2><p>{trend.latest!==null?`Latest ${formatWeight(trend.latest,1)}${trend.change!==null?` · ${trend.change>0?'+':''}${kgToDisplay(trend.change)} ${weightUnit()} since your first check-in`:''}`:'Add a check-in to start your trend line.'}</p></div><Scale size={22}/></div>
   <form className="fp-metric-form" onSubmit={e=>{e.preventDefault();void addMetric();}}><label><span>Weight ({weightUnit()})</span><input type="number" step="0.1" min={kgToDisplay(20,0)} max={kgToDisplay(500,0)} inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} required/></label><label><span>Body fat % (optional)</span><input type="number" step="0.1" min={2} max={80} inputMode="decimal" value={fat} onChange={e=>setFat(e.target.value)}/></label><label><span>Date</span><input type="date" max={today} value={metricDate} onChange={e=>setMetricDate(e.target.value||today)}/></label><Button type="submit" variant="primary" disabled={!!busy||!weight} loading={busy==='metric'}>Save check-in</Button></form>
   {chart.length>1?<div className="fp-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{left:-14,right:8,top:8}}><CartesianGrid vertical={false} stroke="#282828" strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false}/><YAxis domain={['dataMin - 1','dataMax + 1']} tick={{fill:'#999',fontSize:11}} tickLine={false} axisLine={false} unit={weightUnit()}/><Tooltip content={({active,payload})=>active&&payload?.length?<div className="dark-tooltip"><strong>{String(payload[0].payload.date)}</strong><div><span>Weight</span><b>{Number(payload[0].value)} {weightUnit()}</b></div></div>:null}/><Line type="monotone" dataKey="weight" stroke="#80e4bd" strokeWidth={2.5} dot={{r:3}} animationDuration={600}/></LineChart></ResponsiveContainer></div>:<p className="muted">Two or more check-ins draw your trend.</p>}
   {trend.rows.length>0&&<ul className="fp-metric-list">{trend.rows.slice().reverse().slice(0,5).map(r=><li key={r.id}><span>{formatDate(r.data.date)}</span><strong>{formatWeight(r.data.weight,1)}</strong>{r.data.bodyFat?<small>{r.data.bodyFat}% fat</small>:<small/>}<button className="icon-button" aria-label={`Delete check-in ${r.data.date}`} onClick={()=>onRemove(r)}><Trash2 size={14}/></button></li>)}</ul>}
  </Entrance>}
  {message&&<p role="status" className="np-message">{message}</p>}
  <SessionDialog s={s} today={today} open={logOpen} onOpenChange={setLogOpen}/>
 </div>;
}

function SessionDialog({s,today,open,onOpenChange}:{s:Snapshot;today:string;open:boolean;onOpenChange:(v:boolean)=>void}){
 const client=useQueryClient();
 const [title,setTitle]=useState('Strength session'),[date,setDate]=useState(today),[duration,setDuration]=useState(45),[exercises,setExercises]=useState<Exercise[]>([blank()]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const last=(name:string)=>{const done=s.records.filter(r=>r.kind==='workout').flatMap(r=>(r as LedgerRecord<'workout'>).data.exercises||[]).filter(e=>e.name===name);return done.at(-1)?.sets.at(-1);};
 const patch=(i:number,fn:(e:Exercise)=>Exercise)=>setExercises(list=>list.map((e,n)=>n===i?fn(e):e));
 const volume=exercises.reduce((n,e)=>n+e.sets.reduce((m,x)=>m+x.reps*x.weight,0),0);
 async function save(){
  setBusy(true);setError('');
  try{
   const clean=exercises.filter(e=>e.name.trim()).map(e=>({name:e.name.trim(),sets:e.sets.filter(x=>x.reps>0)}));
   const data=schemas.workout.parse({title,date,type:'Strength',duration,notes:'',done:date<=today,...(clean.length?{exercises:clean}:{})});
   await adapter.save({kind:'workout',data});await client.invalidateQueries({queryKey:['snapshot']});
   setExercises([blank()]);onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Dialog variant="drawer" open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}} title="Log a session" description="Add each exercise with its sets, reps and weight. Volume and personal records are worked out for you.">
  <div className="fp-form">
   <label className="wide"><span>Session name</span><input value={title} maxLength={80} onChange={e=>setTitle(e.target.value)}/></label>
   <label><span>Date</span><input type="date" value={date} onChange={e=>setDate(e.target.value||today)}/></label>
   <label><span>Minutes</span><input type="number" min={1} max={600} value={duration} onChange={e=>setDuration(Math.max(1,Number(e.target.value)||1))}/></label>
  </div>
  <datalist id="exercise-names">{exerciseNames.map(n=><option key={n} value={n}/>)}</datalist>
  <div className="fp-exercises">{exercises.map((e,i)=><div className="fp-exercise" key={i}>
   <div className="fp-exercise-head"><input list="exercise-names" aria-label={`Exercise ${i+1} name`} placeholder="Exercise, for example Squat" value={e.name} onChange={ev=>patch(i,x=>({...x,name:ev.target.value}))} maxLength={80}/><button className="icon-button" aria-label={`Remove exercise ${i+1}`} onClick={()=>setExercises(l=>l.length>1?l.filter((_,n)=>n!==i):l)}><Trash2 size={14}/></button></div>
   {e.sets.map((set,n)=><div className="fp-set" key={n}><span>Set {n+1}</span><label><input type="number" min={0} max={1000} aria-label={`Exercise ${i+1} set ${n+1} reps`} value={set.reps} onChange={ev=>patch(i,x=>({...x,sets:x.sets.map((y,m)=>m===n?{...y,reps:Math.max(0,Math.floor(Number(ev.target.value)||0))}:y)}))}/><small>reps</small></label><label><input type="number" min={0} max={2000} step="0.5" aria-label={`Exercise ${i+1} set ${n+1} weight`} value={kgToDisplay(set.weight)} onChange={ev=>patch(i,x=>({...x,sets:x.sets.map((y,m)=>m===n?{...y,weight:Math.max(0,displayToKg(Number(ev.target.value)||0))}:y)}))}/><small>{weightUnit()}</small></label><button className="icon-button" aria-label={`Remove set ${n+1} of exercise ${i+1}`} onClick={()=>patch(i,x=>({...x,sets:x.sets.length>1?x.sets.filter((_,m)=>m!==n):x.sets}))}><Trash2 size={13}/></button></div>)}
   <div className="fp-exercise-foot"><button type="button" className="plain-button" onClick={()=>patch(i,x=>{const prev=x.sets.at(-1)||last(x.name)||{reps:8,weight:0};return {...x,sets:[...x.sets,{reps:prev.reps,weight:prev.weight}]};})}><Plus size={13}/> Add set</button>{e.name&&last(e.name)&&<small>Last time: {last(e.name)!.reps} × {last(e.name)!.weight} kg</small>}</div>
  </div>)}</div>
  <button type="button" className="plain-button fp-add-exercise" onClick={()=>setExercises(l=>[...l,blank()])}><Plus size={14}/> Add exercise</button>
  <p className="muted fp-volume">Total volume: <strong>{kg(volume)}</strong>{date>today?' · dated in the future, so it is saved as planned':''}</p>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="dialog-actions"><Button onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void save()} disabled={busy||!title.trim()} loading={busy}>Save session</Button></div>
 </Dialog>;
}
export const volumeOf=workoutVolume;
