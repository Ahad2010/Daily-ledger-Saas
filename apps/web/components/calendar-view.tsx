'use client';
import {useMemo,useRef,useState,type DragEvent,type KeyboardEvent} from 'react';
import {useRouter} from 'next/navigation';
import {CalendarClock,CheckCircle2,ChevronLeft,ChevronRight,Dumbbell,Flame,Plus,Receipt,Target,Utensils,Wallet,X} from 'lucide-react';
import {calendarWeeks,localDate,money,monthDates,recordsOf,type Kind,type LedgerRecord,type Snapshot,dateLocale,getDisplay} from '@ledger/shared';
import {Entrance} from './animation';
import {Tick} from './today-view';

type Tools={add:(kind:Kind,initial?:Record<string,unknown>)=>void;edit:(r:LedgerRecord)=>void;toggle:(r:LedgerRecord,key?:string)=>void;move:(r:LedgerRecord,date:string)=>void};
type Type='task'|'habit'|'workout'|'meal'|'bill'|'goal'|'money';
type Item={id:string;type:Type;title:string;sub?:string;record?:LedgerRecord;done?:boolean};
const types:{id:Type;label:string;color:string}[]=[{id:'task',label:'Tasks',color:'#a894ff'},{id:'habit',label:'Habits',color:'#f6c453'},{id:'workout',label:'Workouts',color:'#80e4bd'},{id:'meal',label:'Meals',color:'#ff7eb6'},{id:'bill',label:'Bills',color:'#ff5d5d'},{id:'goal',label:'Goal dates',color:'#4cc3ff'},{id:'money',label:'Money',color:'#4ade80'}];
const colorOf=(t:Type)=>types.find(x=>x.id===t)!.color;
const movable=(i:Item)=>!!i.record&&['task','workout','meal','goal'].includes(i.type);
const shiftMonth=(month:string,by:number)=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+by,1)).toISOString().slice(0,7);};
const shiftDay=(date:string,by:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+by*864e5).toISOString().slice(0,10);
const localNine=(date:string)=>{const [y,m,d]=date.split('-').map(Number);return new Date(y,m-1,d,9,0).toISOString();};
const money0=(cents:number,currency:string)=>money(cents,currency);

