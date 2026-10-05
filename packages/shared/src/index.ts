import { z } from 'zod';
import {monthBudgets} from './finance';
export * from './finance';
export * from './trends';

export const kinds = ['transaction','budget','cashPlan','financeCategory','recurring','task','habit','completion','workout','meal','grocery','goal','milestone','notification','announcement','automation'] as const;
export const kindSchema = z.enum(kinds);
export type Kind = z.infer<typeof kindSchema>;
export function safeReturnTo(value:unknown):string {if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x20]/.test(value)||/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(value))return '/';try{const url=new URL(value,'https://dailyledger.invalid');if(url.origin!=='https://dailyledger.invalid'||/^\/(login|signup|backend|auth)(\/|$)/.test(url.pathname))return '/';return url.pathname+url.search+url.hash;}catch{return '/';}}
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, 'Use a valid date');
const cents = z.number().int().min(0).max(1_000_000_000_000);
const title = z.string().trim().min(1).max(160);
const note = z.string().max(2000).default('');
export const schemas = {
  transaction: z.object({title, date, amount:cents, currency:z.string().regex(/^[A-Z]{3}$/), type:z.enum(['income','expense','transfer']),category:title,account:title,notes:note,sourceId:z.string().optional(),sourceMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()}),
  budget: z.object({title, month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),amount:cents,currency:z.string().regex(/^[A-Z]{3}$/),category:z.string().trim().max(160).optional(),repeats:z.boolean().optional()}),
  cashPlan:z.object({title,amount:cents.refine(v=>v>0,'Enter an amount above zero'),currency:z.string().regex(/^[A-Z]{3}$/),type:z.enum(['income','expense']),category:title,account:title,day:z.number().int().min(1).max(31),active:z.boolean().default(true),notes:note}),
  financeCategory:z.object({title,type:z.enum(['income','expense'])}),
  recurring: z.object({title, amount:cents, currency:z.string().regex(/^[A-Z]{3}$/),type:z.enum(['income','expense']),category:title,account:title,nextDate:date,frequency:z.enum(['weekly','monthly']),enabled:z.boolean().default(true),notes:note}),
  task: z.object({title,description:note,due:z.string().datetime({offset:true}).transform(v=>new Date(v).toISOString()),priority:z.enum(['low','medium','high']),done:z.boolean().default(false),completedAt:z.string().datetime().nullable().optional(),reminder:z.boolean().default(true),recurrence:z.enum(['none','weekly','monthly']).default('none')}),
  habit: z.object({title,days:z.array(z.number().int().min(0).max(6)).min(1).max(7),active:z.boolean().default(true),startDate:date}),
  completion: z.object({habitId:title,date}),
  workout: z.object({title,date,type:title,duration:z.number().int().min(1).max(1440),notes:note}),
  meal: z.object({title,date,slot:z.enum(['Breakfast','Lunch','Dinner']),notes:note}),
  grocery: z.object({title,quantity:z.string().max(80).default(''),cost:cents,currency:z.string().regex(/^[A-Z]{3}$/),done:z.boolean().default(false),mealId:z.string().optional()}),
  goal: z.object({title,description:note,current:z.number().min(0).max(1e12),target:z.number().positive().max(1e12),unit:z.string().max(30),deadline:date,active:z.boolean().default(true)}),
  milestone: z.object({title,goalId:title,done:z.boolean().default(false)}),
  notification: z.object({title,read:z.boolean().default(false),date}),
  announcement: z.object({title,description:note,audience:z.enum(['Everyone','Free','Pro','Lifetime']),version:z.number().int().positive(),priority:z.number().int().min(0).max(10),publishAt:z.string().datetime(),expiresAt:z.string().datetime(),followup:z.boolean().default(false),ctaLabel:z.string().max(80).optional(),ctaUrl:z.string().max(2048).refine(v=>{if(!v)return true;if(/[\\\x00-\x20]/.test(v))return false;if(v.startsWith('/')&&!v.startsWith('//'))return true;try{return new URL(v).protocol==='https:';}catch{return false;}},'Use an internal path or HTTPS URL').optional()}),
  automation: z.object({title,enabled:z.boolean(),type:z.enum(['task-overdue','announcement-followup'])})
};
export type RecordData = { [K in Kind]: z.infer<typeof schemas[K]> };
export type LedgerRecord<K extends Kind = Kind> = K extends Kind ? {id:string;kind:K;data:RecordData[K];version:number} : never;
export interface Profile {name:string;email:string;currency:string;timezone:string;plan:Plan;optionalEmails:boolean;productUpdates:boolean;role?:string;allowances?:Record<string,number|null>;onboardingCompletedAt?:string|null;persona?:string|null;focusAreas?:string[]}
export interface Snapshot {profile:Profile;records:LedgerRecord[];dismissed:string[]}
export const preferenceSchema = z.object({name:title,currency:z.enum(['USD','PKR','EUR','GBP']),timezone:z.string().refine(v=>{try { new Intl.DateTimeFormat('en',{timeZone:v}); return true; } catch { return false; }},'Use an IANA timezone'),optionalEmails:z.boolean(),productUpdates:z.boolean()});
export const personas=['Developer','Designer','Freelancer','Business Owner','Student','Other'] as const;
export const focusAreas=['finance','tasks','fitness','meals','goals'] as const;
export const currencyOptions=['USD','PKR','EUR','GBP'] as const;
export function timezoneOptions(current='UTC'){return Array.from(new Set([current,...(Intl.supportedValuesOf?Intl.supportedValuesOf('timeZone'):[]),'UTC','Asia/Karachi','Europe/London','America/New_York'])).sort();}
export const onboardingSchema=preferenceSchema.pick({name:true,currency:true,timezone:true}).extend({persona:z.enum(personas).nullable().default(null),focusAreas:z.array(z.enum(focusAreas)).max(5).refine(v=>new Set(v).size===v.length,'Choose each focus only once').default([]),referralSource:z.string().trim().max(120).optional()});
export type OnboardingInput=z.infer<typeof onboardingSchema>;
export type Plan = 'Free'|'Pro'|'Lifetime';
export const plans = {Free:{price:0,tasks:30,habits:3,goals:3,transactions:100,automations:0,emails:0,pdf:false,history:false,recurring:false},Pro:{price:20,tasks:Infinity,habits:Infinity,goals:Infinity,transactions:Infinity,automations:10,emails:150,pdf:true,history:true,recurring:true},Lifetime:{price:100,tasks:Infinity,habits:Infinity,goals:Infinity,transactions:Infinity,automations:5,emails:60,pdf:true,history:true,recurring:true}};
export function recordsOf<K extends Kind>(records:LedgerRecord[],kind:K):LedgerRecord<K>[] {return records.filter(r=>r.kind===kind) as LedgerRecord<K>[];}
export function localDate(instant:Date|string,timezone:string):string { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant)); return ['year','month','day'].map(k=>parts.find(p=>p.type===k)!.value).join('-'); }
export function monthDates(month:string){const [y,m]=month.split('-').map(Number);return Array.from({length:new Date(Date.UTC(y,m,0)).getUTCDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);}
export function money(cents:number,currency='USD'){return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:cents%100?2:0}).format(cents/100);}
export function metrics(records:LedgerRecord[],month:string,currency:string,timezone:string,asOf=new Date()) {
  const dates=monthDates(month); const today=localDate(asOf,timezone); const end=month===today.slice(0,7)?today:dates.at(-1)!;
  const tx=recordsOf(records,'transaction').filter(r=>r.data.currency===currency&&r.data.date.startsWith(month)&&r.data.date<=end);
  const income=tx.filter(r=>r.data.type==='income').reduce((n,r)=>n+r.data.amount,0);
  const expenses=tx.filter(r=>r.data.type==='expense').reduce((n,r)=>n+r.data.amount,0);
  const budgets=monthBudgets(records,month,currency);
  const overall=budgets.filter(r=>!r.data.category);
  const budget=(overall.length?overall:budgets).reduce((n,r)=>n+r.data.amount,0);
  const tasks=recordsOf(records,'task').filter(r=>{const d=localDate(r.data.due,timezone);return d.startsWith(month)&&d<=end;});
  const categories=Object.entries(tx.filter(r=>r.data.type==='expense').reduce<Record<string,number>>((s,r)=>{s[r.data.category]=(s[r.data.category]||0)+r.data.amount;return s;},{})).map(([name,amount])=>({name,amount,percentage:expenses?amount/expenses*100:0})).sort((a,b)=>b.amount-a.amount);
  let runningIncome=0,runningExpense=0;
  const cash=dates.filter(d=>d<=end).map(date=>{for(const r of tx.filter(r=>r.data.date===date)){if(r.data.type==='income')runningIncome+=r.data.amount;if(r.data.type==='expense')runningExpense+=r.data.amount;}return {date,day:Number(date.slice(-2)),income:runningIncome/100,expenses:runningExpense/100};});
  const scheduled=recordsOf(records,'habit').filter(r=>r.data.active).flatMap(h=>dates.filter(d=>d<=end&&d>=h.data.startDate&&h.data.days.includes(new Date(`${d}T12:00:00Z`).getUTCDay())).map(date=>({habitId:h.id,date})));
  const completions=new Set(recordsOf(records,'completion').map(r=>`${r.data.habitId}:${r.data.date}`));
  const habitDone=scheduled.filter(s=>completions.has(`${s.habitId}:${s.date}`)).length;
  const previousDate=new Date(`${month}-01T12:00:00Z`);previousDate.setUTCMonth(previousDate.getUTCMonth()-1);const previousMonth=previousDate.toISOString().slice(0,7);
  const previousEnd=month===today.slice(0,7)?`${previousMonth}-${String(Math.min(Number(end.slice(-2)),monthDates(previousMonth).length)).padStart(2,'0')}`:monthDates(previousMonth).at(-1)!;
  const previous=recordsOf(records,'transaction').filter(r=>r.data.currency===currency&&r.data.type==='income'&&r.data.date.startsWith(previousMonth)&&r.data.date<=previousEnd).reduce((n,r)=>n+r.data.amount,0);
  return {month,currency,end,partial:month===today.slice(0,7),income,expenses,saved:income-expenses,savingsRate:income?100*(income-expenses)/income:null,budget,budgetUsage:budget?expenses/budget*100:null,tasks,completed:tasks.filter(r=>r.data.done).length,categories,cash,habitDone,habitScheduled:scheduled.length,habitRate:scheduled.length?habitDone/scheduled.length*100:null,incomeChange:previous?(income-previous)/previous*100:null};
}
export function habitStreak(habit:LedgerRecord<'habit'>,records:LedgerRecord[],today:string) {const done=new Set(recordsOf(records,'completion').filter(r=>r.data.habitId===habit.id).map(r=>r.data.date));let count=0;const cursor=new Date(`${today}T12:00:00Z`);for(let i=0;i<3660;i++){const date=cursor.toISOString().slice(0,10);if(date<habit.data.startDate)break;if(habit.data.days.includes(cursor.getUTCDay())){if(done.has(date))count++;else if(date!==today)break;}cursor.setUTCDate(cursor.getUTCDate()-1);}return count;}
export function csv(rows:(string|number)[][]) {return '\ufeff'+rows.map(row=>row.map(v=>{const s=String(v);const safe=/^[=+@\-\t\r]/.test(s)?`'${s}`:s;return `"${safe.replaceAll('"','""')}"`;}).join(',')).join('\r\n');}
export function reportRows(s:Snapshot,month:string,now=new Date()) {const m=metrics(s.records,month,s.profile.currency,s.profile.timezone,now);return [['Daily Ledger report',month],['Currency',m.currency],['Through',m.end],['Income',m.income/100],['Expenses',m.expenses/100],['Net savings',m.saved/100],['Budget',m.budget/100],['Tasks completed',m.completed],['Tasks due',m.tasks.length],['Habit completions',m.habitDone],['Habit scheduled',m.habitScheduled],['Workout minutes',recordsOf(s.records,'workout').filter(r=>r.data.date.startsWith(month)&&r.data.date<=m.end).reduce((n,r)=>n+r.data.duration,0)],...recordsOf(s.records,'goal').map(r=>['Goal: '+r.data.title,`${r.data.current} / ${r.data.target} ${r.data.unit}`])];}
export function reminderEligible(task:LedgerRecord<'task'>|undefined,now:Date){return !!task&&!task.data.done&&task.data.reminder&&new Date(task.data.due).getTime()+86400000<=now.getTime();}
export function quotaAllowed(plan:Plan,kind:Kind,data:RecordData[Kind],records:LedgerRecord[],timezone:string,allowances=plans[plan]){const p=allowances;if(kind==='recurring')return p.recurring;if(kind==='task'&&!(data as RecordData['task']).done)return recordsOf(records,'task').filter(r=>!r.data.done).length<p.tasks;if(kind==='habit'&&(data as RecordData['habit']).active)return recordsOf(records,'habit').filter(r=>r.data.active).length<p.habits;if(kind==='goal'&&(data as RecordData['goal']).active)return recordsOf(records,'goal').filter(r=>r.data.active).length<p.goals;if(kind==='automation'&&(data as RecordData['automation']).enabled)return recordsOf(records,'automation').filter(r=>r.data.enabled).length<p.automations;if(kind==='transaction')return recordsOf(records,'transaction').filter(r=>r.data.date.slice(0,7)===(data as RecordData['transaction']).date.slice(0,7)).length<p.transactions;void timezone;return true;}
export function nextOccurrence(date:string,frequency:'weekly'|'monthly'){const d=new Date(`${date}T12:00:00Z`);if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7);else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}return d.toISOString().slice(0,10);}

