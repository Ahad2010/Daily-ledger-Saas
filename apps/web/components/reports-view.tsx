'use client';
import Link from 'next/link';
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {Download,ArrowUpRight,ArrowDownRight,CircleCheck,TriangleAlert,Target,Plus} from 'lucide-react';
import {monthReport,weeklyReview,metrics,goalProgress,recordsOf,money,plans,localDate,type Snapshot} from '@ledger/shared';
import {Entrance,AnimatedProgress} from './animation';
import {Button} from './ui/button';
import {UsageMeter} from './usage-meter';
import {adapter,demoMode,download} from '../lib/data';

const monthLabel=(month:string)=>new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
const dayLabel=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
const pct=(value:number|null)=>value===null?'—':`${Math.round(value)}%`;

// "good" says which direction is healthy: more income is good, more spending is not.
function Delta({value,good,label,compact=false}:{value:number|null;good:'up'|'down';label:string;compact?:boolean}){
 if(value===null)return <small className="rp-delta rp-flat">{compact?'—':`No earlier ${label} to compare`}</small>;
 if(Math.abs(value)<.5)return <small className="rp-delta rp-flat">No change vs {label}</small>;
 const up=value>0,healthy=good==='up'?up:!up;
 return <small className={`rp-delta ${healthy?'rp-good':'rp-bad'}`}>{up?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>}{Math.abs(Math.round(value))}% vs {label}</small>;
}
function ChartTip({active,payload,label,currency}:{active?:boolean;payload?:readonly {name?:string;value?:number|string;color?:string}[];label?:string|number;currency:string}){
 if(!active||!payload?.length)return null;
 return <div className="dark-tooltip"><strong>{label}</strong>{payload.map(p=><div key={p.name}><i style={{background:p.color}}/><span>{p.name}</span><b>{money(Number(p.value)*100,currency)}</b></div>)}</div>;
}

