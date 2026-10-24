'use client';
import Link from 'next/link';
import {useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';
import {CountUp} from './animation';
import {Bike,Check,CalendarDays,ChevronLeft,ChevronRight,Clock3,Volume2,VolumeX,Dumbbell,Flame,Flower2,Footprints,Lock,Minus,Plus,Shapes,Sparkles,Waves,Zap} from 'lucide-react';
import {calendarWeeks,getDisplay,type LedgerRecord} from '@ledger/shared';

const pad=(n:number)=>String(n).padStart(2,'0');
const toLocal=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toDay=(d:Date)=>toLocal(d).slice(0,10);
const parse=(v:unknown)=>{const d=v?new Date(String(v)):new Date();return Number.isNaN(d.getTime())?new Date():d;};
const clock=(d:Date)=>d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
const SmartNote=({what}:{what:string})=><p className="smart-locked"><Lock size={13}/>{what} come with Pro and Lifetime. <Link href="/plans">See plans</Link></p>;

export type TimePick={label:string;date:Date};
/** Usual hour of the person's own tasks plus a tomorrow-morning pick. Built only from their own records. */
export function taskTimePicks(records:LedgerRecord[],now=new Date()):TimePick[]{
 const hours=records.filter(r=>r.kind==='task').map(r=>new Date((r.data as any).due).getHours()),counts=new Map<number,number>();
 hours.forEach(h=>counts.set(h,(counts.get(h)||0)+1));
 const usual=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0];const picks:TimePick[]=[];
 if(usual&&usual[1]>=2){const d=new Date(now);d.setHours(usual[0],0,0,0);picks.push({label:`Your usual time · ${clock(d)}`,date:d});}
 const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);tomorrow.setHours(9,0,0,0);picks.push({label:'Tomorrow morning · 9:00 AM',date:tomorrow});
 return picks;
}

// A soft click while the clock moves. Quiet, and the person can mute it (remembered on this device).
let audio:AudioContext|null=null;
const soundOn=()=>{try{return localStorage.getItem('dl-sound')!=='off';}catch{return true;}};
export function clockTick(){
 try{if(typeof window==='undefined'||!soundOn())return;const A=window.AudioContext||(window as any).webkitAudioContext;if(!A)return;audio=audio||new A();if(audio.state==='suspended')void audio.resume();
  const o=audio.createOscillator(),g=audio.createGain(),now=audio.currentTime;o.type='triangle';o.frequency.setValueAtTime(1900,now);o.frequency.exponentialRampToValueAtTime(900,now+.04);g.gain.setValueAtTime(.05,now);g.gain.exponentialRampToValueAtTime(.0001,now+.05);o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+.055);}catch{/* sound is optional */}
}

