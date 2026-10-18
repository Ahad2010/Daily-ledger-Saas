import {z} from 'zod';
import {schemas,money} from '@ledger/shared';

// The assistant never writes data. It can only PROPOSE actions; every proposal is validated against the same schemas as a
// hand-entered record, labelled by the server (not by model text), and runs only when the user confirms it in the app.
export const actionKinds=['task','transaction','habit','workout','goal','meal','grocery','completion'] as const;
export type ActionKind=typeof actionKinds[number];
export const assistantLinks:Record<string,string>={'/':'Overview','/finance':'Financial Planner','/finance/transactions':'Transactions','/finance/budgets':'Budgets','/finance/income':'Income sources','/finance/bills':'Bills & payments','/finance/recurring':'Recurring entries','/tasks':'Tasks & Habits','/fitness':'Fitness','/meals':'Meals & Grocery','/goals':'Life Goals','/reports':'Monthly Reports','/settings':'Settings','/plans':'Plans','/help':'Help'};
export type AssistantAction={type:'create';kind:ActionKind;data:Record<string,unknown>;label:string}|{type:'link';path:string;label:string};

const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export type ReplyContext={currency:string;today:string;habits?:Record<string,string>};
function describe(kind:ActionKind,data:Record<string,any>,currency:string,habits:Record<string,string>={}){
 switch(kind){
  case 'task':return `Add task "${data.title}" · due ${String(data.due).slice(0,10)}${data.priority==='high'?' · high priority':''}`;
  case 'transaction':return `Record ${data.type} of ${money(data.amount,data.currency||currency)} · ${data.title} (${data.category}) on ${data.date}`;
  case 'habit':return `Add habit "${data.title}" ${(data.days as number[]).length===7?'every day':'on '+(data.days as number[]).map(d=>weekdays[d]).join(', ')}`;
  case 'workout':return `Log workout "${data.title}" · ${data.duration} min on ${data.date}`;
  case 'goal':return `Add goal "${data.title}" · ${data.target} ${data.unit} by ${data.deadline}`;
  case 'meal':return `Plan ${String(data.slot).toLowerCase()} "${data.title}" on ${data.date}`;
  case 'grocery':return `Add grocery item "${data.title}"${data.quantity?` (${data.quantity})`:''}`;
  case 'completion':return `Mark habit "${habits[data.habitId]||'habit'}" done on ${data.date}`;
 }
}
export function sanitizeActions(raw:unknown[],ctx:ReplyContext):AssistantAction[]{
 const out:AssistantAction[]=[],seen=new Set<string>();
 for(const item of raw){
  if(out.length>=5)break;
  const action=z.object({type:z.enum(['create','link']),kind:z.string().optional(),data:z.record(z.string(),z.unknown()).optional(),path:z.string().optional()}).safeParse(item);if(!action.success)continue;
  const a=action.data;let next:AssistantAction|null=null;
  if(a.type==='link'){if(a.path&&Object.hasOwn(assistantLinks,a.path))next={type:'link',path:a.path,label:`Open ${assistantLinks[a.path]}`};}
  else if(a.kind&&(actionKinds as readonly string[]).includes(a.kind)&&a.data){
   const kind=a.kind as ActionKind;
   const defaults:Record<ActionKind,Record<string,unknown>>={task:{priority:'medium'},transaction:{currency:ctx.currency,account:'Cash',category:'Other',notes:''},habit:{startDate:ctx.today,days:[0,1,2,3,4,5,6]},workout:{type:'Workout'},goal:{current:0},meal:{},grocery:{currency:ctx.currency,cost:0},completion:{date:ctx.today}};
   const parsed=schemas[kind].safeParse({...defaults[kind],...a.data});
   // A completion must point at one of this member's own habits (ids come from the context we sent) and may only mark today.
   const known=kind!=='completion'||(parsed.success&&!!ctx.habits?.[(parsed.data as any).habitId]&&(parsed.data as any).date===ctx.today);
   if(parsed.success&&known){const data=parsed.data as Record<string,unknown>;next={type:'create',kind,data,label:describe(kind,data,ctx.currency,ctx.habits)};}
  }
  if(!next)continue;const key=JSON.stringify(next);if(seen.has(key))continue;seen.add(key);out.push(next);
 }
 return out;
}
const replySchema=z.object({answer:z.string().max(16000),actions:z.array(z.unknown()).max(20).default([])});
function jsonCandidate(text:string):unknown{
 const unfenced=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
 const attempts=[unfenced];const start=unfenced.indexOf('{'),end=unfenced.lastIndexOf('}');if(start>=0&&end>start)attempts.push(unfenced.slice(start,end+1));
 for(const attempt of attempts){try{return JSON.parse(attempt);}catch{/* try the next form */}}
 return null;
}
// Plain-text replies (providers that ignore the JSON instruction) are shown as they are, with no actions.
export function parseAssistantReply(content:string,ctx:ReplyContext):{answer:string;actions:AssistantAction[]}{
 const text=content.trim(),parsed=replySchema.safeParse(jsonCandidate(text));
 if(parsed.success&&parsed.data.answer.trim())return {answer:parsed.data.answer.trim(),actions:sanitizeActions(parsed.data.actions,ctx)};
 return {answer:text,actions:[]};
}

