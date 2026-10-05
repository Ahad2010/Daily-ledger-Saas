import { ArrowUpRight, Wallet, CircleCheck, Clock3, CalendarDays, Target, ShoppingBag, TrendingUp, Flame } from 'lucide-react';
import { metrics,money,goalProgress,recordsOf,localDate,type Snapshot } from '@ledger/shared';
import { Entrance,AnimatedText } from './animation';
type Metrics=ReturnType<typeof metrics>;
type Item={label:string;value:string;detail:string;icon:typeof Wallet;tone?:string};
export function FeatureInsights({path,s,m,today}:{path:string;s:Snapshot;m:Metrics;today:string}){
 let items:Item[]=[];
 if(path==='finance')items=[{label:'Money in',value:money(m.income,m.currency),detail:m.incomeChange===null?'No prior-period comparison':`${Math.round(m.incomeChange)}% vs equivalent previous period`,icon:Wallet},{label:'Money out',value:money(m.expenses,m.currency),detail:`${m.categories.length} spending categories`,icon:ArrowUpRight},{label:'Net savings',value:money(m.saved,m.currency),detail:m.income?`${Math.round(m.saved/m.income*100)}% of income retained`:'Add income to see your savings rate',icon:TrendingUp,tone:m.saved>=0?'mint':'error'},{label:'Budget remaining',value:m.budget?money(m.budget-m.expenses,m.currency):'Not set',detail:m.budget?`${Math.round(m.expenses/m.budget*100)}% of your plan used`:'Set a spending limit for this month',icon:Target,tone:m.budget&&m.expenses>m.budget?'error':undefined}];
 if(path==='tasks'){
  const tasks=recordsOf(s.records,'task').filter(r=>localDate(r.data.due,s.profile.timezone).startsWith(m.month));const open=tasks.filter(r=>!r.data.done);const due=open.filter(r=>localDate(r.data.due,s.profile.timezone)<=today);const completed=tasks.length-open.length;
  items=[{label:'Needs attention',value:String(due.length),detail:'Open tasks due through today',icon:Clock3},{label:'Completed',value:String(completed),detail:`Out of ${tasks.length} tasks in this month`,icon:CircleCheck,tone:'mint'},{label:'Habit consistency',value:m.habitRate===null?'—':`${Math.round(m.habitRate)}%`,detail:'Scheduled days only; rest days excluded',icon:Flame},{label:'Active habits',value:String(recordsOf(s.records,'habit').filter(r=>r.data.active).length),detail:'Small steps, kept consistently',icon:CalendarDays}];
 }
 if(path==='fitness'){
  const w=recordsOf(s.records,'workout').filter(r=>r.data.done&&r.data.date.startsWith(m.month)&&r.data.date<=m.end);const days=new Set(w.map(r=>r.data.date));const minutes=w.reduce((sum,r)=>sum+r.data.duration,0);
  items=[{label:'Sessions',value:String(w.length),detail:'Completed workouts this month',icon:Flame},{label:'Active days',value:String(days.size),detail:'Distinct days with a workout',icon:CalendarDays},{label:'Time invested',value:`${minutes} min`,detail:'Total recorded training time',icon:Clock3},{label:'Average session',value:w.length?`${Math.round(minutes/w.length)} min`:'—',detail:w.length?'Based on completed sessions':'Complete a workout to get started',icon:TrendingUp}];
 }
 if(path==='meals'){
  const meals=recordsOf(s.records,'meal').filter(r=>r.data.date.startsWith(m.month));const groceries=recordsOf(s.records,'grocery');const pending=groceries.filter(r=>!r.data.done);const cost=pending.filter(r=>r.data.currency===m.currency).reduce((sum,r)=>sum+r.data.cost,0);
  items=[{label:'Meals planned',value:String(meals.length),detail:'Breakfast, lunch, dinner and snacks',icon:CalendarDays},{label:'Shopping left',value:String(pending.length),detail:`${groceries.filter(r=>r.data.done).length} items already purchased`,icon:ShoppingBag},{label:'Estimated remaining',value:money(cost,m.currency),detail:`Shopping estimates in ${m.currency} only`,icon:Wallet},{label:'Days covered',value:String(new Set(meals.map(r=>r.data.date)).size),detail:'Dates with at least one planned meal',icon:CircleCheck}];
 }
 if(path==='goals'){
  const goals=recordsOf(s.records,'goal').filter(r=>r.data.active);const done=goals.filter(r=>goalProgress(r,s.records).done);const milestones=recordsOf(s.records,'milestone').filter(r=>goals.some(g=>g.id===r.data.goalId));
  items=[{label:'Active goals',value:String(goals.length),detail:'Your current priorities',icon:Target},{label:'Targets reached',value:String(done.length),detail:'Completed steps or your amount target reached',icon:CircleCheck,tone:'mint'},{label:'Milestones checked',value:String(milestones.filter(r=>r.data.done).length),detail:`Out of ${milestones.length} active-goal milestones`,icon:CalendarDays},{label:'Past target date',value:String(goals.filter(r=>r.data.deadline<today&&r.data.current<r.data.target).length),detail:'Review the plan or adjust the timeline',icon:Clock3}];
 }
 if(!items.length)return null;
 return <div className="insight-grid">{items.map(({label,value,detail,icon:Icon,tone})=><Entrance className="insight-card" key={label}><div><span>{label}</span><Icon size={16}/></div><AnimatedText value={value} className={tone}/><p>{detail}</p></Entrance>)}</div>;
}
export function FinanceGuidance({m}:{m:Metrics}){
 const top=m.categories[0];const days=Number(m.end.slice(-2));const remaining=m.budget?m.budget-m.expenses:null;
 return <div className="finance-guidance"><div><span className="insight-kicker">MONTHLY PULSE</span><h2>{remaining===null?'Give your spending a plan':remaining<0?'Your spending has passed your budget':`${money(remaining,m.currency)} left in your spending plan`}</h2><p>{remaining===null?'Add a monthly budget to see what is still available.':`${money(m.expenses,m.currency)} spent of ${money(m.budget,m.currency)} planned. ${m.partial?'This month is still in progress.':'This period is complete.'}`}</p></div><div><span>Daily spending average</span><strong>{m.expenses?money(Math.round(m.expenses/days),m.currency):'—'}</strong><small>{m.expenses?`Over ${days} calendar days`:'No expenses recorded'}</small></div><div><span>Largest spending category</span><strong>{top?.name||'—'}</strong><small>{top?`${money(top.amount,m.currency)} · ${Math.round(top.percentage)}% of spending`:'Add an expense to see your breakdown'}</small></div></div>;
}