/** The big analog clock: tap or drag the hand, flip AM and PM, or jump to a time of day. Used by every form that needs a time. */
export function ClockFace({date:d,onChange,big=false}:{date:Date;onChange:(d:Date)=>void;big?:boolean}){
 const [mode,setMode]=useState<'hour'|'minute'>('hour');const [sound,setSound]=useState(soundOn());
 const pm=d.getHours()>=12,h12=d.getHours()%12||12,minute=d.getMinutes();
 const edit=(fn:(x:Date)=>void)=>{const x=new Date(d);fn(x);onChange(x);clockTick();};
 const setHour=(h:number)=>{if(h!==h12)edit(x=>x.setHours((h%12)+(pm?12:0)));};const setMinute=(m:number)=>{if(m!==minute)edit(x=>x.setMinutes(m));};
 const times:[string,number][]=[['Morning',9],['Noon',12],['Afternoon',14],['Evening',18],['Night',21]];
 const target=mode==='hour'?(h12%12)*30:minute*6,R=74,turn=useRef(target);
 // Rotate the hand by the shortest way round so 11 to 1 never spins the long way.
 turn.current=turn.current+((target-turn.current%360+540)%360-180);const angle=turn.current;
 const labels=mode==='hour'?Array.from({length:12},(_,i)=>i+1):Array.from({length:12},(_,i)=>i*5);
 const pick=(e:PointerEvent<SVGSVGElement>)=>{if(e.type==='pointermove'&&e.buttons!==1)return;const r=e.currentTarget.getBoundingClientRect();let a=Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI+90;if(a<0)a+=360;if(mode==='hour')setHour(Math.round(a/30)%12||12);else setMinute((Math.round(a/30)*5)%60);};
 const key=(e:KeyboardEvent)=>{const step=e.key==='ArrowUp'||e.key==='ArrowRight'?1:e.key==='ArrowDown'||e.key==='ArrowLeft'?-1:0;if(!step)return;e.preventDefault();if(mode==='hour')setHour(((h12-1+step+12)%12)+1);else setMinute((minute+step*5+60)%60);};
 return <>
  <div className={`due-clock${big?' big':''}`}>
   <div className="due-digital"><button type="button" className={mode==='hour'?'on':''} onClick={()=>setMode('hour')} aria-label={`Hour ${h12}`}><span key={h12} className="digit">{pad(h12)}</span></button><b>:</b><button type="button" className={mode==='minute'?'on':''} onClick={()=>setMode('minute')} aria-label={`Minute ${pad(minute)}`}><span key={minute} className="digit">{pad(minute)}</span></button><div className="due-ampm" role="group" aria-label="AM or PM"><button type="button" className={!pm?'on':''} onClick={()=>edit(x=>x.setHours(x.getHours()%12))}>AM</button><button type="button" className={pm?'on':''} onClick={()=>edit(x=>x.setHours((x.getHours()%12)+12))}>PM</button></div><button type="button" className="due-sound" aria-pressed={sound} aria-label={sound?'Mute clock sound':'Turn clock sound on'} title={sound?'Sound on':'Sound off'} onClick={()=>{const next=!sound;setSound(next);try{localStorage.setItem('dl-sound',next?'on':'off');}catch{/* private mode */}if(next)clockTick();}}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button></div>
   <svg className="due-dial" viewBox="0 0 220 220" role="slider" tabIndex={0} aria-label={mode==='hour'?'Hour':'Minute'} aria-valuemin={mode==='hour'?1:0} aria-valuemax={mode==='hour'?12:55} aria-valuenow={mode==='hour'?h12:minute} onKeyDown={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pick(e);}} onPointerMove={pick} onPointerUp={()=>{if(mode==='hour')setMode('minute');}}>
    <circle cx="110" cy="110" r="104" className="due-face"/><g className="due-hand-wrap" style={{transform:`rotate(${angle}deg)`}}><line x1="110" y1="110" x2="110" y2={110-R} className="due-hand"/><circle cx="110" cy={110-R} r="17" className="due-knob"/></g><circle cx="110" cy="110" r="4" className="due-pin"/>
    <g key={mode} className="due-nums">{labels.map((n,i)=>{const a=(mode==='hour'?i+1:i)*30*Math.PI/180,x=110+Math.sin(a)*R,y=110-Math.cos(a)*R,sel=mode==='hour'?n===h12:n===(Math.round(minute/5)*5)%60;return <text key={n} x={x} y={y} textAnchor="middle" dominantBaseline="central" className={sel?'due-num sel':'due-num'}>{mode==='hour'?n:pad(n)}</text>;})}</g>
   </svg>
  </div>
  <div className="due-chips" role="group" aria-label="Quick times">{times.map(([label,h])=><button type="button" key={label} className={d.getHours()===h&&minute===0?'selected':''} onClick={()=>edit(x=>x.setHours(h,0,0,0))}>{label}<small>{clock(new Date(2000,0,1,h))}</small></button>)}</div>
 </>;
}

