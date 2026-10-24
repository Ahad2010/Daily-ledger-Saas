'use client';
import Link from 'next/link';
import {ArrowRight,CalendarDays,CheckCircle2,Clock3,Dumbbell,Flame,Plus,Receipt,Sparkles,Target,TrendingDown,TrendingUp,Utensils} from 'lucide-react';
import {goalProgress,localDate,money,recordsOf,weeklyReview,type Kind,type LedgerRecord,type Snapshot,dateLocale} from '@ledger/shared';
import {dailyBrief} from '../lib/daily-brief';
import {dayNutrition,nutritionTarget,pct} from '../lib/nutrition';
import {Entrance,Ring} from './animation';
import {useEffect,useState,type ReactNode} from 'react';
import {burnEstimate} from './record-extras';

type Tools={add:(kind:Kind,initial?:Record<string,unknown>)=>void;edit:(r:LedgerRecord)=>void;toggle:(r:LedgerRecord,key?:string)=>void};
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const clock=(iso:string,timezone:string)=>new Date(iso).toLocaleTimeString(dateLocale(),{timeZone:timezone,hour:'numeric',minute:'2-digit'});


/** A tick that responds instantly: it flips locally, then follows the saved value (and rolls back if the write never lands). */
export function Tick({checked,label,onChange,locked=false}:{checked:boolean;label:string;onChange:()=>void;locked?:boolean}){
 const [local,setLocal]=useState<boolean|null>(null);const shown=local??checked;
 useEffect(()=>{if(local===null)return;if(local===checked){setLocal(null);return;}const id=setTimeout(()=>setLocal(null),6000);return()=>clearTimeout(id);},[checked,local]);
 return <button type="button" role="checkbox" aria-checked={shown} aria-label={label} className={`tick${shown?' on':''}${locked?' locked':''}`} aria-disabled={locked||undefined} title={locked?'Completed. Your XP is locked in.':undefined} onClick={()=>{if(locked)return;setLocal(!shown);onChange();}}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.8"/></svg><i className="tick-burst" aria-hidden="true"/></button>;
}
const AddButton=({label,onClick}:{label:string;onClick:()=>void})=><button type="button" className="add-fab" aria-label={label} title={label} onClick={onClick}><Plus size={16} strokeWidth={2.6}/></button>;
function CardHead({icon,title,count,href,linkLabel,add,addLabel,tone}:{icon:ReactNode;title:string;count?:string;href:string;linkLabel:string;add:()=>void;addLabel:string;tone:string}){
 return <div className="panel-heading today-head" data-tone={tone}><h2><span className="today-icon">{icon}</span>{title}{count&&<span className="today-count">{count}</span>}</h2><div className="today-head-actions"><Link href={href} className="today-open" aria-label={linkLabel} title={linkLabel}><ArrowRight size={15}/></Link><AddButton label={addLabel} onClick={add}/></div></div>;
}
function Bar({value,tone}:{value:number;tone?:string}){return <div className="today-bar" data-tone={tone}><span style={{width:`${Math.max(0,Math.min(100,value))}%`}}/></div>;}
function Nothing({icon,text,cta,onClick}:{icon:ReactNode;text:string;cta:string;onClick:()=>void}){return <div className="today-empty"><span className="today-empty-icon">{icon}</span><p>{text}</p><button type="button" className="today-cta" onClick={onClick}><Plus size={15}/>{cta}</button></div>;}

