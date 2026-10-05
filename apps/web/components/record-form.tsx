'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { schemas,parseMoneyInput,recordsOf, type Kind, type LedgerRecord } from '@ledger/shared';
import { Button } from './ui/button';
type Field={key:string;label:string;type?:string;options?:string[];default?:unknown};
export const fields:Partial<Record<Kind,Field[]>>={
 transaction:[{key:'title',label:'Description'},{key:'type',label:'Type',options:['expense','income','transfer']},{key:'amount',label:'Amount',type:'money',default:0},{key:'currency',label:'Currency',options:['USD','PKR','EUR','GBP']},{key:'date',label:'Date',type:'date'},{key:'category',label:'Category',default:'Essentials'},{key:'account',label:'Account / payment method',default:'Checking'},{key:'notes',label:'Notes',type:'textarea'}],
 budget:[{key:'title',label:'Budget name',default:'Monthly spending budget'},{key:'amount',label:'Budget',type:'money',default:0},{key:'category',label:'Category (leave empty for overall budget)',default:''},{key:'month',label:'Starting month',type:'month'},{key:'repeats',label:'Use this limit every month',type:'checkbox',default:false},{key:'currency',label:'Currency',options:['USD','PKR','EUR','GBP']}],
 cashPlan:[{key:'title',label:'Name'},{key:'amount',label:'Monthly amount',type:'money',default:0},{key:'day',label:'Day of the month',type:'number',default:1},{key:'category',label:'Category',default:'Salary'},{key:'type',label:'Plan type',type:'hidden',default:'income'},{key:'currency',label:'Currency',options:['USD','PKR','EUR','GBP']},{key:'account',label:'Account / payment method',default:'Checking'},{key:'active',label:'Active',type:'checkbox',default:true},{key:'notes',label:'Notes',type:'textarea'}],
 financeCategory:[{key:'title',label:'Category name'},{key:'type',label:'Category type',options:['expense','income']}],
 recurring:[{key:'title',label:'Description'},{key:'amount',label:'Amount',type:'money',default:0},{key:'type',label:'Type',options:['expense','income']},{key:'currency',label:'Currency',options:['USD','PKR','EUR','GBP']},{key:'category',label:'Category',default:'Essentials'},{key:'account',label:'Account',default:'Checking'},{key:'nextDate',label:'Next occurrence',type:'date'},{key:'frequency',label:'Frequency',options:['monthly','weekly']},{key:'enabled',label:'Enabled',type:'checkbox',default:true},{key:'notes',label:'Notes',type:'textarea'}],
 task:[{key:'title',label:'Task title'},{key:'description',label:'Description',type:'textarea'},{key:'due',label:'Due date and time (your device timezone)',type:'datetime-local'},{key:'priority',label:'Priority',options:['medium','high','low']},{key:'done',label:'Completed',type:'checkbox',default:false},{key:'reminder',label:'Remind after 24 hours overdue',type:'checkbox',default:true},{key:'recurrence',label:'Repeat',options:['none','weekly','monthly']}],
 habit:[{key:'title',label:'Habit name'},{key:'days',label:'Scheduled weekdays',type:'days',default:[1,2,3,4,5]},{key:'startDate',label:'Start date',type:'date'},{key:'active',label:'Active',type:'checkbox',default:true}],
 workout:[{key:'title',label:'Workout name'},{key:'date',label:'Date',type:'date'},{key:'type',label:'Workout type',options:['Strength','Running','Walking','Cycling','Yoga','Other']},{key:'duration',label:'Duration (minutes)',type:'number',default:30},{key:'notes',label:'Notes',type:'textarea'}],
 meal:[{key:'title',label:'Meal name'},{key:'date',label:'Date',type:'date'},{key:'slot',label:'Meal',options:['Dinner','Breakfast','Lunch']},{key:'notes',label:'Notes',type:'textarea'}],
 grocery:[{key:'title',label:'Grocery item'},{key:'quantity',label:'Quantity',default:''},{key:'cost',label:'Estimated cost',type:'money',default:0},{key:'currency',label:'Currency',options:['USD','PKR','EUR','GBP']},{key:'done',label:'Purchased',type:'checkbox',default:false},{key:'mealId',label:'Linked meal (optional)',default:''}],
 goal:[{key:'title',label:'Goal name'},{key:'description',label:'Description',type:'textarea'},{key:'current',label:'Current value',type:'number',default:0},{key:'target',label:'Target value',type:'number',default:100},{key:'unit',label:'Unit',default:'USD'},{key:'deadline',label:'Target date',type:'date'},{key:'active',label:'Active',type:'checkbox',default:true}],
 milestone:[{key:'title',label:'Milestone'},{key:'goalId',label:'Goal'},{key:'done',label:'Completed',type:'checkbox',default:false}],
 automation:[{key:'title',label:'Rule name'},{key:'type',label:'Trigger',options:['task-overdue','announcement-followup']},{key:'enabled',label:'Enabled',type:'checkbox',default:true}]
};
export function RecordForm({kind,record,initial,records=[],date,currency,onSave,pending,error}:{kind:Kind;record?:LedgerRecord;initial?:Record<string,unknown>;records?:LedgerRecord[];date:string;currency:string;onSave:(data:unknown)=>void;pending:boolean;error?:string}) {
 const config=fields[kind]||[];
 const defaults:Record<string,unknown>={};
 for(const f of config)defaults[f.key]=f.default??(f.type==='date'?date:f.type==='month'?date.slice(0,7):f.type==='datetime-local'?`${date}T14:00`:f.options?.[0]??'');
 defaults.currency=currency;
 Object.assign(defaults,initial,record?.data);
 for(const f of config)if(f.type==='money')defaults[f.key]=(Number(defaults[f.key])/100).toFixed(2);
 if(record?.kind==='task'){const d=new Date(record.data.due);defaults.due=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
 const {register,handleSubmit,formState:{errors},setValue,watch}=useForm<any>({defaultValues:defaults,resolver:zodResolver(schemas[kind] as any) as any});
 return <form onSubmit={handleSubmit(onSave)} className="record-form"><div className="form-grid">{config.map(f=>{
  const related=f.key==='goalId'?recordsOf(records,'goal'):f.key==='mealId'?recordsOf(records,'meal'):null;
  if(f.type==='hidden')return <input key={f.key} type="hidden" {...register(f.key)}/>;
  return <label key={f.key} className={f.type==='textarea'||f.type==='days'?'wide':''}><span>{f.label}</span>
   {related?<select aria-label={f.label} {...register(f.key,{setValueAs:v=>v||undefined})}><option value="">{f.key==='mealId'?'Not linked to a meal':'Choose a goal'}</option>{related.map(r=><option key={r.id} value={r.id}>{r.data.title}{r.kind==='meal'?` · ${r.data.date}`:''}</option>)}</select>
    :f.options?<select aria-label={f.label} {...register(f.key)}>{f.options.map(o=><option key={o}>{o}</option>)}</select>
    :f.type==='textarea'?<textarea {...register(f.key)}/>
    :f.type==='days'?<div className="weekday-picker">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><Button key={d} type="button" aria-pressed={(watch('days')||[]).includes(i)} className={(watch('days')||[]).includes(i)?'selected':''} onClick={()=>{const days=watch('days')||[];setValue('days',days.includes(i)?days.filter((v:number)=>v!==i):[...days,i],{shouldValidate:true});}}>{d}</Button>)}</div>
    :f.type==='money'?<div className="money-input"><input aria-label={f.label} type="text" inputMode="decimal" autoComplete="off" {...register(f.key,{setValueAs:v=>parseMoneyInput(String(v))})}/><span aria-hidden="true">{watch('currency')||currency}</span></div>
    :<><input aria-label={f.label} list={f.key==='category'?'finance-categories':undefined} type={f.type||'text'} {...register(f.key,{...(f.type==='number'?{valueAsNumber:true}:{}),...(f.type==='datetime-local'?{setValueAs:(v:string)=>v?new Date(v).toISOString():''}:{})})}/>{f.key==='category'&&<datalist id="finance-categories">{Array.from(new Set([...recordsOf(records,'financeCategory').map(r=>r.data.title),...recordsOf(records,'transaction').map(r=>r.data.category),'Salary','Business','Essentials','Housing','Utilities','Food','Transport','Other'])).map(name=><option key={name} value={name}/>)}</datalist>}</>}
   {errors[f.key]&&<small className="error">{f.type==='money'?'Enter a valid amount with up to two decimal places.':String(errors[f.key]?.message||'Invalid value')}</small>}
  </label>;
 })}</div>{error&&<p className="error" role="alert">{error}</p>}<div className="form-footer"><span className="muted">{kind==='cashPlan'?'A plan becomes a transaction when you mark it received or paid.':kind==='goal'?'Your milestones and progress, in one place.':'Changes are saved to your workspace.'}</span><Button variant="primary" disabled={pending} type="submit">{pending?'Saving…':record?'Save changes':kind==='cashPlan'?'Save plan':kind==='financeCategory'?'Add category':kind==='budget'?'Save budget':'Create '+kind}</Button></div></form>;
}