export function DueDateTimePicker({reg,value,picks,smart,timeOnly=false}:{reg:any;value:unknown;picks:TimePick[];smart:boolean;timeOnly?:boolean}){
 const el=useRef<HTMLInputElement|null>(null);
 const d=parse(value);
 // The hidden native input stays the source of truth so validation and saving behave exactly as before.
 const commit=(next:Date)=>{const input=el.current;if(!input)return;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,toLocal(next));input.dispatchEvent(new Event('input',{bubbles:true}));};
 const setDay=(day:Date)=>{const x=new Date(d);x.setFullYear(day.getFullYear(),day.getMonth(),day.getDate());commit(x);};
 const today=new Date(),tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
 const saturday=new Date(today);saturday.setDate(today.getDate()+((6-today.getDay()+7)%7||7));
 const monday=new Date(today);monday.setDate(today.getDate()+((8-today.getDay())%7||7));
 const days:[string,Date][]=[['Today',today],['Tomorrow',tomorrow],['Weekend',saturday],['Next week',monday]];
 return <div className="due-picker">
  <input type="datetime-local" className="due-native" tabIndex={-1} aria-hidden="true" {...reg} ref={(node:HTMLInputElement|null)=>{reg.ref(node);el.current=node;}}/>
  <div className="due-summary" aria-live="polite">{!timeOnly&&<span><CalendarDays size={16}/>{d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})}</span>}<span><Clock3 size={16}/>{clock(d)}</span></div>
  {!timeOnly&&<div className="due-chips" role="group" aria-label="Pick a day">{days.map(([label,day])=><button type="button" key={label} className={toDay(day)===toDay(d)?'selected':''} onClick={()=>setDay(day)}>{label}</button>)}<input type="date" aria-label="Choose another date" value={toDay(d)} onChange={e=>{if(e.target.value){const [y,m,dd]=e.target.value.split('-').map(Number);setDay(new Date(y,m-1,dd));}}}/></div>}
  <ClockFace date={d} onChange={commit}/>
  {smart?(picks.length>0&&<div className="due-smart" role="group" aria-label="Smart picks"><Sparkles size={14}/><span>Smart picks</span>{picks.map(p=><button type="button" key={p.label} className="suggest-chip" onClick={()=>commit(p.date)}>{p.label}</button>)}</div>):<SmartNote what="Smart time picks"/>}
 </div>;
}

const types:[string,typeof Dumbbell,number][]=[['Strength',Dumbbell,5],['Running',Footprints,9.8],['Walking',Footprints,3.5],['Cycling',Bike,7.5],['Yoga',Flower2,3],['HIIT',Zap,9],['Swimming',Waves,7],['Other',Shapes,5]];
const effort:[string,number,string][]=[['Easy',.8,'Light, you can chat easily'],['Moderate',1,'Steady, a little breathless'],['Hard',1.2,'Tough, hard to talk']];
const KG=70;
export const burnEstimate=(type:string,minutes:number,intensity:string)=>{const met=types.find(t=>t[0]===type)?.[2]??5,mult=effort.find(e=>e[0]===intensity)?.[1]??1;return Math.round(met*KG*(Math.max(0,minutes)/60)*mult);};