// One screen for the day: what is due, what is planned, what has been eaten, which bills are close, and last week in short.
export function TodayView({s,today,asOf,tools,completeHabit}:{s:Snapshot;today:string;asOf:Date;tools:Tools;completeHabit:(h:LedgerRecord<'habit'>,d:string)=>void;pending:boolean}){
 const tz=s.profile.timezone,currency=s.profile.currency;const brief=dailyBrief(s,asOf);
 const tasks=recordsOf(s.records,'task').filter(t=>localDate(t.data.due,tz)<=today&&(!t.data.done||localDate(t.data.completedAt||t.data.due,tz)===today)).sort((a,b)=>a.data.due.localeCompare(b.data.due));
 const weekday=new Date(`${today}T12:00:00Z`).getUTCDay();const completions=recordsOf(s.records,'completion');
 const habits=recordsOf(s.records,'habit').filter(h=>h.data.active&&h.data.startDate<=today&&h.data.days.includes(weekday));
 const habitDone=(h:LedgerRecord<'habit'>)=>completions.some(c=>c.data.habitId===h.id&&c.data.date===today);
 const workouts=recordsOf(s.records,'workout').filter(w=>w.data.date===today);
 const meals=recordsOf(s.records,'meal').filter(m=>m.data.date===today);
 const day=dayNutrition(s,today),target=nutritionTarget(s);
 const dayOfMonth=Number(today.slice(8));const lastDay=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 const bills=recordsOf(s.records,'cashPlan').filter(p=>p.data.active&&p.data.type==='expense').map(p=>{const upcoming=Array.from({length:8},(_,i)=>shift(today,i)).find(d=>p.data.once?d===p.data.once:Math.min(p.data.day,lastDay(d.slice(0,7)))===Number(d.slice(8)));return upcoming?{plan:p,date:upcoming}:null;}).filter((x):x is {plan:LedgerRecord<'cashPlan'>;date:string}=>!!x).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
 const goals=recordsOf(s.records,'goal').filter(g=>g.data.active).map(g=>({g,p:goalProgress(g,s.records)})).filter(x=>!x.p.done).sort((a,b)=>a.g.data.deadline.localeCompare(b.g.data.deadline)).slice(0,2);
 const review=weeklyReview(s.records,{currency,timezone:tz,asOf});
 const total=tasks.length+habits.length+workouts.length+meals.length;
 const done=tasks.filter(t=>t.data.done).length+habits.filter(habitDone).length+workouts.filter(w=>w.data.done).length+meals.filter(m=>m.data.eaten).length;
 const dateLabel=new Date(`${today}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
 void dayOfMonth;

 const next=tasks.find(t=>!t.data.done);const left=total-done;
 const stats=[{icon:<CheckCircle2 size={16}/>,label:'Tasks',a:tasks.filter(t=>t.data.done).length,b:tasks.length,tone:'mint'},{icon:<Flame size={16}/>,label:'Habits',a:habits.filter(habitDone).length,b:habits.length,tone:'amber'},{icon:<Dumbbell size={16}/>,label:'Workout',a:workouts.filter(w=>w.data.done).length,b:workouts.length,tone:'blue'},{icon:<Utensils size={16}/>,label:'Meals',a:meals.filter(m=>m.data.eaten).length,b:meals.length,tone:'rose'}];
 const kcalDone=Math.round(day.eaten.calories);
 return <div className="today-view">
  <Entrance className="panel today-hero"><div className="today-hero-main"><span className="eyebrow">{dateLabel.toUpperCase()}</span><h2>{brief.greeting}</h2><p>{brief.line}</p>
   <div className="today-stats" role="list">{stats.map(x=><div role="listitem" key={x.label} className="today-stat" data-tone={x.tone}><span>{x.icon}{x.label}</span><strong>{x.b?`${x.a}/${x.b}`:'—'}</strong><Bar value={x.b?x.a/x.b*100:0} tone={x.tone}/></div>)}</div>
   {next?<div className="today-next"><Clock3 size={15}/><span>Up next</span><strong>{next.data.title}</strong><time>{clock(next.data.due,tz)}</time></div>:<div className="today-next calm"><Sparkles size={15}/><span>{total?left?`${left} to go today.`:'Everything done. Enjoy your evening.':'A clear day. Add something with the + on any card.'}</span></div>}
  </div><div className="today-ring" aria-label={`${done} of ${total} done today`}><Ring value={total?done/total*100:0}/><strong>{total?Math.round(done/total*100):0}%</strong><small>{done} of {total} done</small></div></Entrance>
  <div className="today-grid">
   <Entrance className="panel today-card"><CardHead tone="mint" icon={<CheckCircle2 size={17}/>} title="Tasks" count={tasks.length?`${tasks.filter(t=>t.data.done).length}/${tasks.length}`:undefined} href="/tasks" linkLabel="Open all tasks" add={()=>tools.add('task')} addLabel="Add a task"/>
    {tasks.length?<><Bar value={tasks.filter(t=>t.data.done).length/tasks.length*100} tone="mint"/><ul className="today-list">{tasks.slice(0,6).map(t=><li key={t.id} className={t.data.done?'is-done':''}><Tick checked={t.data.done} label={`Complete ${t.data.title}`} onChange={()=>tools.toggle(t)}/><button className="plain-button" onClick={()=>tools.edit(t)}>{t.data.title}</button>{!t.data.done&&localDate(t.data.due,tz)<today&&<span className="overdue">Overdue</span>}<time>{clock(t.data.due,tz)}</time></li>)}</ul></>:<Nothing icon={<CheckCircle2 size={22}/>} text="Nothing due today. Capture one thing you want to finish." cta="Add task" onClick={()=>tools.add('task')}/>}</Entrance>
   <Entrance className="panel today-card"><CardHead tone="amber" icon={<Flame size={17}/>} title="Habits" count={habits.length?`${habits.filter(habitDone).length}/${habits.length}`:undefined} href="/tasks#habits" linkLabel="Open habit checklist" add={()=>tools.add('habit')} addLabel="Add a habit"/>
    {habits.length?<><Bar value={habits.filter(habitDone).length/habits.length*100} tone="amber"/><ul className="today-list">{habits.slice(0,6).map(h=><li key={h.id} className={habitDone(h)?'is-done':''}><Tick checked={habitDone(h)} label={`Complete ${h.data.title} today`} onChange={()=>completeHabit(h,today)}/><span>{h.data.title}</span></li>)}</ul></>:<Nothing icon={<Flame size={22}/>} text="No habits scheduled today. Small routines add up." cta="Add habit" onClick={()=>tools.add('habit')}/>}</Entrance>
   <Entrance className="panel today-card"><CardHead tone="blue" icon={<Dumbbell size={17}/>} title="Workout" count={workouts.length?`${workouts.filter(w=>w.data.done).length}/${workouts.length}`:undefined} href="/fitness" linkLabel="Open fitness" add={()=>tools.add('workout',{date:today})} addLabel="Plan a workout"/>
    {workouts.length?<ul className="today-list">{workouts.map(w=><li key={w.id} className={w.data.done?'is-done':''}><Tick locked={!!w.data.done} checked={!!w.data.done} label={`Complete workout ${w.data.title}`} onChange={()=>tools.toggle(w)}/><button className="plain-button" onClick={()=>tools.edit(w)}>{w.data.title}</button><small>{w.data.duration} min · ≈{burnEstimate(w.data.type,w.data.duration,w.data.intensity||'Moderate')} kcal</small></li>)}</ul>:<Nothing icon={<Dumbbell size={22}/>} text="No workout planned. Even 15 minutes counts." cta="Plan workout" onClick={()=>tools.add('workout',{date:today})}/>}
    <p className="today-foot">This week: {review.current.workouts?`${review.current.workouts} workouts · ${review.current.workoutMinutes} min`:'no workouts yet'}</p></Entrance>
   <Entrance className="panel today-card"><CardHead tone="rose" icon={<Utensils size={17}/>} title="Meals" count={meals.length?`${meals.filter(m=>m.data.eaten).length}/${meals.length}`:undefined} href="/meals" linkLabel="Open meals" add={()=>tools.add('meal',{date:today})} addLabel="Plan a meal"/>
    {meals.length?<ul className="today-list">{meals.map(m=><li key={m.id} className={m.data.eaten?'is-done':''}><Tick checked={!!m.data.eaten} label={`Eaten ${m.data.title}`} onChange={()=>tools.toggle(m,'eaten')}/><button className="plain-button" onClick={()=>tools.edit(m)}>{m.data.title}</button><small>{m.data.slot}</small></li>)}</ul>:<Nothing icon={<Utensils size={22}/>} text="No meals planned. Plan one to track your day." cta="Plan meal" onClick={()=>tools.add('meal',{date:today})}/>}
    {target&&<div className="today-kcal-row"><span>{kcalDone} of {target.data.calories} kcal</span><Bar value={pct(day.eaten.calories,target.data.calories)} tone="rose"/></div>}</Entrance>
   <Entrance className="panel today-card"><CardHead tone="violet" icon={<Receipt size={17}/>} title="Bills this week" count={bills.length?String(bills.length):undefined} href="/finance/bills" linkLabel="Open bills" add={()=>tools.add('cashPlan',{type:'expense',category:'Bills'})} addLabel="Add a bill"/>
    {bills.length?<><ul className="today-list">{bills.map(({plan,date})=><li key={plan.id}><span className="today-bill-dot"/><span>{plan.data.title}</span><time>{date===today?'Today':new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(),{weekday:'short',day:'numeric',timeZone:'UTC'})}</time><strong>{money(plan.data.amount,plan.data.currency)}</strong></li>)}</ul><p className="today-foot">Due soon: {money(bills.reduce((n,b)=>n+b.plan.data.amount,0),currency)}</p></>:<Nothing icon={<Receipt size={22}/>} text="No bills due in the next 7 days." cta="Add bill" onClick={()=>tools.add('cashPlan',{type:'expense',category:'Bills'})}/>}</Entrance>
   <Entrance className="panel today-card"><CardHead tone="mint" icon={<Target size={17}/>} title="Goals" count={goals.length?String(goals.length):undefined} href="/goals" linkLabel="Open goals" add={()=>tools.add('goal')} addLabel="Add a goal"/>
    {goals.length?<ul className="today-goals">{goals.map(({g,p})=><li key={g.id}><div><Link href={`/goals/${g.id}`}>{g.data.title}</Link><small>{Math.round(p.percentage)}% · by {g.data.deadline}</small></div><Bar value={p.percentage} tone="mint"/></li>)}</ul>:<Nothing icon={<Target size={22}/>} text="No active goals. Pick one thing worth working towards." cta="Add goal" onClick={()=>tools.add('goal')}/>}</Entrance>
  </div>
  <Entrance className="panel today-review"><div className="panel-heading"><div><span className="eyebrow">WEEKLY REVIEW</span><h2>Your last 7 days</h2><p>Numbers come from your own records.</p></div><Link className="button" href="/reports">Full report <ArrowRight size={14}/></Link></div>
   {(()=>{const c=review.current,p=review.previous,delta=p.expenses?Math.round((c.expenses-p.expenses)/p.expenses*100):null;const cards=[{icon:<CheckCircle2 size={18}/>,label:'Tasks done',value:c.tasksDue?`${c.tasksDone}/${c.tasksDue}`:'None due',pct:c.tasksDue?c.tasksDone/c.tasksDue*100:0,tone:c.tasksDue&&c.tasksDone===c.tasksDue?'good':''},{icon:<Flame size={18}/>,label:'Habits',value:c.habitRate===null?'No habits':`${Math.round(c.habitRate)}%`,pct:c.habitRate||0,tone:c.habitRate!==null&&c.habitRate>=80?'good':c.habitRate!==null&&c.habitRate<50?'warn':''},{icon:<Dumbbell size={18}/>,label:'Workouts',value:c.workouts?`${c.workouts} · ${c.workoutMinutes} min`:'None yet',pct:Math.min(100,c.workouts/4*100),tone:c.workouts?'good':''},{icon:<Receipt size={18}/>,label:'Spent',value:money(c.expenses,s.profile.currency),sub:delta===null?'':`${delta>0?'+':''}${delta}% vs last week`,pct:0,tone:delta!==null&&delta>25?'warn':delta!==null&&delta<0?'good':''}];return <div className="wr-stats">{cards.map(x=><div key={x.label} className={`wr-stat ${x.tone}`}><span className="wr-icon">{x.icon}</span><div><span>{x.label}</span><strong>{x.value}</strong>{x.sub&&<small>{x.sub}</small>}{x.label!=='Spent'&&<Bar value={x.pct} tone={x.tone==='warn'?'rose':'mint'}/>}</div></div>)}</div>;})()}
   <div className="today-review-grid"><div className="wr-col wins"><h3><TrendingUp size={16}/> Wins</h3>{review.wins.length?<ul>{review.wins.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">Log a few days and your wins appear here.</p>}</div><div className="wr-col watch"><h3><TrendingDown size={16}/> To watch</h3>{review.slips.length?<ul>{review.slips.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">Nothing slipping. Keep going.</p>}</div><div className="wr-col next"><h3><CalendarDays size={16}/> Focus next</h3>{review.focus.length?<ul>{review.focus.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">You are on track.</p>}</div></div></Entrance>
 </div>;
}