export const ASSISTANT_CAPABILITIES=`You can answer questions about the user's own data and explain how to use Daily Ledger. You cannot change anything yourself. When the user clearly asks you to add or log something, or asks where a tool is, include actions the user can confirm. Reply ONLY as compact JSON: {"answer":"short plain-text reply","actions":[...]}. Allowed actions: {"type":"create","kind":"task","data":{"title":"...","due":"ISO-8601 datetime with offset","priority":"low|medium|high"}}; {"type":"create","kind":"transaction","data":{"title":"...","date":"YYYY-MM-DD","amount":integer minor units (100 per major unit),"type":"income|expense","category":"..."}}; {"type":"create","kind":"habit","data":{"title":"...","days":[0-6 with Sunday=0]}}; {"type":"create","kind":"workout","data":{"title":"...","date":"YYYY-MM-DD","type":"Strength|Running|...","duration":minutes}}; {"type":"create","kind":"goal","data":{"title":"...","target":number,"unit":"...","deadline":"YYYY-MM-DD"}}; {"type":"create","kind":"meal","data":{"title":"...","date":"YYYY-MM-DD","slot":"Breakfast|Lunch|Dinner|Snack"}}; {"type":"create","kind":"grocery","data":{"title":"...","quantity":"..."}}; {"type":"create","kind":"completion","data":{"habitId":"id from context.habits"}} marks one of the user's habits done today (use only ids listed in context.habits); {"type":"link","path":"/finance/transactions"}. Use the date and timezone from the context. Earlier messages of this conversation are included; use them to understand short follow-ups such as "yes" or a single word, and never ask again for something the user already told you. Reply in the language the user writes in (English, Urdu, Hindi or Hinglish). Never invent amounts, dates or names the user did not give: ask one short question instead and return no actions. Ask at most once about the same thing: if the reply does not answer it (for example a date instead of weekdays), do not repeat the question; choose a sensible default, say which one you chose in the answer, and still return the action. A habit with no days given defaults to every day ([0,1,2,3,4,5,6]). If the request has nothing to do with Daily Ledger (for example writing code), say in one short sentence that you can only help with their money, tasks, habits, fitness, meals and goals, and ask nothing. At most 3 actions. Plain text only inside "answer".`;
export const PRODUCT_GUIDE=`Daily Ledger guide. Overview: dashboard. Financial Planner (/finance): transactions with CSV bank import (Import CSV on /finance/transactions), budgets with alerts at 80% and 100% (/finance/budgets), income sources, bills, recurring entries. Tasks & Habits (/tasks). Fitness (/fitness; exercise guides need Pro). Meals & Grocery (/meals). Life Goals (/goals). Monthly Reports (/reports): weekly review, week-by-week table, CSV and PDF export (PDF is paid). Settings (/settings): profile photo, notifications, plan and billing, install the app. Plans (/plans): Free, a one-time 7-day Pro trial when offered, Pro and Lifetime. Do not promise features that are not listed here.`;