export const WORKOUT_STEPS=['Start','Plan','Finish'] as const;
export function WorkoutFields({register,watch,setValue,errors,records,smart,step,repeat,repeatErr,today,lockedDone=false}:{lockedDone?:boolean;register:any;watch:any;setValue:any;errors:any;records:LedgerRecord[];smart:boolean;step:number|null;repeat?:RepeatState;repeatErr?:string;today:string}){
 const type=String(watch('type')||'Strength'),intensity=String(watch('intensity')||'Moderate'),minutes=Number(watch('duration'))||0;
 const set=(k:string,v:unknown)=>setValue(k,v,{shouldDirty:true,shouldValidate:true});
 const recent=(()=>{const seen=new Set<string>(),out:LedgerRecord<'workout'>[]=[];for(const r of records.filter((x):x is LedgerRecord<'workout'>=>x.kind==='workout').sort((a,b)=>b.data.date.localeCompare(a.data.date))){const k=`${r.data.title}|${r.data.type}`;if(!seen.has(k)){seen.add(k);out.push(r);}if(out.length===3)break;}return out;})();
 const show=(n:number)=>step===null||step===n;
 const kcal=burnEstimate(type,minutes,intensity);
 return <>
  {step!==null&&<div className="wide wo-steps" role="list" aria-label="Workout steps">{WORKOUT_STEPS.map((label,i)=><div role="listitem" key={label} className={`wo-step${i===step?' now':i<step?' past':''}`} aria-current={i===step?'step':undefined}><i>{i<step?'✓':i+1}</i><span>{label}</span></div>)}</div>}
  {show(0)&&<div className="wide wo-pane" key="p0">
   {step===0&&<div className="wo-intro"><h3>What are you training?</h3><p>Pick a type, then give it a name.</p></div>}
   {smart?(recent.length>0&&<div className="form-suggest" role="group" aria-label="Smart suggestions"><Sparkles size={14}/><span>Repeat a recent one</span>{recent.map(r=><button type="button" key={r.id} className="suggest-chip" onClick={()=>{set('title',r.data.title);set('type',r.data.type);set('duration',r.data.duration);if(r.data.intensity)set('intensity',r.data.intensity);}}>{r.data.title} · {r.data.duration} min</button>)}</div>):<SmartNote what="Smart workout suggestions"/>}
   <div><span className="field-label">Type</span><div className="wo-types" role="radiogroup" aria-label="Workout type">{types.map(([name,Icon])=><button type="button" role="radio" aria-checked={type===name} key={name} className={type===name?'selected':''} onClick={()=>set('type',name)}><Icon size={20}/>{name}</button>)}</div></div>
   <label><span>Workout name</span><input aria-label="Workout name" placeholder={`For example: ${type==='Strength'?'Upper body strength':type==='Running'?'Easy 5K':'Morning session'}`} {...register('title')}/>{errors.title&&<small className="error">{String(errors.title.message||'Enter a name')}</small>}</label>
  </div>}
  <input type="hidden" {...register('type')}/><input type="hidden" {...register('intensity')}/>
  {show(1)&&<div className="wide wo-pane" key="p1">
   {step===1&&<div className="wo-intro"><h3>How long and how hard?</h3><p>We estimate the calories for you.</p></div>}
   <div><span className="field-label">Duration</span><div className="wo-stepper"><button type="button" aria-label="5 minutes less" onClick={()=>set('duration',Math.max(5,minutes-5))}><Minus size={16}/></button><label><input aria-label="Duration (minutes)" type="number" min="1" max="1440" inputMode="numeric" {...register('duration',{valueAsNumber:true})}/><small>min</small></label><button type="button" aria-label="5 minutes more" onClick={()=>set('duration',Math.min(1440,minutes+5))}><Plus size={16}/></button></div></div>
   <div className="wo-quick" role="group" aria-label="Quick durations">{[15,30,45,60,90].map(m=><button type="button" key={m} className={minutes===m?'selected':''} onClick={()=>set('duration',m)}>{m} min</button>)}</div>
   <div><span className="field-label">Effort</span><div className="wo-effort" role="radiogroup" aria-label="Effort">{effort.map(([name,,hint])=><button type="button" role="radio" aria-checked={intensity===name} data-effort={name} key={name} className={intensity===name?'selected':''} onClick={()=>set('intensity',name)}><strong>{name}</strong><small>{hint}</small></button>)}</div></div>
   <div className="wo-burn"><Flame size={18}/><div><strong><CountUp value={kcal} duration={.5} format={v=>`≈ ${v} kcal`}/></strong><small>Rough estimate for a 70 kg adult. Your real burn varies.</small></div></div>
  </div>}
  {show(2)&&<div className="wide wo-pane" key="p2">
   {step===2&&<div className="wo-intro"><h3>Last details</h3><p>Check the summary, then save.</p></div>}
   {step===2&&<div className="wo-summary"><strong>{String(watch('title')||'Workout')}</strong><span>{type} · {minutes} min · {intensity} · ≈{kcal} kcal</span></div>}
   {repeat?<div><span className="field-label">When</span><WhenChooser modes={['once','days']} mode={repeat.on?'days':'once'} onMode={m=>repeat.setOn(m==='days')}/>{repeat.on?<><RepeatDays today={today} dates={repeat.dates} onChange={repeat.setDates}/>{repeatErr&&<small className="error">{repeatErr}</small>}</>:<label className="cp-when"><span>Date</span><input aria-label="Date" type="date" {...register('date')}/></label>}</div>:<label><span>Date</span><input aria-label="Date" type="date" {...register('date')}/></label>}
   <label><span>Notes</span><textarea placeholder="Sets, reps, weights, how it felt… (optional)" {...register('notes')}/></label>
   {lockedDone?<p className="wo-locked"><Check size={16}/>Completed. Your XP is locked in, so this cannot be undone.</p>:<label className="check-label wo-done"><input type="checkbox" {...register('done')}/><span>Mark as completed</span></label>}
  </div>}
 </>;
}

