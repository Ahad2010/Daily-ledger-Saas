'use client';
import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {AlertCircle,CheckCircle2,Flame,ListChecks,Plus,Target,Undo2} from 'lucide-react';
import {habitStreak,localDate,recordsOf,schemas,type LedgerRecord,type Snapshot,dateLocale} from '@ledger/shared';
import {adapter} from '../lib/data';
import {Entrance,AnimatedProgress,CountUp} from './animation';
import {HabitToggle} from './habit-checklist';
import {Button} from './ui/button';
import {Select} from './ui/select';

const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const rank={high:0,medium:1,low:2} as const;

// The first thing on Tasks & Habits: what is due, what is slipping, and one tap to add or tick something off.
export function TasksFocus({s,today,tools,completeHabit,pending,onTab}:{s:Snapshot;today:string;tools:{toggle:(r:LedgerRecord)=>void;edit:(r:LedgerRecord)=>void;add:(kind:'task'|'habit')=>void};completeHabit:(h:LedgerRecord<'habit'>,date:string)=>void;pending:boolean;onTab:(tab:'tasks'|'habits')=>void}){
 const client=useQueryClient(),tz=s.profile.timezone;
 const [title,setTitle]=useState(''),[priority,setPriority]=useState<'low'|'medium'|'high'>('medium'),[when,setWhen]=useState<'today'|'tomorrow'|'week'>('today'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const tasks=recordsOf(s.records,'task'),open=tasks.filter(t=>!t.data.done);
 const dueDay=(t:LedgerRecord<'task'>)=>localDate(t.data.due,tz);
 const overdue=open.filter(t=>dueDay(t)<today),dueToday=open.filter(t=>dueDay(t)===today);
 const focus=[...overdue,...dueToday].sort((a,b)=>rank[a.data.priority]-rank[b.data.priority]||a.data.due.localeCompare(b.data.due)).slice(0,8);
 const weekStart=shift(today,-6);
 const doneWeek=tasks.filter(t=>t.data.done&&t.data.completedAt&&localDate(t.data.completedAt,tz)>=weekStart&&localDate(t.data.completedAt,tz)<=today).length;
 const dueWeek=open.filter(t=>dueDay(t)>=today&&dueDay(t)<=shift(today,6)).length;
 const habits=recordsOf(s.records,'habit').filter(h=>h.data.active),done=new Set(recordsOf(s.records,'completion').map(c=>`${c.data.habitId}:${c.data.date}`));
 const dow=new Date(`${today}T12:00:00Z`).getUTCDay();
 const habitsToday=habits.filter(h=>h.data.startDate<=today&&h.data.days.includes(dow));
 const habitsDone=habitsToday.filter(h=>done.has(`${h.id}:${today}`)).length;
 const best=habits.reduce((n,h)=>Math.max(n,habitStreak(h,s.records,today)),0);
 const total=doneWeek+dueWeek+overdue.length+dueToday.length;
 const score=total?Math.round(doneWeek/total*100):0;
 const [leaving,setLeaving]=useState<string[]>([]),[toast,setToast]=useState<{id:string;title:string}|null>(null);
 const latest=useRef(s);latest.current=s;const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 function finish(t:LedgerRecord<'task'>){setLeaving(l=>[...l,t.id]);setTimeout(()=>{tools.toggle(t);setLeaving(l=>l.filter(x=>x!==t.id));},240);setToast({id:t.id,title:t.data.title});clearTimeout(timer.current);timer.current=setTimeout(()=>setToast(null),5000);}
 function undo(){if(!toast)return;const r=recordsOf(latest.current.records,'task').find(x=>x.id===toast.id);if(r?.data.done)tools.toggle(r);setToast(null);}
 async function add(e:{preventDefault:()=>void}){
  e.preventDefault();const text=title.trim();if(!text)return;setBusy(true);setError('');
  try{
   const day=when==='today'?today:when==='tomorrow'?shift(today,1):shift(today,7);
   await adapter.save({kind:'task',data:schemas.task.parse({title:text,description:'',due:`${day}T17:00:00.000Z`,priority,done:false,reminder:true,recurrence:'none'})});
   await client.invalidateQueries({queryKey:['snapshot']});setTitle('');
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 }
 const greeting=overdue.length?`${overdue.length} ${overdue.length===1?'task is':'tasks are'} behind. Start with one.`:dueToday.length||habitsToday.length-habitsDone?'A clear list for today. One step at a time.':'You are all caught up. Enjoy the quiet.';
 const stats=[
  {label:'Due today',value:dueToday.length,icon:<ListChecks size={16}/>,tone:''},
  {label:'Overdue',value:overdue.length,icon:<AlertCircle size={16}/>,tone:overdue.length?'warn':''},
  {label:'Done this week',value:doneWeek,icon:<CheckCircle2 size={16}/>,tone:'good'},
  {label:'Best streak',value:best,icon:<Flame size={16}/>,tone:'',suffix:best===1?' day':' days'}
 ];
 return <div className="tf-wrap">
  <Entrance className="panel tf-hero">
   <div className="tf-hero-head"><div><span className="eyebrow">TODAY'S FOCUS</span><h2>{greeting}</h2></div><div className="tf-score" aria-label={`Week score ${score} percent`}><strong><CountUp value={score} format={v=>`${v}%`}/></strong><small>of this week's tasks done</small></div></div>
   <AnimatedProgress value={score}/>
   <form className="tf-add" onSubmit={add} aria-label="Quick add task"><input aria-label="Quick add task title" placeholder="Add a task and press Enter…" maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/><Select label="Due" value={when} onChange={setWhen} options={[{value:'today',label:'Today',hint:'By tonight'},{value:'tomorrow',label:'Tomorrow',hint:'Plan ahead'},{value:'week',label:'Next week',hint:'In 7 days'}]}/><Select label="Priority" value={priority} onChange={setPriority} options={[{value:'high',label:'High',icon:<i className="pri-dot high"/>,hint:'Do this first'},{value:'medium',label:'Medium',icon:<i className="pri-dot medium"/>},{value:'low',label:'Low',icon:<i className="pri-dot low"/>,hint:'When there is time'}]}/><Button variant="primary" type="submit" disabled={busy||!title.trim()} loading={busy}><Plus size={15}/>Add</Button></form>
   {error&&<p className="error" role="alert">{error}</p>}
  </Entrance>
  <div className="tf-stats">{stats.map(x=><div key={x.label} className={`tf-stat ${x.tone}`}><span>{x.icon}{x.label}</span><strong><CountUp value={x.value} format={v=>`${v}${x.suffix||''}`}/></strong></div>)}</div>
  <div className="tf-columns">
   <Entrance className="panel tf-card">
    <div className="panel-heading"><div><h2>Needs your attention</h2><p>Overdue first, then what is due today.</p></div><button className="button" onClick={()=>onTab('tasks')}>All tasks</button></div>
    <div className="tf-list">{focus.map(t=><div key={t.id} className={`tf-row ${leaving.includes(t.id)?'leaving':''}`} data-record-id={`focus-${t.id}`} data-motion-state={String(t.version)}><input type="checkbox" checked={t.data.done||leaving.includes(t.id)} onChange={()=>finish(t)} aria-label={`Complete ${t.data.title}`}/><button className="tf-title" onClick={()=>tools.edit(t)}><strong>{t.data.title}</strong><small>{dueDay(t)<today?'Overdue · ':''}{new Date(t.data.due).toLocaleTimeString(dateLocale(),{timeZone:tz,hour:'numeric',minute:'2-digit'})}</small></button><span className={`tag priority-${t.data.priority}`}>{t.data.priority}</span></div>)}
    {!focus.length&&<p className="tf-empty"><CheckCircle2 size={18}/>Nothing is due. Add a task above or plan tomorrow.</p>}</div>
   </Entrance>
   <Entrance className="panel tf-card">
    <div className="panel-heading"><div><h2>Habits today</h2><p>{habitsToday.length?`${habitsDone} of ${habitsToday.length} done today`:'No habits scheduled today.'}</p></div><button className="button" onClick={()=>onTab('habits')}>Week view</button></div>
    <div className="tf-list">{habitsToday.map(h=>{const checked=done.has(`${h.id}:${today}`);return <div key={h.id} className={`tf-row ${checked?'checked':''}`} data-record-id={`focus-habit-${h.id}`}><HabitToggle checked={checked} disabled={pending||checked} onChange={()=>completeHabit(h,today)} label={`Complete habit ${h.data.title} today`}/><div className="tf-title static"><strong>{h.data.title}</strong><small><Flame size={11}/>{habitStreak(h,s.records,today)} day streak</small></div></div>;})}
    {!habitsToday.length&&<p className="tf-empty"><Target size={18}/>{habits.length?'Rest day. Your streaks are safe.':'Create a habit to start a streak.'}</p>}</div>
    {!habits.length&&<Button onClick={()=>tools.add('habit')}><Plus size={15}/>New habit</Button>}
   </Entrance>
  </div>
 {toast&&<div className="tf-toast" role="status"><CheckCircle2 size={18}/><span><strong>Completed</strong><small>{toast.title}</small></span><button onClick={undo}><Undo2 size={14}/>Undo</button></div>}
 </div>;
}
