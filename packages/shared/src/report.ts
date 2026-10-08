import {recordsOf,localDate,monthDates,metrics,money,calendarWeeks,reportRows,type LedgerRecord,type Snapshot} from './index';
import {budgetAlerts} from './finance';

// Deterministic report and weekly-review calculations. Every number comes from the customer's own records and uses
// the same definitions as the dashboard (tasks by local due date, scheduled habit occurrences, completed workouts).
export interface PeriodSummary{from:string;to:string;income:number;expenses:number;net:number;tasksDue:number;tasksDone:number;habitScheduled:number;habitDone:number;habitRate:number|null;workouts:number;workoutMinutes:number;categories:Record<string,number>}
export function addDays(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
function datesBetween(from:string,to:string){const out:string[]=[];for(let d=from;d<=to&&out.length<400;d=addDays(d,1))out.push(d);return out;}

export function periodSummary(records:LedgerRecord[],from:string,to:string,currency:string,timezone:string):PeriodSummary{
 const tx=recordsOf(records,'transaction').filter(r=>r.data.currency===currency&&r.data.date>=from&&r.data.date<=to);
 const income=tx.filter(r=>r.data.type==='income').reduce((n,r)=>n+r.data.amount,0),expenseRows=tx.filter(r=>r.data.type==='expense'),expenses=expenseRows.reduce((n,r)=>n+r.data.amount,0);
 const categories:Record<string,number>={};for(const r of expenseRows)categories[r.data.category]=(categories[r.data.category]||0)+r.data.amount;
 const tasks=recordsOf(records,'task').filter(r=>{const d=localDate(r.data.due,timezone);return d>=from&&d<=to;});
 const completions=new Set(recordsOf(records,'completion').map(r=>`${r.data.habitId}:${r.data.date}`));let habitScheduled=0,habitDone=0;
 for(const habit of recordsOf(records,'habit').filter(h=>h.data.active))for(const date of datesBetween(from,to)){if(date>=habit.data.startDate&&habit.data.days.includes(new Date(`${date}T12:00:00Z`).getUTCDay())){habitScheduled++;if(completions.has(`${habit.id}:${date}`))habitDone++;}}
 const workouts=recordsOf(records,'workout').filter(r=>r.data.done&&r.data.date>=from&&r.data.date<=to);
 return {from,to,income,expenses,net:income-expenses,tasksDue:tasks.length,tasksDone:tasks.filter(r=>r.data.done).length,habitScheduled,habitDone,habitRate:habitScheduled?habitDone/habitScheduled*100:null,workouts:workouts.length,workoutMinutes:workouts.reduce((n,r)=>n+r.data.duration,0),categories};
}

const short=(date:string)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
export function reportWeeks(month:string,end:string){
 const first=`${month}-01`,last=monthDates(month).at(-1)!;
 return calendarWeeks(month).map(week=>{const from=week[0]>first?week[0]:first,to=[week[6],end,last].sort()[0];return {from,to,label:from===to?short(from):`${short(from)} – ${short(to)}`};}).filter(w=>w.from<=w.to);
}

export function monthReport(records:LedgerRecord[],month:string,currency:string,timezone:string,asOf=new Date()){
 const m=metrics(records,month,currency,timezone,asOf),end=m.end;
 const weeks=reportWeeks(month,end).map(w=>({...w,...periodSummary(records,w.from,w.to,currency,timezone)}));
 const previousDate=new Date(`${month}-01T12:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-1);const previousMonth=previousDate.toISOString().slice(0,7);
 const previousEnd=m.partial?`${previousMonth}-${String(Math.min(Number(end.slice(-2)),monthDates(previousMonth).length)).padStart(2,'0')}`:monthDates(previousMonth).at(-1)!;
 const previous=periodSummary(records,`${previousMonth}-01`,previousEnd,currency,timezone),current=periodSummary(records,`${month}-01`,end,currency,timezone);
 const change=(now:number,before:number)=>before?(now-before)/before*100:null;
 const names=Array.from(new Set([...Object.keys(current.categories),...Object.keys(previous.categories)]));
 const categories=names.map(name=>{const amount=current.categories[name]||0,before=previous.categories[name]||0;return {name,amount,previous:before,percentage:current.expenses?amount/current.expenses*100:0,change:change(amount,before)};}).filter(c=>c.amount>0).sort((a,b)=>b.amount-a.amount);
 return {month,currency,end,partial:m.partial,previousMonth,previousEnd,current,previous,weeks,categories,changes:{income:change(current.income,previous.income),expenses:change(current.expenses,previous.expenses),net:previous.net?(current.net-previous.net)/Math.abs(previous.net)*100:null},hasData:current.income+current.expenses+current.tasksDue+current.habitScheduled+current.workouts>0||weeks.some(w=>w.income+w.expenses>0)};
}

export interface ReviewItem{text:string}
const plural=(n:number,word:string)=>`${n} ${word}${n===1?'':'s'}`;
export function weeklyReview(records:LedgerRecord[],input:{currency:string;timezone:string;asOf?:Date}){
 const asOf=input.asOf||new Date(),today=localDate(asOf,input.timezone),{currency,timezone}=input;
 const current=periodSummary(records,addDays(today,-6),today,currency,timezone),previous=periodSummary(records,addDays(today,-13),addDays(today,-7),currency,timezone);
 const wins:string[]=[],slips:string[]=[],focus:string[]=[];
 const money$=(n:number)=>money(n,currency);
 // Habits: which scheduled check-ins were missed in the last seven days.
 const completions=new Set(recordsOf(records,'completion').map(r=>`${r.data.habitId}:${r.data.date}`));
 const missedByHabit=recordsOf(records,'habit').filter(h=>h.data.active).map(h=>{let scheduled=0,missed=0;for(const date of datesBetween(current.from,current.to)){if(date>=h.data.startDate&&h.data.days.includes(new Date(`${date}T12:00:00Z`).getUTCDay())){scheduled++;if(!completions.has(`${h.id}:${date}`))missed++;}}return {title:h.data.title,scheduled,missed};}).filter(h=>h.missed>0).sort((a,b)=>b.missed-a.missed);
 const missedTotal=missedByHabit.reduce((n,h)=>n+h.missed,0);
 const overdue=recordsOf(records,'task').filter(r=>!r.data.done&&new Date(r.data.due)<asOf).sort((a,b)=>a.data.due.localeCompare(b.data.due));
 const alerts=budgetAlerts(records,today.slice(0,7),currency,today).sort((a,b)=>b.percent-a.percent);
 if(current.tasksDue>0){if(current.tasksDone===current.tasksDue)wins.push(`You completed every task due this week (${current.tasksDone}).`);else if(current.tasksDone>0)wins.push(`You completed ${current.tasksDone} of ${plural(current.tasksDue,'task')} due.`);else slips.push(`None of the ${plural(current.tasksDue,'task')} due this week were completed.`);}
 if(current.habitRate!==null){const rate=Math.round(current.habitRate);if(previous.habitRate!==null&&current.habitRate>previous.habitRate)wins.push(`Habit consistency rose to ${rate}% (from ${Math.round(previous.habitRate)}%).`);else if(rate>=80)wins.push(`Habit consistency was ${rate}%.`);}
 if(current.workouts>0)wins.push(`${plural(current.workouts,'workout')} · ${current.workoutMinutes} minutes of movement.`);
 if(previous.expenses>0&&current.expenses<previous.expenses)wins.push(`Spending fell by ${money$(previous.expenses-current.expenses)} compared with the previous 7 days.`);
 if(missedTotal>0)slips.push(`You missed ${plural(missedTotal,'scheduled habit check-in')} (${missedByHabit.slice(0,3).map(h=>`${h.title} ×${h.missed}`).join(', ')}).`);
 if(overdue.length)slips.push(`${plural(overdue.length,'task')} ${overdue.length===1?'is':'are'} overdue; the oldest is "${overdue[0].data.title}".`);
 if(previous.expenses>0&&current.expenses>previous.expenses)slips.push(`Spending rose by ${money$(current.expenses-previous.expenses)} (+${Math.round((current.expenses-previous.expenses)/previous.expenses*100)}%) compared with the previous 7 days.`);
 for(const alert of alerts.slice(0,2))slips.push(alert.threshold>=100?`${alert.name} budget has been reached (${money$(alert.spent)} of ${money$(alert.amount)}).`:`${alert.name} budget is ${Math.floor(alert.percent)}% used.`);
 if(overdue.length)focus.push(`Clear or reschedule ${plural(overdue.length,'overdue task')}.`);
 if(missedByHabit[0])focus.push(`Protect "${missedByHabit[0].title}": ${missedByHabit[0].missed} of ${missedByHabit[0].scheduled} scheduled days were missed.`);
 if(alerts[0])focus.push(alerts[0].spent>alerts[0].amount?`${alerts[0].name} is ${money$(alerts[0].spent-alerts[0].amount)} over budget; avoid new spending there.`:`Hold ${alerts[0].name} spending: ${money$(alerts[0].amount-alerts[0].spent)} left this month.`);
 if(!focus.length)focus.push("Plan next week's priorities in Tasks & Habits.");
 const empty=current.income+current.expenses+current.tasksDue+current.habitScheduled+current.workouts===0&&previous.income+previous.expenses+previous.tasksDue+previous.habitScheduled+previous.workouts===0&&!overdue.length;
 return {today,current,previous,wins:wins.slice(0,4),slips:slips.slice(0,4),focus:focus.slice(0,3),empty};
}

// CSV/PDF extras: the same numbers as the on-screen report tables.
export function reportSections(s:Snapshot,month:string,now=new Date()){
 const report=monthReport(s.records,month,s.profile.currency,s.profile.timezone,now),major=(n:number)=>n/100;
 const base=reportRows(s,month,now),overview=base.filter(r=>!String(r[0]).startsWith('Goal: ')),goals=base.filter(r=>String(r[0]).startsWith('Goal: '));
 const sections:{heading:string;header?:string[];rows:(string|number)[][]}[]=[{heading:'Overview',rows:overview.slice(1)}];
 if(goals.length)sections.push({heading:'Goals',rows:goals});
 sections.push({heading:'Week by week',header:['Week','Income','Expenses','Net','Tasks done','Tasks due','Habit completion %','Workout minutes'],rows:report.weeks.map(w=>[w.label,major(w.income),major(w.expenses),major(w.net),w.tasksDone,w.tasksDue,w.habitRate===null?'':Math.round(w.habitRate),w.workoutMinutes])});
 sections.push({heading:'Spending by category',header:['Category','Amount','Share %','Previous period','Change %'],rows:report.categories.map(c=>[c.name,major(c.amount),Math.round(c.percentage*10)/10,major(c.previous),c.change===null?'':Math.round(c.change*10)/10])});
 return sections;
}
export function fullReportRows(s:Snapshot,month:string,now=new Date()){
 const rows:(string|number)[][]=[...reportRows(s,month,now)];
 for(const section of reportSections(s,month,now).filter(x=>x.header)){rows.push([''],[section.heading],section.header!,...section.rows);}
 return rows;
}