export type RepeatState={on:boolean;dates:string[];setOn:(v:boolean)=>void;setDates:(d:string[])=>void};
export type WhenMode='once'|'days'|'weekly'|'monthly';
/** One time / pick days (/ every week / every month): a simple switch that decides how the item repeats. */
export function WhenChooser({mode,onMode,modes}:{mode:WhenMode;onMode:(m:WhenMode)=>void;modes:WhenMode[]}){
 const names:Record<WhenMode,string>={once:'One time',days:'Pick days',weekly:'Every week',monthly:'Every month'};
 return <div className="when-chooser" role="radiogroup" aria-label="Repeat" style={{gridTemplateColumns:`repeat(${modes.length},1fr)`}}>{modes.map(m=><button type="button" role="radio" aria-checked={mode===m} key={m} className={mode===m?'selected':''} onClick={()=>onMode(m)}>{names[m]}</button>)}</div>;
}
/** Tap any days you like, across months. Each tapped day becomes its own entry. */
export function RepeatDays({dates,onChange,today}:{dates:string[];onChange:(d:string[])=>void;today:string}){
 const [month,setMonth]=useState(today.slice(0,7));
 const weeks=calendarWeeks(month),inMonth=weeks.flat().filter(d=>d.startsWith(month)&&d>=today);
 const shiftM=(by:number)=>{const [y,m]=month.split('-').map(Number);setMonth(new Date(Date.UTC(y,m-1+by,1)).toISOString().slice(0,7));};
 const set=(list:string[])=>onChange(Array.from(new Set(list)).sort());
 const toggle=(d:string)=>set(dates.includes(d)?dates.filter(x=>x!==d):[...dates,d]);
 const dow=(d:string)=>new Date(`${d}T12:00:00Z`).getUTCDay();
 const next7=Array.from({length:7},(_,i)=>new Date(new Date(`${today}T12:00:00Z`).getTime()+i*864e5).toISOString().slice(0,10));
 const chips:[string,string[]][]=[['Next 7 days',next7],['Weekdays',inMonth.filter(d=>dow(d)>0&&dow(d)<6)],['Weekends',inMonth.filter(d=>dow(d)===0||dow(d)===6)],...(dates[0]?[[`Every ${new Date(`${dates[0]}T12:00:00Z`).toLocaleDateString([], {weekday:'short',timeZone:'UTC'})}`,inMonth.filter(d=>dow(d)===dow(dates[0]))] as [string,string[]]]:[])];
 const label=new Date(`${month}-01T12:00:00Z`).toLocaleDateString([], {month:'long',year:'numeric',timeZone:'UTC'});
 return <div className="repeat-days">
  <div className="rd-head"><button type="button" aria-label="Previous month" onClick={()=>shiftM(-1)}><ChevronLeft size={16}/></button><strong>{label}</strong><button type="button" aria-label="Next month" onClick={()=>shiftM(1)}><ChevronRight size={16}/></button></div>
  <div className="rd-grid" role="group" aria-label="Pick days">{['S','M','T','W','T','F','S'].map((_,i,all)=>all[(getDisplay().weekStart+i)%7]).map((x,i)=><span key={i} className="rd-dow">{x}</span>)}{weeks.flat().map(d=>{const out=!d.startsWith(month),past=d<today;if(out)return <span key={d}/>;return <button type="button" key={d} disabled={out||past} aria-pressed={dates.includes(d)} aria-label={d} className={`rd-day${dates.includes(d)?' on':''}${d===today?' today':''}`} onClick={()=>toggle(d)}>{out?'':Number(d.slice(8))}</button>;})}</div>
  <div className="rd-chips">{chips.map(([name,list])=><button type="button" key={name} onClick={()=>set([...dates,...list])}>{name}</button>)}{dates.length>0&&<button type="button" className="clear" onClick={()=>onChange([])}>Clear</button>}</div>
  <p className="rd-count">{dates.length?`${dates.length} day${dates.length===1?'':'s'} selected. Each one is added on its own.`:'Tap the days you want.'}</p>
 </div>;
}

/** How many? Tap 1 to 4, or step further. Used for servings and grocery amounts. */
export function QtyPicker({value,onChange,min=1,max=99,label}:{value:number;onChange:(n:number)=>void;min?:number;max?:number;label:string}){
 const set=(n:number)=>onChange(Math.min(max,Math.max(min,Math.round(n))));
 return <div className="qty" role="group" aria-label={label}>
  <div className="qty-chips">{[1,2,3,4].map(n=><button type="button" key={n} aria-pressed={value===n} className={value===n?'on':''} onClick={()=>set(n)}>{n}</button>)}</div>
  <div className="qty-step"><button type="button" aria-label="One less" onClick={()=>set(value-1)} disabled={value<=min}><Minus size={16}/></button><input inputMode="numeric" aria-label={label} value={value} onChange={e=>set(Number(e.target.value.replace(/\D/g,''))||min)}/><button type="button" aria-label="One more" onClick={()=>set(value+1)} disabled={value>=max}><Plus size={16}/></button></div>
 </div>;
}
