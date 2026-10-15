'use client';
import {Check,Flame,Plus} from 'lucide-react';
import {habitStreak,recordsOf,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {Entrance,Ring} from './animation';
import {Button} from './ui/button';

const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
// The daily checklist: today's habits as big, easy targets. Tap to tick, tap again to undo.
export function DailyHabits({s,today,pending,onComplete,onAdd}:{s:Snapshot;today:string;pending:boolean;onComplete:(h:LedgerRecord<'habit'>,date:string)=>void;onAdd:()=>void}){
 const dow=new Date(`${today}T12:00:00Z`).getUTCDay();
 const done=new Set(recordsOf(s.records,'completion').map(c=>`${c.data.habitId}:${c.data.date}`));
 const habits=recordsOf(s.records,'habit').filter(h=>h.data.active),due=habits.filter(h=>h.data.startDate<=today&&h.data.days.includes(dow)),rest=habits.filter(h=>!due.includes(h));
 const finished=due.filter(h=>done.has(`${h.id}:${today}`)).length,pct=due.length?finished/due.length*100:0;
 return <Entrance className="panel daily-habits">
  <div className="dh-head"><div><span className="eyebrow">DAILY CHECKLIST</span><h2>{!due.length?'No habits due today':finished===due.length?'All done. Beautiful.':`${due.length-finished} left for today`}</h2><p>Tick a habit when you finish it. Made a mistake? Tap again to undo.</p></div><div className="dh-ring"><Ring value={pct}/><small>{finished} of {due.length}</small></div></div>
  <div className="dh-list">{due.map(h=>{const checked=done.has(`${h.id}:${today}`),streak=habitStreak(h,s.records,today);return <button key={h.id} className={`dh-row ${checked?'checked':''}`} disabled={pending} aria-pressed={checked} aria-label={`${checked?'Undo':'Complete'} habit ${h.data.title} today`} onClick={()=>onComplete(h,today)}>
   <span className="dh-box" aria-hidden="true"><Check size={18}/></span>
   <span className="dh-text"><strong>{h.data.title}</strong><small>{h.data.days.length===7?'Every day':h.data.days.map(d=>dayNames[d]).join(' · ')}</small></span>
   <span className={`dh-streak ${streak?'on':''}`}><Flame size={14}/>{streak}</span>
  </button>;})}
  {!due.length&&<p className="tf-empty">{habits.length?'Rest day. Your streaks are safe.':'Create your first habit to start a streak.'}</p>}</div>
  {!!rest.length&&<p className="dh-rest">Not scheduled today: {rest.map(h=>h.data.title).join(', ')}</p>}
  <Button onClick={onAdd}><Plus size={15}/>New habit</Button>
 </Entrance>;
}