// One calendar for the whole plan: tasks, habits, workouts, meals, bills, goal dates and money, with drag, pick-and-place and quick add.
export function CalendarView({s,today,tools,completeHabit}:{s:Snapshot;today:string;tools:Tools;completeHabit:(h:LedgerRecord<'habit'>,date:string)=>void}){
 const router=useRouter();const tz=s.profile.timezone,currency=s.profile.currency;
 const [month,setMonth]=useState(today.slice(0,7)),[selected,setSelected]=useState(today),[hidden,setHidden]=useState<Type[]>([]),[view,setView]=useState<'month'|'week'>('month');
 const [picked,setPicked]=useState<Item|null>(null),[over,setOver]=useState<string|null>(null),drag=useRef<Item|null>(null),gridRef=useRef<HTMLDivElement>(null);
 const weeks=calendarWeeks(month),days=monthDates(month);
 const shownWeeks=view==='week'?[weeks.find(w=>w.includes(selected))||weeks[0]]:weeks;
 const completions=useMemo(()=>new Set(recordsOf(s.records,'completion').map(c=>`${c.data.habitId}:${c.data.date}`)),[s.records]);
 const habitsOn=(date:string)=>{const wd=new Date(`${date}T12:00:00Z`).getUTCDay();return recordsOf(s.records,'habit').filter(h=>h.data.active&&h.data.startDate<=date&&h.data.days.includes(wd)).map(h=>({h,done:completions.has(`${h.id}:${date}`)}));};
 const txByDate=useMemo(()=>{const map=new Map<string,LedgerRecord<'transaction'>[]>();recordsOf(s.records,'transaction').filter(r=>r.data.currency===currency&&r.data.type!=='transfer').forEach(r=>{map.set(r.data.date,[...(map.get(r.data.date)||[]),r]);});return map;},[s.records,currency]);
 const byDate=useMemo(()=>{
  const map=new Map<string,Item[]>();const put=(date:string,item:Item)=>{if(!map.has(date))map.set(date,[]);map.get(date)!.push(item);};
  recordsOf(s.records,'task').forEach(t=>put(localDate(t.data.due,tz),{id:t.id,type:'task',title:t.data.title,sub:new Date(t.data.due).toLocaleTimeString(dateLocale(),{timeZone:tz,hour:'numeric',minute:'2-digit'}),record:t,done:t.data.done}));
  recordsOf(s.records,'workout').forEach(w=>put(w.data.date,{id:w.id,type:'workout',title:w.data.title,sub:`${w.data.duration} min`,record:w,done:!!w.data.done}));
  recordsOf(s.records,'meal').forEach(m=>put(m.data.date,{id:m.id,type:'meal',title:m.data.title,sub:m.data.slot,record:m,done:!!m.data.eaten}));
  recordsOf(s.records,'goal').filter(g=>g.data.active).forEach(g=>put(g.data.deadline,{id:g.id,type:'goal',title:g.data.title,sub:'Target date',record:g}));
  recordsOf(s.records,'cashPlan').filter(p=>p.data.active&&p.data.type==='expense').forEach(p=>{if(p.data.once){put(p.data.once,{id:p.id,type:'bill',title:p.data.title,sub:money(p.data.amount,p.data.currency),record:p});return;}for(const m of new Set(weeks.flat().map(d=>d.slice(0,7)))){const last=monthDates(m).length;put(`${m}-${String(Math.min(p.data.day,last)).padStart(2,'0')}`,{id:p.id,type:'bill',title:p.data.title,sub:money(p.data.amount,p.data.currency),record:p});}});
  return map;
 },[s.records,tz,month]);
 const visible=(date:string)=>{const base=(byDate.get(date)||[]).filter(i=>!hidden.includes(i.type)).sort((a,b)=>Number(!!a.done)-Number(!!b.done));if(hidden.includes('habit'))return base;const hb=habitsOn(date);return hb.length?[...base,{id:'habits-'+date,type:'habit' as Type,title:`${hb.filter(x=>x.done).length}/${hb.length} habits`,done:hb.every(x=>x.done)}]:base;};
 const spend=(date:string)=>{const tx=txByDate.get(date)||[];return {inc:tx.filter(r=>r.data.type==='income').reduce((n,r)=>n+r.data.amount,0),exp:tx.filter(r=>r.data.type==='expense').reduce((n,r)=>n+r.data.amount,0)};};
 const items=visible(selected),habitRows=hidden.includes('habit')?[]:habitsOn(selected),txRows=hidden.includes('money')?[]:(txByDate.get(selected)||[]);
 const baseRows=items.filter(i=>i.type!=='habit');
 const total=baseRows.filter(i=>i.type==='task'||i.type==='workout'||i.type==='meal').length+habitRows.length,doneN=baseRows.filter(i=>(i.type==='task'||i.type==='workout'||i.type==='meal')&&i.done).length+habitRows.filter(x=>x.done).length;
 // Month summary: how much of the month is planned and how much is done
 const stats=useMemo(()=>{let planned=0,all=0,done=0,workouts=0,spent=0;days.forEach(d=>{const it=(byDate.get(d)||[]).filter(i=>i.type==='task'||i.type==='workout'||i.type==='meal'||i.type==='goal'||i.type==='bill');if(it.length)planned++;it.filter(i=>i.type==='task'||i.type==='workout'||i.type==='meal').forEach(i=>{all++;if(i.done)done++;});workouts+=it.filter(i=>i.type==='workout').length;spent+=(txByDate.get(d)||[]).filter(r=>r.data.type==='expense').reduce((n,r)=>n+r.data.amount,0);});return {planned,all,done,workouts,spent};},[byDate,days,txByDate]);
 const overdue=useMemo(()=>{const out:Item[]=[];for(const [date,list] of byDate)if(date<today)list.filter(i=>(i.type==='task'||i.type==='workout')&&!i.done).forEach(i=>out.push(i));return out.sort((a,b)=>a.record!.kind.localeCompare(b.record!.kind)).slice(0,6);},[byDate,today]);
 const label=new Date(`${month}-01T12:00:00Z`).toLocaleDateString(dateLocale(),{month:'long',year:'numeric',timeZone:'UTC'});
 const open=(item:Item)=>{if(item.type==='bill')router.push('/finance/bills');else if(item.type==='goal')router.push(`/goals/${item.id}`);else if(item.type==='habit')setSelected(selected);else if(item.record)tools.edit(item.record);};
 const go=(by:number)=>{if(view==='week'){const next=shiftDay(selected,7*by);setSelected(next);setMonth(next.slice(0,7));return;}const next=shiftMonth(month,by);setMonth(next);setSelected(next===today.slice(0,7)?today:`${next}-01`);};
 const place=(date:string)=>{const it=picked||drag.current;if(!it?.record)return;if(localDate((it.record.data as any).due||(it.record.data as any).date||(it.record.data as any).deadline||date,tz)!==date)tools.move(it.record,date);setPicked(null);drag.current=null;setOver(null);setSelected(date);};
 const pick=(date:string)=>{if(picked){place(date);return;}setSelected(date);if(!date.startsWith(month))setMonth(date.slice(0,7));if(typeof window!=='undefined'&&window.innerWidth<1100)requestAnimationFrame(()=>document.querySelector('.cal-detail')?.scrollIntoView({behavior:'smooth',block:'start'}));};
 const onKey=(e:KeyboardEvent<HTMLDivElement>,date:string)=>{const by=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='ArrowDown'?7:e.key==='ArrowUp'?-7:0;if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(date);return;}if(!by)return;e.preventDefault();const next=shiftDay(date,by);setSelected(next);if(!next.startsWith(month))setMonth(next.slice(0,7));requestAnimationFrame(()=>gridRef.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus());};
 const dragStart=(e:DragEvent,i:Item)=>{drag.current=i;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',i.title);};
 const addMenu:[Type,string,()=>void][]=[['task','Task',()=>tools.add('task',{due:localNine(selected)})],['habit','Habit',()=>tools.add('habit',{startDate:selected,days:[new Date(`${selected}T12:00:00Z`).getUTCDay()]})],['workout','Workout',()=>tools.add('workout',{date:selected})],['meal','Meal',()=>tools.add('meal',{date:selected})],['bill','Bill',()=>tools.add('cashPlan',{type:'expense',once:selected,day:Number(selected.slice(8)),category:'Bills'})],['money','Money',()=>tools.add('transaction',{date:selected})]];
 const icon=(t:Type,size=14)=>t==='task'?<CheckCircle2 size={size}/>:t==='habit'?<Flame size={size}/>:t==='workout'?<Dumbbell size={size}/>:t==='meal'?<Utensils size={size}/>:t==='bill'?<Receipt size={size}/>:t==='goal'?<Target size={size}/>:<Wallet size={size}/>;
 const selLabel=new Date(`${selected}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
 const heads=(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const).map((_,i,all)=>all[(getDisplay().weekStart+i)%7]);
 return <div className={`calendar-view cal2${picked?' is-placing':''}`}>
  <Entrance className="panel calendar-panel">
   <div className="panel-heading cal-top"><div><span className="eyebrow">CALENDAR</span><h2>{view==='week'?`Week of ${new Date(`${shownWeeks[0][0]}T12:00:00Z`).toLocaleDateString(dateLocale(),{month:'short',day:'numeric',timeZone:'UTC'})}`:label}</h2><p>Tap a day to see it. Drag an item to move it.</p></div>
    <div className="cal-controls"><div className="segmented" role="group" aria-label="Calendar view">{(['month','week'] as const).map(v=><button key={v} className={view===v?'selected':''} aria-pressed={view===v} onClick={()=>setView(v)}>{v==='month'?'Month':'Week'}</button>)}</div><div className="cal-nav"><button aria-label={view==='week'?'Previous week':'Previous month'} onClick={()=>go(-1)}><ChevronLeft size={16}/></button><button className="cal-today" onClick={()=>{setMonth(today.slice(0,7));setSelected(today);}}>Today</button><button aria-label={view==='week'?'Next week':'Next month'} onClick={()=>go(1)}><ChevronRight size={16}/></button></div></div></div>
   <p className="cal-glance" aria-label="Month at a glance"><b>{stats.planned}</b> of {days.length} days planned · <b>{stats.done}</b> of {stats.all} done · <b>{stats.workouts}</b> workouts · <b>{money0(stats.spent,currency)}</b> spent</p>
   {picked&&<div className="cal-placing" role="status"><CalendarClock size={16}/><span>Moving <b>{picked.title}</b>. Tap a day to schedule it.</span><button onClick={()=>setPicked(null)}><X size={14}/>Cancel</button></div>}
   <div className="cal-legend" role="group" aria-label="Show on calendar">{types.map(t=><button key={t.id} className={hidden.includes(t.id)?'off':''} aria-pressed={!hidden.includes(t.id)} onClick={()=>setHidden(h=>h.includes(t.id)?h.filter(x=>x!==t.id):[...h,t.id])}><i style={{background:t.color}}/>{t.label}</button>)}</div>
   <div className={`cal-grid${view==='week'?' is-week':''}`} role="grid" aria-label={label} ref={gridRef}>
    {heads.map(d=><div className="cal-head" role="columnheader" key={d}>{d}</div>)}
    {shownWeeks.flat().map(date=>{const list=visible(date),inMonth=date.startsWith(month),sp=hidden.includes('money')?{inc:0,exp:0}:spend(date),limit=view==='week'?9:3;return <div key={date} role="gridcell" tabIndex={selected===date?0:-1} data-date={date} aria-label={`${date}, ${list.length} items`} aria-selected={selected===date} className={'cal-day'+(inMonth?'':' outside')+(date===today?' today':'')+(selected===date?' selected':'')+(over===date?' drop':'')+(date<today?' past':'')} onClick={()=>pick(date)} onKeyDown={e=>onKey(e,date)} onDragOver={e=>{if(drag.current){e.preventDefault();setOver(date);}}} onDragLeave={()=>setOver(o=>o===date?null:o)} onDrop={e=>{e.preventDefault();place(date);}}>
     <span className="cal-cell-top"><span className="cal-num">{Number(date.slice(8))}</span><button type="button" className="cal-quick" aria-label={`Add on ${date}`} tabIndex={-1} onClick={e=>{e.stopPropagation();pick(date);}}><Plus size={13} strokeWidth={2.6}/></button></span>
     <span className="cal-dots">{list.slice(0,4).map(i=><i key={i.type+i.id} style={{background:colorOf(i.type),opacity:i.done?.35:1}}/>)}{list.length>4&&<small>+{list.length-4}</small>}</span>
     <span className="cal-chips">{list.slice(0,limit).map(i=><em key={i.type+i.id} draggable={movable(i)} onDragStart={e=>dragStart(e,i)} onDragEnd={()=>{drag.current=null;setOver(null);}} style={{borderColor:colorOf(i.type)}} className={(i.done?'done ':'')+(movable(i)?'grab':'')} onClick={e=>{e.stopPropagation();if(i.type==='habit'){pick(date);}else open(i);}}>{icon(i.type,11)}<span>{i.title}</span></em>)}{list.length>limit&&<small>+{list.length-limit} more</small>}</span>
     {(sp.inc>0||sp.exp>0)&&<span className="cal-money">{sp.inc>0&&<b className="in">+{money0(sp.inc,currency)}</b>}{sp.exp>0&&<b className="out">−{money0(sp.exp,currency)}</b>}</span>}
    </div>;})}
   </div>
  </Entrance>
  <aside className="cal-side">
   <Entrance className="panel cal-detail">
    <div className="cal-day-head"><div><h2>{selLabel}</h2><p>{total?`${doneN} of ${total} done`:baseRows.length?`${baseRows.length} on this day`:'Nothing planned yet. Add something below.'}</p></div>{total>0&&<div className="cal-day-bar" aria-hidden="true"><b style={{width:`${doneN/total*100}%`}}/></div>}</div>
    <div className="cal-add" role="group" aria-label={`Add to ${selLabel}`}>{addMenu.map(([t,name,fn])=><button key={t} type="button" onClick={fn} style={{'--c':colorOf(t)} as React.CSSProperties}><span>{icon(t,16)}</span>{name}</button>)}</div>
    {(baseRows.length>0||habitRows.length>0||txRows.length>0)&&<ul className="cal-list cal-list2">
     {baseRows.map(i=><li key={i.type+i.id}><i style={{background:colorOf(i.type)}}/>{(i.type==='task'||i.type==='workout'||i.type==='meal')&&i.record?<Tick checked={!!i.done} label={`Complete ${i.title}`} onChange={()=>tools.toggle(i.record!,i.type==='meal'?'eaten':'done')}/>:<span className="cal-type-icon" style={{color:colorOf(i.type)}}>{icon(i.type,16)}</span>}<button className={'plain-button'+(i.done?' completed':'')} onClick={()=>open(i)}>{i.title}</button><small>{i.sub}</small>{movable(i)&&<button className="cal-move" aria-label={`Move ${i.title}`} title="Move to another day" onClick={()=>setPicked(i)}><CalendarClock size={15}/></button>}</li>)}
     {habitRows.map(({h,done})=><li key={h.id}><i style={{background:colorOf('habit')}}/>{selected===today?<Tick checked={done} label={`Complete ${h.data.title}`} onChange={()=>completeHabit(h,selected)}/>:<span className={`tick-static${done?' on':''}`} title={selected>today?'You can check this on the day itself':'Past days are read only'} aria-label={done?'Done':'Not done'}>{done?'✓':''}</span>}<button className={'plain-button'+(done?' completed':'')} onClick={()=>tools.edit(h)}>{h.data.title}</button><small>Habit</small></li>)}
     {txRows.map(r=><li key={r.id}><i style={{background:r.data.type==='income'?'#4ade80':'#ff5d5d'}}/><span className="cal-type-icon" style={{color:r.data.type==='income'?'#4ade80':'#ff5d5d'}}><Wallet size={16}/></span><button className="plain-button" onClick={()=>tools.edit(r)}>{r.data.title}</button><strong className={r.data.type==='income'?'positive':'negative'}>{r.data.type==='income'?'+':'−'}{money0(r.data.amount,currency)}</strong></li>)}
    </ul>}
   </Entrance>
   <Entrance className="panel cal-tray"><div className="panel-heading"><div><h2>Needs a new day</h2><p>Overdue and missed. Tap one, then tap a day.</p></div></div>
    {overdue.length?<ul className="cal-tray-list">{overdue.map(i=><li key={i.type+i.id}><button className={picked?.id===i.id?'on':''} onClick={()=>setPicked(p=>p?.id===i.id?null:i)}><i style={{background:colorOf(i.type)}}/><span>{i.title}</span><small>{i.type==='task'?'Task':'Workout'}</small><CalendarClock size={14}/></button></li>)}</ul>:<p className="muted cal-clear"><CheckCircle2 size={16}/> You are all caught up.</p>}
   </Entrance>
  </aside>
 </div>;
}