export function ReportsView({s,month,asOf,exportReport,notify,onUpgrade}:{s:Snapshot;month:string;asOf:Date;exportReport:()=>void;notify:(v:string)=>void;onUpgrade:(reason:string)=>void}){
 const {currency,timezone}=s.profile,plan=plans[s.profile.plan],today=localDate(asOf,timezone);
 if(!plan.history&&month!==today.slice(0,7))return <Entrance className="panel"><h2>Historical monthly reports</h2><p className="muted">Choose the current month for your Free report. Pro and Lifetime include report history. Your records and full workspace export remain available.</p><Link href="/plans" className="button">View plans</Link></Entrance>;
 const report=monthReport(s.records,month,currency,timezone,asOf),m=metrics(s.records,month,currency,timezone,asOf),c=report.current;
 const review=month===today.slice(0,7)?weeklyReview(s.records,{currency,timezone,asOf}):null;
 const goals=recordsOf(s.records,'goal').filter(g=>g.data.active).map(g=>({goal:g,progress:goalProgress(g,s.records)}));
 const previousLabel=report.partial?`same days of ${monthLabel(report.previousMonth).split(' ')[0]}`:monthLabel(report.previousMonth).split(' ')[0];
 const chart=report.weeks.map(w=>({week:w.label,Income:w.income/100,Expenses:w.expenses/100}));
 const pdf=async()=>{try{if(!plan.pdf){onUpgrade('PDF reports are included with Pro and Lifetime.');return;}if(demoMode){notify('PDF export is available through the connected API on Pro and Lifetime. CSV works in demo mode.');return;}download(await adapter.pdf(month),`daily-ledger-${month}.pdf`);}catch(e){notify((e as Error).message);}};
 return <div className="report-page">
  <Entrance className="panel report-panel report-hero"><div className="report-heading"><span className="eyebrow">MONTHLY REPORT</span><h2>{monthLabel(month)}</h2><p className="muted">{report.partial?'Month to date':'Full month'} · {currency} · through {dayLabel(report.end)}</p></div>
   <div className="inline-actions"><Button variant="primary" onClick={exportReport}><Download size={16}/>Export CSV</Button><Button onClick={()=>void pdf()}><Download size={16}/>Export PDF {!plan.pdf&&'· Paid'}</Button></div></Entrance>
  {!report.hasData?<Entrance className="panel report-empty"><h3>Nothing to report for {monthLabel(month)} yet</h3><p className="muted">Add transactions, tasks, habits or workouts and your report fills in automatically.</p><div className="inline-actions"><Link className="button primary" href="/finance/transactions"><Plus size={15}/>Add transactions</Link><Link className="button" href="/tasks">Plan tasks</Link></div></Entrance>:<>
  <div className="report-kpis">
   <Entrance className="panel report-kpi"><span>Income</span><strong>{money(c.income,currency)}</strong><Delta value={report.changes.income} good="up" label={previousLabel}/></Entrance>
   <Entrance className="panel report-kpi"><span>Expenses</span><strong>{money(c.expenses,currency)}</strong><Delta value={report.changes.expenses} good="down" label={previousLabel}/></Entrance>
   <Entrance className="panel report-kpi"><span>Net savings</span><strong className={c.net<0?'negative':''}>{money(c.net,currency)}</strong><small className="rp-delta rp-flat">{m.savingsRate===null?'Savings rate needs income':`${pct(m.savingsRate)} savings rate`}</small></Entrance>
   <Entrance className="panel report-kpi"><span>Budget</span>{m.budget?<><strong>{money(m.budget,currency)}</strong><UsageMeter used={c.expenses} limit={m.budget} label="Budget"/><small className={`rp-delta ${(m.budgetUsage||0)>=80?'rp-bad':'rp-flat'}`}>{pct(m.budgetUsage)} used · {money(Math.max(0,m.budget-c.expenses),currency)} left</small></>:<><strong>—</strong><small className="rp-delta rp-flat">No budget set for this month</small></>}</Entrance>
  </div>
  {review&&<Entrance className="panel report-review"><div className="panel-heading"><div><span className="eyebrow">WEEKLY REVIEW</span><h2>Your week in review</h2><p>{dayLabel(review.current.from)} – {dayLabel(review.current.to)} compared with the 7 days before.</p></div></div>
   {review.empty?<p className="muted">Add transactions, tasks or habits and your weekly review appears here.</p>:<>
   <div className="review-stats">
    <div><small>Spent</small><strong>{money(review.current.expenses,currency)}</strong><span>was {money(review.previous.expenses,currency)}</span></div>
    <div><small>Income</small><strong>{money(review.current.income,currency)}</strong><span>was {money(review.previous.income,currency)}</span></div>
    <div><small>Tasks done</small><strong>{review.current.tasksDone} / {review.current.tasksDue}</strong><span>was {review.previous.tasksDone} / {review.previous.tasksDue}</span></div>
    <div><small>Habits</small><strong>{pct(review.current.habitRate)}</strong><span>was {pct(review.previous.habitRate)}</span></div>
    <div><small>Movement</small><strong>{review.current.workoutMinutes} min</strong><span>was {review.previous.workoutMinutes} min</span></div></div>
   <div className="review-columns">
    <div className="review-col review-good"><h3><CircleCheck size={16}/>What went well</h3>{review.wins.length?<ul>{review.wins.map(t=><li key={t}>{t}</li>)}</ul>:<p className="muted">Complete tasks, habits or workouts to see wins here.</p>}</div>
    <div className="review-col review-slip"><h3><TriangleAlert size={16}/>What slipped</h3>{review.slips.length?<ul>{review.slips.map(t=><li key={t}>{t}</li>)}</ul>:<p className="muted">Nothing to flag this week.</p>}</div>
    <div className="review-col review-focus"><h3><Target size={16}/>Focus for next week</h3><ul>{review.focus.map(t=><li key={t}>{t}</li>)}</ul></div></div></>}
  </Entrance>}
  <Entrance className="panel report-weeks"><div className="panel-heading"><div><h2>Week by week</h2><p>Monday to Sunday, clipped to {monthLabel(month)}. Totals match the monthly figures above.</p></div></div>
   <div className="report-chart" role="img" aria-label={`Weekly income and expenses for ${monthLabel(month)}. Income ${money(c.income,currency)}, expenses ${money(c.expenses,currency)}.`}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:8,right:6,left:-12,bottom:0}}><CartesianGrid vertical={false} stroke="#303030" strokeDasharray="3 4"/><XAxis dataKey="week" tick={{fill:'#aaaeb5',fontSize:11}} stroke="#4a4a4a" interval={0} tickFormatter={value=>String(value).split(' – ')[0]}/><YAxis tick={{fill:'#aaaeb5',fontSize:11}} stroke="#4a4a4a" tickFormatter={n=>money(n*100,currency).replace(/,000/,'k')}/><Tooltip cursor={{fill:'#ffffff08'}} content={<ChartTip currency={currency}/>}/><Bar dataKey="Income" fill="#9bd4f5" radius={[4,4,0,0]} isAnimationActive={false} maxBarSize={34}/><Bar dataKey="Expenses" fill="#80e4bd" radius={[4,4,0,0]} isAnimationActive={false} maxBarSize={34}/></BarChart></ResponsiveContainer></div>
   <div className="chart-legend"><span><i style={{background:'#9bd4f5'}}/>Income</span><span><i style={{background:'#80e4bd'}}/>Expenses</span></div>
   <div className="table-scroll"><table><thead><tr><th>Week</th><th>Income</th><th>Expenses</th><th>Net</th><th>Tasks</th><th>Habits</th><th>Movement</th></tr></thead><tbody>{report.weeks.map(w=><tr key={w.from}><td>{w.label}</td><td>{money(w.income,currency)}</td><td>{money(w.expenses,currency)}</td><td className={w.net<0?'negative':w.net>0?'positive':''}>{money(w.net,currency)}</td><td>{w.tasksDue?`${w.tasksDone} / ${w.tasksDue}`:'—'}</td><td>{pct(w.habitRate)}</td><td>{w.workoutMinutes?`${w.workoutMinutes} min`:'—'}</td></tr>)}</tbody></table></div></Entrance>
  {report.categories.length>0&&<Entrance className="panel report-categories"><div className="panel-heading"><div><h2>Spending by category</h2><p>Share of {money(c.expenses,currency)} · change compared with {previousLabel}.</p></div></div>
   <div className="category-rows">{report.categories.map(cat=><div className="category-row" key={cat.name}><div><strong>{cat.name}</strong><span>{money(cat.amount,currency)} · {Math.round(cat.percentage)}%</span></div><div className="category-bar"><i style={{width:`${Math.min(100,cat.percentage)}%`}}/></div><Delta value={cat.change} good="down" label={previousLabel} compact/></div>)}</div></Entrance>}
  {goals.length>0&&<Entrance className="panel report-goals"><div className="panel-heading"><div><h2>Goal progress</h2><p>Current progress on your active goals.</p></div></div>{goals.map(({goal,progress})=><div className="report-goal" key={goal.id}><div><strong>{goal.data.title}</strong><span>{progress.current.toLocaleString()} / {progress.target.toLocaleString()} {goal.data.tracking==='steps'?'steps':goal.data.unit} · due {goal.data.deadline}</span></div><AnimatedProgress value={progress.percentage}/></div>)}</Entrance>}
  </>}
  <p className="muted report-note">Income comparison uses {report.partial?'the same days of the previous month':'the previous month'}. Task completion counts tasks due in the period. Habit completion counts scheduled occurrences only. Totals include {currency} transactions; transfers are excluded.</p>
 </div>;
}
