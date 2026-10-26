'use client';
import {useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowLeft,ArrowRight,Banknote,Check,Droplets,Flame,GraduationCap,Home,Landmark,Laptop,PartyPopper,PiggyBank,Plus,Rocket,ShieldCheck,Smartphone,Store,Target,Tv,Wallet,Wifi,Zap,type LucideIcon} from 'lucide-react';
import {money,type Snapshot} from '@ledger/shared';
import {adapter} from '../lib/data';
import {group,groupAsTyped} from '../lib/number-format';
import {Dialog} from './ui/dialog';

type Preset={id:string;name:string;cat:string;day:string;Icon:LucideIcon};
type Row={id:string;name:string;amount:string;day:string;done:boolean};
const incomeSources:Preset[]=[{id:'salary',name:'Salary',cat:'Salary',day:'1',Icon:Wallet},{id:'freelance',name:'Freelance',cat:'Business',day:'15',Icon:Laptop},{id:'business',name:'Business',cat:'Business',day:'30',Icon:Store},{id:'rental',name:'Rental income',cat:'Business',day:'5',Icon:Home},{id:'other-in',name:'Other income',cat:'Salary',day:'1',Icon:Plus}];
const billTypes:Preset[]=[{id:'rent',name:'Rent',cat:'Housing',day:'1',Icon:Home},{id:'electricity',name:'Electricity',cat:'Utilities',day:'10',Icon:Zap},{id:'gas',name:'Gas',cat:'Utilities',day:'10',Icon:Flame},{id:'water',name:'Water',cat:'Utilities',day:'10',Icon:Droplets},{id:'internet',name:'Internet',cat:'Utilities',day:'5',Icon:Wifi},{id:'phone',name:'Phone',cat:'Utilities',day:'5',Icon:Smartphone},{id:'school',name:'School fees',cat:'Essentials',day:'5',Icon:GraduationCap},{id:'loan',name:'Loan / EMI',cat:'Other',day:'1',Icon:Landmark},{id:'insurance',name:'Insurance',cat:'Other',day:'1',Icon:ShieldCheck},{id:'subs',name:'Subscriptions',cat:'Other',day:'1',Icon:Tv},{id:'other-bill',name:'Other bill',cat:'Other',day:'1',Icon:Plus}];
const goalIdeas=['Emergency fund','Vacation','New phone','Home','Wedding','Education'];
const whole=(v:string)=>v.replace(/,/g,'').replace(/\..*$/,'').replace(/\D/g,'').slice(0,10);
const dayOf=(v:string)=>Math.min(31,Math.max(1,Number(v)||1));
const valid=(r:Row)=>r.name.trim().length>0&&Number(r.amount)>0;
const STEPS=['Income','Bills','Budget','Goal','Review'];
const sourceCategory=(name:string)=>/freelance|business|rent|shop|client/i.test(name)?'Business':'Salary';

function Tiles({presets,rows,onToggle}:{presets:Preset[];rows:Row[];onToggle:(p:Preset)=>void}){
 return <div className="fs-tiles" role="group">{presets.map(p=>{const on=rows.some(r=>r.id===p.id);return <button type="button" key={p.id} aria-pressed={on} className={on?'on':''} onClick={()=>onToggle(p)}><span><p.Icon size={20}/></span>{p.name}{on&&<i><Check size={12} strokeWidth={3}/></i>}</button>;})}</div>;
}
function Rows({rows,setRows,currency,editableName=false,onRemove}:{rows:Row[];setRows:(r:Row[])=>void;currency:string;editableName?:boolean;onRemove?:(id:string)=>void}){
 const set=(id:string,patch:Partial<Row>)=>setRows(rows.map(r=>r.id===id?{...r,...patch}:r));
 return <div className="fs-rows">{rows.map(r=><div className="fs-row simple" key={r.id}>
  {editableName?<label className="fs-name"><span>Source</span><input value={r.name} aria-label={`Name for ${r.name}`} onChange={e=>set(r.id,{name:e.target.value})}/></label>:<strong className="fs-rowname">{r.name}</strong>}
  <label><span>{currency} per month</span><input inputMode="numeric" placeholder="0" aria-label={`Amount for ${r.name}`} value={group(r.amount)} onChange={e=>{groupAsTyped(e);set(r.id,{amount:whole(e.target.value)});}}/></label>
  {onRemove&&<button type="button" className="fs-remove" aria-label={`Remove ${r.name}`} onClick={()=>onRemove(r.id)}>×</button>}
 </div>)}</div>;
}

