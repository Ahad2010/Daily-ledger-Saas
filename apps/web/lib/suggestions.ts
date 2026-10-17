import {effectiveLimits,goalProgress,localDate,recordsOf,type Kind,type Snapshot} from '@ledger/shared';
export type Suggestion={id:string;tone:'tip'|'nudge'|'upgrade';text:string;action?:{label:string;kind?:Kind;initial?:Record<string,unknown>;href?:string}};
const dayMs=86400000;
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*dayMs).toISOString().slice(0,10);
// Page suggestions come only from the user's own records. Each one points at a real action; upgrade nudges appear only near a real limit.
export function pageSuggestions(page:string,s:Snapshot,today:string):Suggestion[]{
 const tz=s.profile.timezone;const out:Suggestion[]=[];const limits=effectiveLimits(s);const month=today.slice(0,7);
 const tasks=recordsOf(s.records,'task'),habits=recordsOf(s.records,'habit').filter(h=>h.data.active),goals=recordsOf(s.records,'goal').filter(g=>g.data.active);
 const openTasks=tasks.filter(t=>!t.data.done),overdue=openTasks.filter(t=>localDate(t.data.due,tz)<today);
 const tomorrow=shift(today,1);
 const nearLimit=(used:number,limit:number)=>Number.isFinite(limit)&&limit>0&&used>=Math.ceil(limit*.8);
 const upgrade=(id:string,text:string)=>{if(s.profile.plan==='Free')out.push({id,tone:'upgrade',text,action:{label:'See Pro',href:'/plans'}});};
 if(page==='tasks'||page===''){
  if(overdue.length)out.push({id:'overdue',tone:'nudge',text:`${overdue.length} ${overdue.length===1?'task is':'tasks are'} overdue. Finish them or move them to a better day.`,action:{label:'Review tasks',href:'/tasks'}});
  if(page==='tasks'&&!openTasks.some(t=>localDate(t.data.due,tz)===tomorrow))out.push({id:'tomorrow',tone:'tip',text:'Nothing is planned for tomorrow yet. One small step is enough.',action:{label:'Add task',kind:'task',initial:{due:`${tomorrow}T09:00:00.000Z`}}});
  if(page==='tasks'&&!habits.length)out.push({id:'first-habit',tone:'tip',text:'Routines make days easier. Add your first habit.',action:{label:'Add habit',kind:'habit'}});
  if(nearLimit(openTasks.length,limits.tasks))upgrade('tasks-limit',`You are using ${openTasks.length} of ${limits.tasks} open tasks on Free. Pro removes the limit.`);
 }
 if(page==='finance'||page===''){
  const budgets=recordsOf(s.records,'budget').filter(b=>b.data.currency===s.profile.currency);
  const income=recordsOf(s.records,'transaction').some(t=>t.data.type==='income'&&t.data.date.startsWith(month));
  if(limits.finance&&!budgets.length)out.push({id:'no-budget',tone:'tip',text:'Set a monthly budget to see your spending pace.',action:{label:'Set a budget',href:`/finance/budgets?month=${month}`}});
  if(page==='finance'&&!income)out.push({id:'no-income',tone:'tip',text:'No income recorded this month. Add it to see your savings rate.',action:{label:'Add income',kind:'transaction',initial:{type:'income',category:'Salary'}}});
  if(page==='finance'&&limits.finance&&!recordsOf(s.records,'cashPlan').some(p=>p.data.type==='expense'))out.push({id:'no-bills',tone:'tip',text:'Add your regular bills to see what is left after them.',action:{label:'Add bills',href:`/finance/bills?month=${month}`}});
 }
 if(page==='fitness'){
  const week=shift(today,-6);const done=recordsOf(s.records,'workout').filter(w=>w.data.done&&w.data.date>=week&&w.data.date<=today).length;
  if(!done)out.push({id:'no-workout',tone:'nudge',text:'No workout completed in the last 7 days. Even 15 minutes counts.',action:{label:'Log a workout',kind:'workout'}});
  if(!recordsOf(s.records,'workout').some(w=>!w.data.done&&w.data.date>=today))out.push({id:'plan-workout',tone:'tip',text:'Nothing planned ahead. Schedule your next session.',action:{label:'Schedule a session',kind:'workout',initial:{date:tomorrow}}});
 }
 if(page==='meals'){
  if(!recordsOf(s.records,'meal').some(m=>m.data.date===tomorrow))out.push({id:'plan-tomorrow',tone:'tip',text:'Tomorrow’s meals are not planned yet.',action:{label:'Open planner',href:'/meals/planner'}});
  const toBuy=recordsOf(s.records,'grocery').filter(g=>!g.data.done).length;
  if(toBuy)out.push({id:'groceries',tone:'nudge',text:`${toBuy} grocery ${toBuy===1?'item is':'items are'} still to buy.`});
 }
 if(page==='goals'||page===''){
  if(page==='goals'&&!goals.length)out.push({id:'first-goal',tone:'tip',text:'Give something meaningful a target.',action:{label:'Create goal',kind:'goal'}});
  const soon=goals.map(g=>({g,days:Math.ceil((new Date(`${g.data.deadline}T12:00:00Z`).getTime()-new Date(`${today}T12:00:00Z`).getTime())/dayMs),pct:goalProgress(g,s.records).percentage})).filter(x=>x.days>=0&&x.days<=14&&(x.pct??0)<100).sort((a,b)=>a.days-b.days)[0];
  if(soon)out.push({id:'goal-soon',tone:'nudge',text:`${soon.g.data.title} is due in ${soon.days} ${soon.days===1?'day':'days'} and is ${Math.round(soon.pct??0)}% there.`,action:{label:'Open goal',href:`/goals/${soon.g.id}`}});
  if(page==='goals'&&nearLimit(goals.length,limits.goals))upgrade('goals-limit',`You are using ${goals.length} of ${limits.goals} active goals on Free. Pro removes the limit.`);
 }
 // Smart suggestions are a paid feature; Free keeps only the upgrade nudge that appears near a real limit.
 return (limits.ai?out:out.filter(item=>item.tone==='upgrade')).slice(0,3);
}