export function demoSnapshot():Snapshot {
  const records:LedgerRecord[]=[];let sequence=0;const add=<K extends Kind>(kind:K,data:RecordData[K])=>{const id=`demo-${++sequence}`;records.push({id,kind,data,version:1} as LedgerRecord);return id;};
  const weights=[9,3,7,12,2,9,10,2,4,5,12,4,3,8,4,7,2,11,5,2,8,3,4,10,2,8,4,3,6,12];
  const distribute=(total:number,shift=0)=>{const sum=weights.reduce((n,w)=>n+w,0);let allocated=0;return weights.map((_,i)=>{const amount=i===29?total-allocated:Math.floor(total*weights[(i+shift)%30]/sum);allocated+=amount;return amount;});};
  distribute(400000).forEach((amount,i)=>{const day=i+1;const date=`2026-09-${String(day).padStart(2,'0')}`;add('transaction',{title:day%7===0?'Client project':'Consulting income',date,amount,currency:'USD',type:'income',category:'Work',account:'Checking',notes:''});});
  for(const [category,total,shift] of [['Essentials',64000,3],['Food',32000,8],['Transport',19200,15],['Other',12800,21]] as const){distribute(total,shift).forEach((amount,i)=>add('transaction',{title:category==='Essentials'?'Home & utilities':category==='Food'?'Groceries & dining':category==='Transport'?'Travel & transit':'Personal purchase',date:`2026-09-${String(i+1).padStart(2,'0')}`,amount,currency:'USD',type:'expense',category,account:'Checking',notes:''}));}
  add('transaction',{title:'August consulting',date:'2026-08-28',amount:357143,currency:'USD',type:'income',category:'Work',account:'Checking',notes:''});
  add('budget',{title:'Monthly spending budget',month:'2026-09',amount:200000,currency:'USD'});
  for(let i=0;i<24;i++)add('task',{title:i===18?'Finish client proposal':i===19?'Review monthly budget':i===20?'Plan next week':i<18?['Review project brief','Morning planning','Send client update'][i%3]:['Schedule dentist','Organize documents','Book weekend trip'][i-21],description:'',due:`2026-09-${String(i<18?i+1:30).padStart(2,'0')}T${i===18?'05:00':i===19?'09:00':'15:00'}:00Z`,priority:i===18?'high':'medium',done:i<18,completedAt:i<18?`2026-09-${String(i+1).padStart(2,'0')}T16:00:00.000Z`:null,reminder:true,recurrence:'none'});
  const reading=add('habit',{title:'Reading',days:[1,2,3,4,5],active:true,startDate:'2026-09-01'});const walk=add('habit',{title:'Evening walk',days:[0,1,2,3,4,5,6],active:true,startDate:'2026-09-01'});
  monthDates('2026-09').forEach((date,i)=>{const day=new Date(`${date}T12:00:00Z`).getUTCDay();if(day>=1&&day<=5&&i%6!==0)add('completion',{habitId:reading,date});if(i%5!==0)add('completion',{habitId:walk,date});});
  add('goal',{title:'Emergency fund',description:'Build a comfortable financial cushion.',current:3000,target:5000,unit:'USD',deadline:'2026-12-31',active:true});add('goal',{title:'Portfolio launch',description:'Publish four polished case studies.',current:3,target:4,unit:'case studies',deadline:'2026-10-31',active:true});
  for(const day of [2,5,9,12,16,19,23,26,30])add('workout',{title:day%2?'Strength training':'Morning run',date:`2026-09-${String(day).padStart(2,'0')}`,type:day%2?'Strength':'Running',duration:day%2?45:30,notes:''});
  add('meal',{title:'Grilled chicken & vegetables',date:'2026-09-30',slot:'Dinner',notes:'Prep vegetables ahead'});add('grocery',{title:'Fresh vegetables',quantity:'1 basket',cost:1500,currency:'USD',done:false});add('grocery',{title:'Chicken breast',quantity:'500 g',cost:900,currency:'USD',done:false});
  add('notification',{title:'Your September report is ready to explore.',read:false,date:'2026-09-30'});
  add('announcement',{title:'Weekly planning is now available',description:'Plan your week, set priorities and stay on track with less effort.',audience:'Everyone',version:1,priority:1,publishAt:'2026-09-01T00:00:00Z',expiresAt:'2027-01-01T00:00:00Z',followup:false});
  return {profile:{name:'Ahad Noor',email:'ahad@example.com',currency:'USD',timezone:'Asia/Karachi',plan:'Pro',optionalEmails:false,productUpdates:false},records,dismissed:[]};
}

export function passwordChecks(value:string){return {length:value.length>=12&&value.length<=128,mix:/[A-Za-z]/.test(value)&&/[0-9]/.test(value)&&/[^A-Za-z0-9\s]/.test(value)};}
export function parseMoneyInput(value:string):number {if(!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))return NaN;const [whole,fraction='']=value.trim().split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));}
export function calendarWeeks(month:string):string[][] {const first=new Date(`${month}-01T12:00:00Z`);const offset=(first.getUTCDay()+6)%7;const total=monthDates(month).length;first.setUTCDate(1-offset);return Array.from({length:Math.ceil((total+offset)/7)},(_,week)=>Array.from({length:7},(_,day)=>{const date=new Date(first);date.setUTCDate(first.getUTCDate()+week*7+day);return date.toISOString().slice(0,10);}));}


