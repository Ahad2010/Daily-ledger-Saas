'use client';
import {useMemo,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react';
import {calendarWeeks,localDate,money,monthDates,recordsOf,type Kind,type LedgerRecord,type Snapshot,dateLocale,getDisplay} from '@ledger/shared';
import {Entrance} from './animation';
import {Button} from './ui/button';

type Tools={add:(kind:Kind,initial?:Record<string,unknown>)=>void;edit:(r:LedgerRecord)=>void};
type Type='task'|'workout'|'meal'|'bill'|'goal';
type Item={id:string;type:Type;title:string;sub?:string;record?:LedgerRecord;done?:boolean};
const types:{id:Type;label:string;color:string}[]=[{id:'task',label:'Tasks',color:'#a894ff'},{id:'workout',label:'Workouts',color:'#80e4bd'},{id:'meal',label:'Meals',color:'#f5b94a'},{id:'bill',label:'Bills',color:'#ff9b7a'},{id:'goal',label:'Goal dates',color:'#4cc3ff'}];
const colorOf=(t:Type)=>types.find(x=>x.id===t)!.color;
const shiftMonth=(month:string,by:number)=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+by,1));return d.toISOString().slice(0,7);};

// A month grid that gathers tasks, workouts, meals, bills and goal dates, so the whole plan is visible in one place.
export function CalendarView({s,today,tools}:{s:Snapshot;today:string;tools:Tools}){
 const router=useRouter();const tz=s.profile.timezone;
 const [month,setMonth]=useState(today.slice(0,7));const [selected,setSelected]=useState(today),[hidden,setHidden]=useState<Type[]>([]);
 const weeks=calendarWeeks(month);const days=monthDates(month);
 const byDate=useMemo(()=>{
  const map=new Map<string,Item[]>();const put=(date:string,item:Item)=>{if(!map.has(date))map.set(date,[]);map.get(date)!.push(item);};
  const lastDay=days.length;
  recordsOf(s.records,'task').forEach(t=>put(localDate(t.data.due,tz),{id:t.id,type:'task',title:t.data.title,sub:new Date(t.data.due).toLocaleTimeString(dateLocale(),{timeZone:tz,hour:'numeric',minute:'2-digit'}),record:t,done:t.data.done}));
  recordsOf(s.records,'workout').forEach(w=>put(w.data.date,{id:w.id,type:'workout',title:w.data.title,sub:`${w.data.duration} min`,record:w,done:!!w.data.done}));
  recordsOf(s.records,'meal').forEach(m=>put(m.data.date,{id:m.id,type:'meal',title:m.data.title,sub:m.data.slot,record:m,done:!!m.data.eaten}));
  recordsOf(s.records,'goal').filter(g=>g.data.active).forEach(g=>put(g.data.deadline,{id:g.id,type:'goal',title:g.data.title,sub:'Target date',record:g}));
  recordsOf(s.records,'cashPlan').filter(p=>p.data.active&&p.data.type==='expense').forEach(p=>put(`${month}-${String(Math.min(p.data.day,lastDay)).padStart(2,'0')}`,{id:p.id,type:'bill',title:p.data.title,sub:money(p.data.amount,p.data.currency),record:p}));
  return map;
 },[s.records,tz,month,days.length]);
 const visible=(date:string)=>(byDate.get(date)||[]).filter(i=>!hidden.includes(i.type));
 const selectedItems=visible(selected);
 const label=new Date(`${month}-01T12:00:00Z`).toLocaleDateString(dateLocale(),{month:'long',year:'numeric',timeZone:'UTC'});
 const open=(item:Item)=>{if(item.type==='bill')router.push('/finance/bills');else if(item.type==='goal')router.push(`/goals/${item.id}`);else if(item.record)tools.edit(item.record);};
 const go=(by:number)=>{const next=shiftMonth(month,by);setMonth(next);setSelected(next===today.slice(0,7)?today:`${next}-01`);};
 return <div className="calendar-view">
  <Entrance className="panel calendar-panel">
   <div className="panel-heading"><div><span className="eyebrow">CALENDAR</span><h2>{label}</h2><p>Everything planned, in one grid.</p></div><div className="inline-actions"><Button aria-label="Previous month" onClick={()=>go(-1)}><ChevronLeft size={16}/></Button><Button onClick={()=>{setMonth(today.slice(0,7));setSelected(today);}}>Today</Button><Button aria-label="Next month" onClick={()=>go(1)}><ChevronRight size={16}/></Button></div></div>
   <div className="cal-legend" role="group" aria-label="Show on calendar">{types.map(t=><button key={t.id} className={hidden.includes(t.id)?'off':''} aria-pressed={!hidden.includes(t.id)} onClick={()=>setHidden(h=>h.includes(t.id)?h.filter(x=>x!==t.id):[...h,t.id])}><i style={{background:t.color}}/>{t.label}</button>)}</div>
   <div className="cal-grid" role="grid" aria-label={label}>
    {(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const).map((_,i,all)=>all[(getDisplay().weekStart+i)%7]).map(d=><div className="cal-head" role="columnheader" key={d}>{d}</div>)}
    {weeks.flat().map(date=>{const items=visible(date),inMonth=date.startsWith(month);return <button key={date} role="gridcell" aria-label={`${date}, ${items.length} items`} aria-selected={selected===date} className={'cal-day'+(inMonth?'':' outside')+(date===today?' today':'')+(selected===date?' selected':'')} onClick={()=>setSelected(date)}>
     <span className="cal-num">{Number(date.slice(8))}</span>
     <span className="cal-dots">{items.slice(0,4).map(i=><i key={i.type+i.id} style={{background:colorOf(i.type),opacity:i.done?.35:1}}/>)}{items.length>4&&<small>+{items.length-4}</small>}</span>
     <span className="cal-chips">{items.slice(0,2).map(i=><em key={i.type+i.id} style={{borderColor:colorOf(i.type)}} className={i.done?'done':''}>{i.title}</em>)}{items.length>2&&<small>+{items.length-2} more</small>}</span>
    </button>;})}
   </div>
  </Entrance>
  <Entrance className="panel cal-detail">
   <div className="panel-heading"><div><h2>{new Date(`${selected}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})}</h2><p>{selectedItems.length?`${selectedItems.length} planned`:'Nothing planned yet'}</p></div>
    <div className="inline-actions"><Button onClick={()=>tools.add('task',{due:`${selected}T09:00:00.000Z`})}><Plus size={14}/>Task</Button><Button onClick={()=>tools.add('workout',{date:selected})}><Plus size={14}/>Workout</Button><Button onClick={()=>tools.add('meal',{date:selected})}><Plus size={14}/>Meal</Button></div></div>
   {selectedItems.length>0&&<ul className="cal-list">{selectedItems.map(i=><li key={i.type+i.id}><i style={{background:colorOf(i.type)}}/><button className={'plain-button'+(i.done?' completed':'')} onClick={()=>open(i)}>{i.title}</button><small>{types.find(t=>t.id===i.type)!.label.replace(/s$/,'')}{i.sub?` · ${i.sub}`:''}</small></li>)}</ul>}
  </Entrance>
 </div>;
}
