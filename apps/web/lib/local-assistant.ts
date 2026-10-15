import {goalProgress,localDate,metrics,money,recordsOf,schemas,weeklyReview,type Snapshot} from '@ledger/shared';
import {dayNutrition,nutritionTarget,waterToday} from './nutrition';
import {weekSummary} from './fitness';
export type LocalAction={type:'create';kind:'task'|'transaction';data:Record<string,unknown>;label:string}|{type:'link';path:string;label:string};
export type LocalReply={answer:string;actions?:LocalAction[]};
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;
const tomorrow=(today:string)=>new Date(new Date(`${today}T09:00:00Z`).getTime()+86400000).toISOString();

// Demo-mode assistant: every answer is calculated from the account's own records, so it is honest and works with no server.
// Open-ended questions need a connected AI provider; this says so instead of guessing.
export function localAnswer(s:Snapshot,question:string,month:string,asOf:Date,intent='general'):LocalReply{
 const tz=s.profile.timezone,currency=s.profile.currency,today=localDate(asOf,tz);
 const text=question.toLowerCase();
 const addTask=question.match(/^\s*(?:add|create|new)\s+(?:a\s+)?task\s*[:\-]?\s*(.+)$/i);
 if(addTask){
  const title=addTask[1].trim().slice(0,120);
  const data=schemas.task.parse({title,description:'',due:tomorrow(today),priority:'medium',done:false,reminder:true,recurrence:'none'});
  return {answer:`I can add “${title}” for tomorrow at 9:00. Confirm and it goes into your Tasks.`,actions:[{type:'create',kind:'task',data,label:`Add task: ${title}`}]};
 }
 const spend=question.match(/(?:log|add|spent|spend)\s+(?:a\s+)?\$?(\d+(?:\.\d{1,2})?)\s*(?:usd|\$)?\s*(.*)/i);
 if(spend&&/expense|spent|lunch|dinner|breakfast|coffee|groceries|fuel|taxi/i.test(question)){
  const amount=Math.round(Number(spend[1])*100);const label=(spend[2]||'Expense').replace(/\b(expense|today|on|for|a)\b/gi,'').trim()||'Expense';
  const title=label[0].toUpperCase()+label.slice(1);
  const data=schemas.transaction.parse({title:title.slice(0,120),date:today,amount,currency,type:'expense',category:/lunch|dinner|breakfast|coffee|groceries/i.test(question)?'Food':'General',account:'Cash',notes:''});
  return {answer:`I can log ${money(amount,currency)} for “${title}” today. Confirm and it is added to Finance.`,actions:[{type:'create',kind:'transaction',data,label:`Log ${money(amount,currency)} · ${title}`}]};
 }
 const m=metrics(s.records,month,currency,tz,asOf);
 const pick=intent!=='general'?intent:/spend|expense|kharch|where did|category/.test(text)?'spending':/task|todo|attention|pending|overdue/.test(text)?'tasks':/goal/.test(text)?'goals':/week|plan my/.test(text)?'weekly':/summar|month|income|saved|saving/.test(text)?'summary':/meal|calorie|protein|eat|food|nutrition/.test(text)?'nutrition':/workout|gym|fitness|train/.test(text)?'fitness':/water|hydrat/.test(text)?'water':'';
 switch(pick){
  case 'summary':return {answer:`This month you earned ${money(m.income,currency)} and spent ${money(m.expenses,currency)}, which leaves ${money(m.saved,currency)} saved${m.savingsRate!==null?` (${Math.round(m.savingsRate)}% of income)`:''}. ${m.budget?`You have used ${Math.round(m.budgetUsage||0)}% of your ${money(m.budget,currency)} budget.`:'You have not set a monthly budget yet.'}`,actions:[{type:'link',path:'/reports',label:'Open monthly report'}]};
  case 'spending':{const top=m.categories.slice(0,3);return {answer:top.length?`Most of your spending went to ${top.map(c=>`${c.name} (${money(c.amount,currency)}, ${Math.round(c.percentage)}%)`).join(', ')}. In total you spent ${money(m.expenses,currency)} this month.`:'No expenses are recorded for this month yet.',actions:[{type:'link',path:'/finance/transactions',label:'See transactions'}]};}
  case 'tasks':{const open=recordsOf(s.records,'task').filter(t=>!t.data.done);const overdue=open.filter(t=>new Date(t.data.due)<asOf);const next=open.slice().sort((a,b)=>a.data.due.localeCompare(b.data.due)).slice(0,3).map(t=>t.data.title);return {answer:open.length?`You have ${plural(open.length,'open task')}${overdue.length?`, ${overdue.length} overdue`:''}. Next up: ${next.join('; ')}.`:'Your task list is clear. Nicely done.',actions:[{type:'link',path:'/tasks',label:'Open tasks'}]};}
  case 'goals':{const goals=recordsOf(s.records,'goal').filter(g=>g.data.active);return {answer:goals.length?goals.map(g=>`${g.data.title}: ${Math.round(goalProgress(g,s.records).percentage)}% (target ${g.data.deadline})`).join('. ')+'.':'You have no active goals yet.',actions:[{type:'link',path:'/goals',label:'Open goals'}]};}
  case 'weekly':{const r=weeklyReview(s.records,{currency,timezone:tz,asOf});return {answer:[r.wins[0]&&`Going well: ${r.wins[0]}`,r.slips[0]&&`To watch: ${r.slips[0]}`,r.focus[0]&&`Focus next: ${r.focus[0]}`].filter(Boolean).join(' ')||'Log a few days and I can review your week.',actions:[{type:'link',path:'/today',label:'Open Today'}]};}
  case 'nutrition':{const t=nutritionTarget(s),d=dayNutrition(s,today);return {answer:t?`Today you have eaten ${Math.round(d.eaten.calories)} of ${t.data.calories} kcal and ${Math.round(d.eaten.protein)} of ${t.data.protein} g protein.`:`Today you have eaten ${Math.round(d.eaten.calories)} kcal. Set a daily target in Meals to see how much is left.`,actions:[{type:'link',path:'/meals',label:'Open Meals'}]};}
  case 'fitness':{const w=weekSummary(s,today);return {answer:w.sessions?`In the last 7 days you finished ${plural(w.sessions,'workout')} for ${w.minutes} minutes${w.volume?` and lifted ${Math.round(w.volume).toLocaleString()} kg in total`:''}.`:'No completed workouts in the last 7 days. Even 15 minutes counts.',actions:[{type:'link',path:'/fitness',label:'Open Fitness'}]};}
  case 'water':{const w=waterToday(s,today);return {answer:`You have logged ${w.ml.toLocaleString()} of ${w.goal.toLocaleString()} ml of water today.`,actions:[{type:'link',path:'/meals',label:'Open Meals'}]};}
  default:return {answer:'In demo mode I can answer from your own records: try “Summarize my month”, “Where did my money go?”, “What needs my attention?”, “How are my goals doing?”, “Help me plan my week”, or “How many calories today?”. I can also add a task (“Add a task: call the bank”) or log an expense (“Log a $12 lunch expense”). Open-ended questions are answered once an AI provider is connected.'};
 }
}
