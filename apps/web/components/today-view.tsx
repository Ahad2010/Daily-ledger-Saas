'use client';
import Link from 'next/link';
import {ArrowRight,CalendarDays,CheckCircle2,Dumbbell,Flame,Receipt,Sparkles,TrendingDown,TrendingUp,Utensils} from 'lucide-react';
import {goalProgress,localDate,money,recordsOf,weeklyReview,type Kind,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {dailyBrief} from '../lib/daily-brief';
import {dayNutrition,nutritionTarget,pct} from '../lib/nutrition';
import {Entrance,Ring} from './animation';
import {HabitToggle} from './habit-checklist';
import {Button} from './ui/button';

type Tools={add:(kind:Kind,initial?:Record<string,unknown>)=>void;edit:(r:LedgerRecord)=>void;toggle:(r:LedgerRecord,key?:string)=>void};
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
const clock=(iso:string,timezone:string)=>new Date(iso).toLocaleTimeString('en-US',{timeZone:timezone,hour:'numeric',minute:'2-digit'});

// One screen for the day: what is due, what is planned, what has been eaten, which bills are close, and last week in short.
export function TodayView({s,today,asOf,tools,completeHabit,pending}:{s:Snapshot;today:string;asOf:Date;tools:Tools;completeHabit:(h:LedgerRecord<'habit'>,d:string)=>void;pending:boolean}){
 const tz=s.profile.timezone,currency=s.profile.currency;const brief=dailyBrief(s,asOf);
 const tasks=recordsOf(s.records,'task').filter(t=>localDate(t.data.due,tz)<=today&&(!t.data.done||localDate(t.data.completedAt||t.data.due,tz)===today)).sort((a,b)=>Number(a.data.done)-Number(b.data.done)||a.data.due.localeCompare(b.data.due));
 const weekday=new Date(`${today}T12:00:00Z`).getUTCDay();const completions=recordsOf(s.records,'completion');
 const habits=recordsOf(s.records,'habit').filter(h=>h.data.active&&h.data.startDate<=today&&h.data.days.includes(weekday));
 const habitDone=(h:LedgerRecord<'habit'>)=>completions.some(c=>c.data.habitId===h.id&&c.data.date===today);
 const workouts=recordsOf(s.records,'workout').filter(w=>w.data.date===today);
 const meals=recordsOf(s.records,'meal').filter(m=>m.data.date===today);
 const day=dayNutrition(s,today),target=nutritionTarget(s);
 const dayOfMonth=Number(today.slice(8));const lastDay=(month:string)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
 const bills=recordsOf(s.records,'cashPlan').filter(p=>p.data.active&&p.data.type==='expense').map(p=>{const upcoming=Array.from({length:8},(_,i)=>shift(today,i)).find(d=>Math.min(p.data.day,lastDay(d.slice(0,7)))===Number(d.slice(8)));return upcoming?{plan:p,date:upcoming}:null;}).filter((x):x is {plan:LedgerRecord<'cashPlan'>;date:string}=>!!x).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
 const goals=recordsOf(s.records,'goal').filter(g=>g.data.active).map(g=>({g,p:goalProgress(g,s.records)})).filter(x=>!x.p.done).sort((a,b)=>a.g.data.deadline.localeCompare(b.g.data.deadline)).slice(0,2);
 const review=weeklyReview(s.records,{currency,timezone:tz,asOf});
 const total=tasks.length+habits.length+workouts.length+meals.length;
 const done=tasks.filter(t=>t.data.done).length+habits.filter(habitDone).length+workouts.filter(w=>w.data.done).length+meals.filter(m=>m.data.eaten).length;
 const dateLabel=new Date(`${today}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'});
 void dayOfMonth;
 return <div className="today-view">
  <Entrance className="panel today-hero"><div><span className="eyebrow">{dateLabel.toUpperCase()}</span><h2>{brief.greeting}</h2><p>{brief.line}</p><div className="inline-actions"><Button variant="primary" onClick={()=>tools.add('task')}>Add task</Button><Button onClick={()=>tools.add('meal',{date:today})}>Plan a meal</Button><Button onClick={()=>tools.add('workout',{date:today})}>Plan a workout</Button></div></div><div className="today-ring" aria-label={`${done} of ${total} done today`}><Ring value={total?done/total*100:0}/><small>{done} of {total} done</small></div></Entrance>
  <div className="today-grid">
   <Entrance className="panel today-card"><div className="panel-heading"><h2><CheckCircle2 size={18}/> Tasks</h2><Link href="/tasks">All tasks <ArrowRight size={14}/></Link></div>
    {tasks.length?<ul className="today-list">{tasks.slice(0,6).map(t=><li key={t.id}><HabitToggle checked={t.data.done} disabled={pending} label={`Complete ${t.data.title}`} onChange={()=>tools.toggle(t)}/><button className={'plain-button'+(t.data.done?' completed':'')} onClick={()=>tools.edit(t)}>{t.data.title}</button>{!t.data.done&&localDate(t.data.due,tz)<today&&<span className="overdue">Overdue</span>}<time>{clock(t.data.due,tz)}</time></li>)}</ul>:<p className="muted">Nothing due today. <button className="plain-button" onClick={()=>tools.add('task')}>Add one</button></p>}</Entrance>
   <Entrance className="panel today-card"><div className="panel-heading"><h2><Flame size={18}/> Habits</h2><Link href="/tasks#habits">Checklist <ArrowRight size={14}/></Link></div>
    {habits.length?<ul className="today-list">{habits.slice(0,6).map(h=><li key={h.id}><HabitToggle checked={habitDone(h)} disabled={pending} label={`Complete ${h.data.title} today`} onChange={()=>completeHabit(h,today)}/><span className={habitDone(h)?'completed':''}>{h.data.title}</span></li>)}</ul>:<p className="muted">No habits scheduled today. <button className="plain-button" onClick={()=>tools.add('habit')}>Add a habit</button></p>}</Entrance>
   <Entrance className="panel today-card"><div className="panel-heading"><h2><Dumbbell size={18}/> Workout</h2><Link href="/fitness">Fitness <ArrowRight size={14}/></Link></div>
    {workouts.length?<ul className="today-list">{workouts.map(w=><li key={w.id}><HabitToggle checked={!!w.data.done} disabled={pending} label={`Complete workout ${w.data.title}`} onChange={()=>tools.toggle(w)}/><button className={'plain-button'+(w.data.done?' completed':'')} onClick={()=>tools.edit(w)}>{w.data.title}</button><small>{w.data.duration} min</small></li>)}</ul>:<p className="muted">No workout planned. <button className="plain-button" onClick={()=>tools.add('workout',{date:today})}>Plan one</button></p>}</Entrance>
   <Entrance className="panel today-card"><div className="panel-heading"><h2><Utensils size={18}/> Meals</h2><Link href="/meals">Meals <ArrowRight size={14}/></Link></div>
    {meals.length?<ul className="today-list">{meals.map(m=><li key={m.id}><HabitToggle checked={!!m.data.eaten} disabled={pending} label={`Eaten ${m.data.title}`} onChange={()=>tools.toggle(m,'eaten')}/><button className={'plain-button'+(m.data.eaten?' completed':'')} onClick={()=>tools.edit(m)}>{m.data.title}</button><small>{m.data.slot}</small></li>)}</ul>:<p className="muted">No meals planned. <button className="plain-button" onClick={()=>tools.add('meal',{date:today})}>Plan a meal</button></p>}
    {target&&<p className="today-kcal">{Math.round(day.eaten.calories)} of {target.data.calories} kcal · {pct(day.eaten.calories,target.data.calories)}%</p>}</Entrance>
   <Entrance className="panel today-card"><div className="panel-heading"><h2><Receipt size={18}/> Bills this week</h2><Link href="/finance/bills">Bills <ArrowRight size={14}/></Link></div>
    {bills.length?<ul className="today-list">{bills.map(({plan,date})=><li key={plan.id}><span>{plan.data.title}</span><time>{date===today?'Today':new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',day:'numeric',timeZone:'UTC'})}</time><strong>{money(plan.data.amount,plan.data.currency)}</strong></li>)}</ul>:<p className="muted">No bills due in the next 7 days.</p>}</Entrance>
   <Entrance className="panel today-card"><div className="panel-heading"><h2><Sparkles size={18}/> Goals</h2><Link href="/goals">Goals <ArrowRight size={14}/></Link></div>
    {goals.length?<ul className="today-list">{goals.map(({g,p})=><li key={g.id}><Link href={`/goals/${g.id}`}>{g.data.title}</Link><small>{Math.round(p.percentage)}%</small><time>{g.data.deadline}</time></li>)}</ul>:<p className="muted">No active goals. <button className="plain-button" onClick={()=>tools.add('goal')}>Create one</button></p>}</Entrance>
  </div>
  <Entrance className="panel today-review"><div className="panel-heading"><div><span className="eyebrow">WEEKLY REVIEW</span><h2>Your last 7 days</h2><p>Numbers come from your own records.</p></div><Link className="button" href="/reports">Full report <ArrowRight size={14}/></Link></div>
   {(()=>{const c=review.current,p=review.previous,delta=p.expenses?Math.round((c.expenses-p.expenses)/p.expenses*100):null;const stats=[{label:'Tasks done',value:c.tasksDue?`${c.tasksDone}/${c.tasksDue}`:'None due',tone:c.tasksDue&&c.tasksDone===c.tasksDue?'good':''},{label:'Habits',value:c.habitRate===null?'No habits':`${Math.round(c.habitRate)}%`,tone:c.habitRate!==null&&c.habitRate>=80?'good':c.habitRate!==null&&c.habitRate<50?'warn':''},{label:'Workouts',value:c.workouts?`${c.workouts} · ${c.workoutMinutes} min`:'None yet',tone:c.workouts?'good':''},{label:'Spent',value:money(c.expenses,s.profile.currency),sub:delta===null?'':`${delta>0?'+':''}${delta}% vs last week`,tone:delta!==null&&delta>25?'warn':delta!==null&&delta<0?'good':''}];return <div className="wr-stats">{stats.map(x=><div key={x.label} className={`wr-stat ${x.tone}`}><span>{x.label}</span><strong>{x.value}</strong>{x.sub&&<small>{x.sub}</small>}</div>)}</div>;})()}
   <div className="today-review-grid"><div className="wr-col wins"><h3><TrendingUp size={16}/> Wins</h3>{review.wins.length?<ul>{review.wins.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">Log a few days and wins appear here.</p>}</div><div className="wr-col watch"><h3><TrendingDown size={16}/> To watch</h3>{review.slips.length?<ul>{review.slips.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">Nothing slipping.</p>}</div><div className="wr-col next"><h3><CalendarDays size={16}/> Focus next</h3>{review.focus.length?<ul>{review.focus.slice(0,3).map(w=><li key={w}>{w}</li>)}</ul>:<p className="muted">You are on track.</p>}</div></div></Entrance>
 </div>;
}