export function FinanceSetup({s,today,currency,canPlanBills,open,onClose}:{s:Snapshot;today:string;currency:string;canPlanBills:boolean;open:boolean;onClose:(finished:boolean)=>void}){
 const [step,setStep]=useState(0),[sources,setSources]=useState<Row[]>([{id:'salary',name:'Salary',amount:'',day:'1',done:false}]),[bills,setBills]=useState<Row[]>([]),[budget,setBudget]=useState('');
 const [goalOn,setGoalOn]=useState(false),[goalName,setGoalName]=useState('Emergency fund'),[goalTarget,setGoalTarget]=useState(''),[goalMonths,setGoalMonths]=useState(6);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState<string[]|null>(null),made=useRef(new Set<string>());
 const client=useQueryClient();void s;
 const month=today.slice(0,7);
 const toggle=(list:Row[],set:(r:Row[])=>void)=>(p:Preset)=>set(list.some(r=>r.id===p.id)?list.filter(r=>r.id!==p.id):[...list,{id:p.id,name:p.name,amount:'',day:p.day,done:false}]);
 const incomeTotal=sources.filter(valid).reduce((n,r)=>n+Number(r.amount),0),billTotal=bills.filter(valid).reduce((n,r)=>n+Number(r.amount),0);
 const left=incomeTotal-billTotal,deadline=new Date(new Date(`${today}T12:00:00Z`).getTime()+goalMonths*30*864e5).toISOString().slice(0,10);
 const goalOk=goalOn&&goalName.trim()&&Number(goalTarget)>0;
 const suggest=incomeTotal>0?[60,70,80].map(p=>({p,v:Math.round(incomeTotal*p/100/100)*100})):[];
 const catOf=(r:Row,list:Preset[])=>list===incomeSources?sourceCategory(r.name):list.find(p=>p.id===r.id)?.cat||'Other';
 const next=()=>setStep(v=>{let n=Math.min(4,v+1);if(!canPlanBills&&(n===1||n===2))n=3;return n;});
 const back=()=>setStep(v=>{let n=Math.max(0,v-1);if(!canPlanBills&&(n===1||n===2))n=0;return n;});
 const finish=()=>{onClose(created!==null);};
 async function create(){
  setBusy(true);setError('');const done:string[]=[];
  try{
   for(const [list,type,presets] of [[sources,'income',incomeSources],[canPlanBills?bills:[],'expense',billTypes]] as [Row[],'income'|'expense',Preset[]][])for(const r of list.filter(valid)){
    const key=`${type}:${r.id}`;if(made.current.has(key))continue;
    const saved=await adapter.save({kind:'cashPlan',data:{title:r.name.trim(),amount:Number(r.amount)*100,currency,type,category:catOf(r,presets),account:'Checking',day:dayOf(r.day),active:true,notes:''}}) as any;
    made.current.add(key);if(r.done&&saved?.id)await adapter.settle(saved,month,today);
   }
   if(canPlanBills&&Number(budget)>0&&!made.current.has('budget')){await adapter.save({kind:'budget',data:{title:'Monthly spending budget',month,amount:Number(budget)*100,currency,category:'',repeats:true}});made.current.add('budget');}
   if(goalOk&&!made.current.has('goal')){await adapter.save({kind:'goal',data:{title:goalName.trim(),description:'',current:0,target:Number(goalTarget),unit:currency,deadline,active:true,...(canPlanBills?{linkedCategory:'Savings'}:{})}});made.current.add('goal');}
   await client.invalidateQueries({queryKey:['snapshot']});
   if(sources.some(valid))done.push(`${sources.filter(valid).length} income source${sources.filter(valid).length===1?'':'s'}`);if(canPlanBills&&bills.some(valid))done.push(`${bills.filter(valid).length} bill${bills.filter(valid).length===1?'':'s'}`);if(canPlanBills&&Number(budget)>0)done.push('a monthly budget');if(goalOk)done.push(`a "${goalName.trim()}" goal`);
   setCreated(done);setStep(5);
  }catch(e){setError((e as Error).message||'Something went wrong. Nothing is lost, press the button to try again.');}finally{setBusy(false);}
 }
 const head=(title:string,text:string)=><div className="wo-intro"><h3>{title}</h3><p>{text}</p></div>;
 const nothing=!sources.some(valid)&&!bills.some(valid)&&!(Number(budget)>0)&&!goalOk;
 return <Dialog open={open} onOpenChange={o=>{if(!o)onClose(created!==null);}} title="Set up your finance" description="A few quick questions. We fill in the rest for you.">
  <div className="fs">
   {step<5&&(()=>{const vis=STEPS.map((n,i)=>({n,i})).filter(x=>canPlanBills||(x.i!==1&&x.i!==2));const pos=Math.max(0,vis.findIndex(x=>x.i===step));return <div className="fs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={vis.length-1} aria-valuenow={pos} aria-label={`Step ${pos+1} of ${vis.length}: ${STEPS[step]}`}><i style={{width:`${pos/Math.max(1,vis.length-1)*100}%`}}/><ol>{vis.map((x,k)=><li key={x.n} className={k===pos?'now':k<pos?'past':''}>{k<pos?<Check size={11} strokeWidth={3}/>:k+1}</li>)}</ol></div>;})()}
   {step===0&&<div className="wo-pane" key="s0">{head('How much do you earn each month?','Your salary or any regular income. You can add more later.')}<div className="fs-chips" role="group" aria-label="Income type">{['Salary','Freelance','Business','Rental income'].map(n=><button type="button" key={n} className={sources[0]?.name===n?'on':''} onClick={()=>setSources(list=>list.map((r,i)=>i===0?{...r,name:n}:r))}>{n}</button>)}</div><Rows rows={sources} setRows={setSources} currency={currency} editableName onRemove={sources.length>1?(id=>setSources(sources.filter(r=>r.id!==id))):undefined}/><button type="button" className="fs-add" onClick={()=>setSources([...sources,{id:`src-${sources.length+1}-${Date.now()}`,name:'Other income',amount:'',day:'1',done:false}])}><Plus size={15}/>Add another income source</button></div>}
   {step===1&&<div className="wo-pane" key="s1">{head('Which bills do you pay every month?','Tap your regular bills, then type the amount.')}<Tiles presets={billTypes.slice(0,10)} rows={bills} onToggle={toggle(bills,setBills)}/>{bills.length>0&&<Rows rows={bills} setRows={setBills} currency={currency}/>}</div>}
   {step===2&&<div className="wo-pane" key="s2">{head('How much do you want to spend each month?','A limit keeps you on track. We warn you at 80%.')}{incomeTotal>0&&<p className="fs-note">Income {money(incomeTotal*100,currency)} · bills {money(billTotal*100,currency)} · left after bills <b className={left<0?'negative':'positive'}>{money(left*100,currency)}</b></p>}<label className="fs-big"><span>Monthly budget ({currency})</span><input inputMode="numeric" placeholder="0" aria-label="Monthly budget" value={group(budget)} onChange={e=>{groupAsTyped(e);setBudget(whole(e.target.value));}}/></label>{suggest.length>0&&<div className="fs-chips" role="group" aria-label="Suggested budgets">{suggest.map(x=><button type="button" key={x.p} className={budget===String(x.v)?'on':''} onClick={()=>setBudget(String(x.v))}>{x.p}% of income · {money(x.v*100,currency)}</button>)}</div>}</div>}
   {step===3&&<div className="wo-pane" key="s3">{head('Saving for something?','A goal gives your savings a purpose. Optional.')}<div className="fs-chips" role="group" aria-label="Goal ideas">{goalIdeas.map(g=><button type="button" key={g} className={goalOn&&goalName===g?'on':''} onClick={()=>{setGoalOn(true);setGoalName(g);}}>{g}</button>)}<button type="button" className={!goalOn?'on':''} onClick={()=>setGoalOn(false)}>Not now</button></div>{goalOn&&<div className="fs-goal"><label><span>Goal name</span><input aria-label="Goal name" value={goalName} onChange={e=>setGoalName(e.target.value)}/></label><label><span>Target amount ({currency})</span><input inputMode="numeric" placeholder="0" aria-label="Goal target" value={group(goalTarget)} onChange={e=>{groupAsTyped(e);setGoalTarget(whole(e.target.value));}}/></label><div><span className="field-label">By when</span><div className="fs-chips" role="group" aria-label="By when">{[3,6,12,24].map(m=><button type="button" key={m} className={goalMonths===m?'on':''} onClick={()=>setGoalMonths(m)}>{m<12?`${m} months`:`${m/12} year${m>12?'s':''}`}</button>)}</div></div></div>}</div>}
   {step===4&&<div className="wo-pane" key="s4">{head('Here is your plan','Check it, then we create everything.')}<div className="fs-summary"><div><Banknote size={18}/><span>Income per month</span><strong>{money(incomeTotal*100,currency)}</strong><small>{sources.filter(valid).length} source{sources.filter(valid).length===1?'':'s'}</small></div>{canPlanBills&&<div><Home size={18}/><span>Bills per month</span><strong>{money(billTotal*100,currency)}</strong><small>{bills.filter(valid).length} bill{bills.filter(valid).length===1?'':'s'}</small></div>}{canPlanBills&&<div><PiggyBank size={18}/><span>Budget</span><strong>{Number(budget)>0?money(Number(budget)*100,currency):'Not set'}</strong><small>per month</small></div>}<div><Target size={18}/><span>Goal</span><strong>{goalOk?goalName:'None'}</strong><small>{goalOk?`${money(Number(goalTarget)*100,currency)} by ${deadline}`:'optional'}</small></div></div>{canPlanBills&&incomeTotal>0&&<p className="fs-note">After bills you keep <b className={left<0?'negative':'positive'}>{money(left*100,currency)}</b> each month.</p>}{!canPlanBills&&<p className="fs-note">Bills and budgets come with Pro and Lifetime. Your income and goal are saved now.</p>}{error&&<p className="error" role="alert">{error}</p>}</div>}
   {step===5&&<div className="wo-pane fs-welcome" key="s5"><span className="fs-badge good"><PartyPopper size={26}/></span><h3>Your finance is ready</h3><p>We created {created&&created.length?created.join(', '):'your setup'}. Everything is on your Overview now.</p></div>}
   <div className="fs-foot">
    {step===0&&<><button type="button" className="fs-ghost" onClick={()=>onClose(false)}>Maybe later</button><span className="fs-spacer"/><button type="button" className="fs-skip" onClick={next}>Skip</button><button type="button" className="fs-primary" onClick={next}>Next<ArrowRight size={16}/></button></>}
    {step>=1&&step<=3&&<><button type="button" className="fs-ghost" onClick={back}><ArrowLeft size={15}/>Back</button><span className="fs-spacer"/><button type="button" className="fs-skip" onClick={next}>Skip</button><button type="button" className="fs-primary" onClick={next}>Next<ArrowRight size={16}/></button></>}
    {step===4&&<><button type="button" className="fs-ghost" onClick={back}><ArrowLeft size={15}/>Back</button><span className="fs-spacer"/><button type="button" className="fs-primary" disabled={busy||nothing} onClick={()=>void create()}>{busy?'Creating…':error?'Try again':'Create my finance plan'}<Rocket size={16}/></button></>}
    {step===5&&<><span className="fs-spacer"/><button type="button" className="fs-primary" onClick={finish}>Open my overview<ArrowRight size={16}/></button></>}
   </div>
  </div>
 </Dialog>;
}
