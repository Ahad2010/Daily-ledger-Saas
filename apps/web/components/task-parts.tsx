'use client';
import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {CalendarClock,Clock3,Pencil,Plus,Trash2,X} from 'lucide-react';
import {localDate,schemas,type LedgerRecord,dateLocale} from '@ledger/shared';
import {adapter} from '../lib/data';
import {Dialog} from './ui/dialog';
import {Tick} from './today-view';
import {ClockFace} from './record-extras';

type Priority='low'|'medium'|'high';
type When='today'|'tomorrow'|'weekend'|'next';
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const clock=(d:Date)=>d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const priorityLabel:Record<Priority,string>={high:'High',medium:'Medium',low:'Low'};

export function PriorityChip({value}:{value:Priority}){return <span className={`prio-chip ${value}`}><i/>{priorityLabel[value]}</span>;}

// One task, drawn the same everywhere: a bright tick, a readable title, a clear time, and a way to say "not today".
export function TaskRow({t,tz,today,onToggle,onEdit,onTomorrow,onRemove,leaving=false}:{t:LedgerRecord<'task'>;tz:string;today:string;onToggle:()=>void;onEdit:()=>void;onTomorrow?:()=>void;onRemove?:()=>void;leaving?:boolean}){
 const day=localDate(t.data.due,tz),late=!t.data.done&&day<today;
 const when=day===today?'Today':day===shift(today,1)?'Tomorrow':new Date(`${day}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'});
 const time=new Date(t.data.due).toLocaleTimeString(dateLocale(),{timeZone:tz,hour:'numeric',minute:'2-digit'});
 return <div className={`task-row ${t.data.done?'is-done':''} ${late?'is-late':''} ${leaving?'leaving':''}`} data-priority={t.data.priority} data-record-id={`task-row-${t.id}`} data-motion-state={String(t.version)}>
  <Tick checked={t.data.done||leaving} label={`Complete ${t.data.title}`} onChange={onToggle}/>
  <button type="button" className="task-main" onClick={onEdit}><strong>{t.data.title}</strong><small><Clock3 size={13}/>{when} · {time}{late&&<b className="task-late">Overdue</b>}</small></button>
  <PriorityChip value={t.data.priority}/>
  <div className="task-actions">
   {!t.data.done&&onTomorrow&&<button type="button" className="task-x" aria-label={`Move ${t.data.title} to tomorrow`} title="Cannot do it today? Move to tomorrow" onClick={onTomorrow}><X size={17} strokeWidth={2.6}/></button>}
   <button type="button" className="icon-button" aria-label={`Edit ${t.data.title}`} onClick={onEdit}><Pencil size={15}/></button>
   {onRemove&&<button type="button" className="icon-button" aria-label={`Delete ${t.data.title}`} onClick={onRemove}><Trash2 size={15}/></button>}
  </div>
 </div>;
}

// Type it, choose when and how important, then a big clock asks for the time before it is added.
export function TaskComposer({today}:{today:string}){
 const client=useQueryClient(),input=useRef<HTMLInputElement>(null);
 const [title,setTitle]=useState(''),[when,setWhen]=useState<When>('today'),[priority,setPriority]=useState<Priority>('medium'),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[added,setAdded]=useState('');
 const [time,setTime]=useState(()=>{const n=new Date();n.setMinutes(0,0,0);n.setHours(Math.min(n.getHours()+1,22));return n;});
 const dow=new Date(`${today}T12:00:00Z`).getUTCDay();
 const day=when==='today'?today:when==='tomorrow'?shift(today,1):when==='weekend'?shift(today,(6-dow+7)%7||7):shift(today,(8-dow)%7||7);
 const whenLabel={today:'Today',tomorrow:'Tomorrow',weekend:'This weekend',next:'Next week'}[when];
 const start=()=>{if(!title.trim()){setError('Type what you need to do first.');input.current?.focus();return;}setError('');setOpen(true);};
 async function save(){
  setBusy(true);setError('');
  try{
   const [y,m,d]=day.split('-').map(Number);const due=new Date(y,m-1,d,time.getHours(),time.getMinutes()).toISOString();
   await adapter.save({kind:'task',data:schemas.task.parse({title:title.trim(),description:'',due,priority,done:false,reminder:true,recurrence:'none'})});
   await client.invalidateQueries({queryKey:['snapshot']});setAdded(title.trim());setTitle('');setOpen(false);setTimeout(()=>setAdded(''),3500);
  }catch(err){setError((err as Error).message);}finally{setBusy(false);}
 }
 return <div className="tc">
  <form className="tc-form" onSubmit={e=>{e.preventDefault();start();}} aria-label="Quick add task">
   <div className="tc-input"><input ref={input} aria-label="Quick add task title" placeholder="What do you need to do?" maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setError('');}}/><button type="submit" className="tc-add"><Plus size={18} strokeWidth={2.6}/>Add task</button></div>
   <div className="tc-opts">
    <div className="tc-group" role="radiogroup" aria-label="When">{([['today','Today'],['tomorrow','Tomorrow'],['weekend','Weekend'],['next','Next week']] as const).map(([id,label])=><button type="button" role="radio" aria-checked={when===id} key={id} className={when===id?'on':''} onClick={()=>setWhen(id)}>{label}</button>)}</div>
    <div className="tc-group" role="radiogroup" aria-label="Priority">{(['low','medium','high'] as const).map(p=><button type="button" role="radio" aria-checked={priority===p} key={p} className={`${priority===p?'on ':''}p-${p}`} onClick={()=>setPriority(p)}><i/>{priorityLabel[p]}</button>)}</div>
   </div>
   {error&&<p className="error tc-error" role="alert">{error}</p>}
   {added&&<p className="tc-added" role="status">Added “{added}”. Keep going.</p>}
  </form>
  <Dialog open={open} onOpenChange={o=>{if(!busy)setOpen(o);}} title="What time?" description="Turn the clock, then add your task.">
   <div className="tc-clock">
    <div className="tc-recap"><strong>{title.trim()||'Your task'}</strong><span>{whenLabel} · {clock(time)}</span><PriorityChip value={priority}/></div>
    <ClockFace date={time} onChange={setTime} big/>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="tc-foot"><button type="button" className="fs-ghost" onClick={()=>setOpen(false)}>Back</button><span className="fs-spacer"/><button type="button" className="fs-primary" disabled={busy} onClick={()=>void save()}>{busy?'Adding…':'Add task'}<CalendarClock size={16}/></button></div>
   </div>
  </Dialog>
 </div>;
}
