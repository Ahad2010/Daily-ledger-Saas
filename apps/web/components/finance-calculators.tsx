'use client';
import Link from 'next/link';
import {useState} from 'react';
import {ArrowDownLeft,ArrowRight,ArrowUpRight,Calculator,Clock,Flame,PieChart,Receipt,Repeat2,ShieldCheck,Split,Sparkles,Target,TrendingUp,Wallet} from 'lucide-react';
import {debtEstimate,loanEstimate,money,savingsEstimate} from '@ledger/shared';
import {Entrance} from './animation';
import {EmptyState} from './empty-state';
import {Select} from './ui/select';

type Tone='good'|'bad'|undefined;
export interface CalcContext{currency:string;income:number;expenses:number;recurring:number}
interface Field{key:string;label:string;suffix?:string;def:string;integer?:boolean}
interface Out{label:string;value:string;tone?:Tone}
interface Result{headline?:Out;outs:Out[];bar?:{label:string;parts:{label:string;value:number;color:string}[]};progress?:{label:string;value:number};error?:string;message?:string}
interface Calc{slug:string;title:string;description:string;icon:typeof Calculator;group:string;fields:Field[];note:string;prefillLabel?:string;prefill?:(c:CalcContext)=>Record<string,string>;compute:(n:(k:string)=>number,fmt:(v:number)=>string,ctx:CalcContext,extra:string)=>Result|null}

const ok=(...v:number[])=>v.every(Number.isFinite)&&Math.min(...v)>=0;
const pct=(v:number)=>`${(Math.round(v*10)/10).toLocaleString()}%`;

export const calculatorGroups=['Borrow and repay','Save and grow','Plan your money','Everyday tools'] as const;
export const calculators:Calc[]=[
 {slug:'loan',group:'Borrow and repay',icon:Receipt,title:'Loan & EMI',description:'Monthly repayment and total interest.',note:'Fixed annual interest, monthly payments. Excludes fees, taxes and insurance.',
  fields:[{key:'principal',label:'Loan amount',suffix:'$',def:'100000'},{key:'rate',label:'Annual interest rate',suffix:'%',def:'8'},{key:'years',label:'Term',suffix:'years',def:'5'}],
  compute:(n,f)=>{const e=loanEstimate(n('principal'),n('rate'),n('years')*12);if(!e)return null;return {headline:{label:'Monthly payment',value:f(e.payment)},outs:[{label:'Total interest',value:f(e.interest)},{label:'Total repaid',value:f(e.total)}],bar:{label:'Where your repayments go',parts:[{label:'Principal',value:e.total-e.interest,color:'#b6f26b'},{label:'Interest',value:e.interest,color:'#ff9b7a'}]}};}},
 {slug:'debt',group:'Borrow and repay',icon:ArrowDownLeft,title:'Debt payoff',description:'Time to clear a balance with fixed payments.',note:'Fixed monthly interest; payments at month end. Excludes fees and new borrowing.',
  fields:[{key:'balance',label:'Debt balance',suffix:'$',def:'10000'},{key:'rate',label:'Annual interest rate',suffix:'%',def:'18'},{key:'payment',label:'Monthly payment',suffix:'$',def:'500'}],
  compute:(n,f)=>{const e=debtEstimate(n('balance'),n('rate'),n('payment'));if(!e)return null;if(e.unpayable)return {error:'This payment does not clear the balance within 100 years. Increase the monthly payment.',outs:[]};const years=Math.floor(e.months/12),rest=e.months%12;return {headline:{label:'Debt-free in',value:`${years?`${years}y `:''}${rest}m`},outs:[{label:'Months to clear',value:String(e.months)},{label:'Total interest',value:f(e.interest),tone:'bad'}],bar:{label:'Balance versus interest',parts:[{label:'Balance',value:n('balance'),color:'#b6f26b'},{label:'Interest',value:e.interest,color:'#ff9b7a'}]}};}},
 {slug:'growth',group:'Save and grow',icon:ArrowUpRight,title:'Savings growth',description:'Starting savings plus monthly deposits.',note:'Assumes a constant return compounded monthly and deposits at month end. Returns are estimates, not guaranteed.',
  fields:[{key:'start',label:'Starting amount',suffix:'$',def:'10000'},{key:'deposit',label:'Monthly deposit',suffix:'$',def:'1000'},{key:'rate',label:'Annual return',suffix:'%',def:'6'},{key:'years',label:'Years',def:'10'}],
  compute:(n,f)=>{const e=savingsEstimate(n('start'),n('deposit'),n('rate'),n('years')*12);if(!e)return null;return {headline:{label:'Projected value',value:f(e.total),tone:'good'},outs:[{label:'Your contributions',value:f(e.contributed)},{label:'Estimated growth',value:f(e.interest),tone:'good'}],bar:{label:'What builds the total',parts:[{label:'Contributed',value:e.contributed,color:'#8fb8ff'},{label:'Growth',value:Math.max(0,e.interest),color:'#b6f26b'}]}};}},
 {slug:'goal',group:'Save and grow',icon:Target,title:'Savings goal',description:'How much to put aside each month.',note:'A simple savings plan with no assumed interest or investment return.',
  fields:[{key:'goal',label:'Goal amount',suffix:'$',def:'50000'},{key:'saved',label:'Already saved',suffix:'$',def:'5000'},{key:'months',label:'Months available',suffix:'months',def:'12',integer:true}],
  compute:(n,f)=>{const remaining=n('goal')-n('saved');if(!(Number.isFinite(remaining+n('months'))&&Math.min(n('goal'),n('saved'))>=0&&Number.isInteger(n('months'))&&n('months')>0&&n('months')<=1200))return null;return {headline:{label:'Save each month',value:f(Math.max(0,remaining)/n('months')),tone:'good'},outs:[{label:'Still to save',value:f(Math.max(0,remaining))}],progress:{label:`${pct(n('goal')?Math.min(100,n('saved')/n('goal')*100):0)} of the goal saved`,value:n('goal')?Math.min(100,n('saved')/n('goal')*100):0}};}},
 {slug:'emergency',group:'Save and grow',icon:ShieldCheck,title:'Emergency fund',description:'How many months of costs your savings cover.',note:'A common target is three to six months of essential spending. Use your real monthly costs.',prefillLabel:'Use this month\'s spending',prefill:c=>({expenses:String(Math.round(c.expenses)||'')}),
  fields:[{key:'expenses',label:'Monthly spending',suffix:'$',def:'2000'},{key:'months',label:'Target cover',suffix:'months',def:'6'},{key:'saved',label:'Saved so far',suffix:'$',def:'3000'},{key:'plan',label:'Months to reach it',suffix:'months',def:'12',integer:true}],
  compute:(n,f)=>{if(!ok(n('expenses'),n('months'),n('saved'),n('plan'))||n('expenses')<=0||n('plan')<1)return null;const target=n('expenses')*n('months'),gap=Math.max(0,target-n('saved')),cover=n('saved')/n('expenses');return {headline:{label:'You are covered for',value:`${(Math.round(cover*10)/10).toLocaleString()} months`,tone:cover>=n('months')?'good':undefined},outs:[{label:'Target fund',value:f(target)},{label:'Still to build',value:f(gap)},{label:'Save each month to get there',value:f(gap/n('plan')),tone:'good'}],progress:{label:`${pct(Math.min(100,n('saved')/target*100))} of your target`,value:Math.min(100,n('saved')/target*100)}};}},
 {slug:'independence',group:'Save and grow',icon:Flame,title:'Financial independence',description:'When savings could cover your spending for life.',note:'Uses the common 4% withdrawal rule of thumb. It is a planning guide, not advice. Returns and inflation will vary.',prefillLabel:'Use this month\'s spending',prefill:c=>({annual:String(Math.round(c.expenses*12)||'')}),
  fields:[{key:'annual',label:'Yearly spending',suffix:'$',def:'24000'},{key:'now',label:'Savings today',suffix:'$',def:'10000'},{key:'monthly',label:'Saved each month',suffix:'$',def:'1000'},{key:'rate',label:'Annual return',suffix:'%',def:'6'},{key:'withdraw',label:'Withdrawal rate',suffix:'%',def:'4'}],
  compute:(n,f)=>{if(!ok(n('annual'),n('now'),n('monthly'),n('rate'),n('withdraw'))||n('withdraw')<=0||n('annual')<=0)return null;const target=n('annual')/(n('withdraw')/100);let balance=n('now'),months=0;const r=n('rate')/100/12;while(balance<target&&months<1200){balance=balance*(1+r)+n('monthly');months++;}if(balance<target)return {error:'At this pace the target is not reached within 100 years. Save more each month or raise the return.',outs:[]};const years=Math.floor(months/12);return {headline:{label:'Time to independence',value:`${years}y ${months%12}m`,tone:'good'},outs:[{label:'Target savings',value:f(target)},{label:'Reached around',value:String(new Date().getFullYear()+Math.ceil(months/12))}],progress:{label:`${pct(Math.min(100,n('now')/target*100))} there today`,value:Math.min(100,n('now')/target*100)}};}},
 {slug:'budget-split',group:'Plan your money',icon:PieChart,title:'50 / 30 / 20 budget',description:'Split income into needs, wants and savings.',note:'A simple starting rule: 50% needs, 30% wants, 20% savings and debt. Adjust it to your life.',prefillLabel:'Use this month\'s income',prefill:c=>({income:String(Math.round(c.income)||'')}),
  fields:[{key:'income',label:'Monthly income',suffix:'$',def:'4000'},{key:'needs',label:'Needs share',suffix:'%',def:'50'},{key:'wants',label:'Wants share',suffix:'%',def:'30'}],
  compute:(n,f,ctx)=>{if(!ok(n('income'),n('needs'),n('wants'))||n('needs')+n('wants')>100)return null;const needs=n('income')*n('needs')/100,wants=n('income')*n('wants')/100,save=n('income')-needs-wants,spent=ctx.expenses;return {headline:{label:'Save each month',value:f(save),tone:'good'},outs:[{label:`Needs · ${pct(n('needs'))}`,value:f(needs)},{label:`Wants · ${pct(n('wants'))}`,value:f(wants)},{label:`Savings · ${pct(100-n('needs')-n('wants'))}`,value:f(save),tone:'good'},...(spent>0?[{label:'You spent this month',value:f(spent),tone:(spent>needs+wants?'bad':'good') as Tone}]:[])],bar:{label:'Your split',parts:[{label:'Needs',value:needs,color:'#8fb8ff'},{label:'Wants',value:wants,color:'#ffb072'},{label:'Savings',value:Math.max(0,save),color:'#b6f26b'}]}};}},
 {slug:'subscriptions',group:'Plan your money',icon:Repeat2,title:'Subscriptions cost',description:'What your regular payments add up to each year.',note:'Weekly payments are converted to a monthly average. Cancel what you do not use.',prefillLabel:'Use my recurring payments',prefill:c=>({monthly:String(Math.round(c.recurring*100)/100||'')}),
  fields:[{key:'monthly',label:'Regular payments per month',suffix:'$',def:'60'},{key:'extra',label:'Other subscriptions per month',suffix:'$',def:'0'}],
  compute:(n,f,ctx)=>{if(!ok(n('monthly'),n('extra')))return null;const m=n('monthly')+n('extra');return {headline:{label:'Per year',value:f(m*12),tone:'bad'},outs:[{label:'Per month',value:f(m)},{label:'Over five years',value:f(m*60)},...(ctx.income>0?[{label:'Share of this month\'s income',value:pct(m/ctx.income*100)}]:[])]};}},
 {slug:'inflation',group:'Plan your money',icon:TrendingUp,title:'Inflation',description:'What prices and savings are worth in the future.',note:'Assumes a steady inflation rate. Real inflation changes year to year.',
  fields:[{key:'amount',label:'Amount today',suffix:'$',def:'1000'},{key:'rate',label:'Yearly inflation',suffix:'%',def:'4'},{key:'years',label:'Years',def:'10'}],
  compute:(n,f)=>{if(!ok(n('amount'),n('rate'),n('years')))return null;const factor=(1+n('rate')/100)**n('years');return {headline:{label:'Costs the same later',value:f(n('amount')*factor),tone:'bad'},outs:[{label:'What today\'s amount will buy',value:f(n('amount')/factor)},{label:'Lost buying power',value:pct((1-1/factor)*100),tone:'bad'}]};}},
 {slug:'percentage',group:'Everyday tools',icon:Calculator,title:'Quick percentage',description:'Discounts, markups, tips and percentages.',note:'Use for a discount, markup or a simple percentage calculation.',
  fields:[{key:'base',label:'Base amount',suffix:'$',def:'10000'},{key:'percentage',label:'Percentage',suffix:'%',def:'15'}],
  compute:(n,f,_c,op)=>{const part=n('base')*n('percentage')/100;if(!(Number.isFinite(part)&&Math.min(n('base'),n('percentage'))>=0&&(op!=='subtract'||n('percentage')<=100)))return null;const result=op==='add'?n('base')+part:op==='subtract'?n('base')-part:part;return {headline:{label:'Result',value:f(result)},outs:[{label:'Percentage amount',value:f(part)}]};}},
 {slug:'split',group:'Everyday tools',icon:Split,title:'Split a bill',description:'Tip and equal shares for a group.',note:'Splits the total equally. Tip is added to the bill before dividing.',
  fields:[{key:'bill',label:'Bill amount',suffix:'$',def:'120'},{key:'tip',label:'Tip',suffix:'%',def:'10'},{key:'people',label:'People',def:'4',integer:true}],
  compute:(n,f)=>{if(!ok(n('bill'),n('tip'),n('people'))||!Number.isInteger(n('people'))||n('people')<1)return null;const tip=n('bill')*n('tip')/100,total=n('bill')+tip;return {headline:{label:'Each person pays',value:f(total/n('people')),tone:'good'},outs:[{label:'Tip',value:f(tip)},{label:'Total with tip',value:f(total)}]};}},
 {slug:'income-rate',group:'Everyday tools',icon:Clock,title:'Hourly to yearly income',description:'See what a rate is worth over a week, month and year.',note:'Useful for freelancers. Uses the hours and weeks you really work, before tax.',
  fields:[{key:'hourly',label:'Hourly rate',suffix:'$',def:'25'},{key:'hours',label:'Hours per week',def:'40'},{key:'weeks',label:'Working weeks per year',def:'48'}],
  compute:(n,f)=>{if(!ok(n('hourly'),n('hours'),n('weeks')))return null;const week=n('hourly')*n('hours'),year=week*n('weeks');return {headline:{label:'Per year',value:f(year),tone:'good'},outs:[{label:'Per week',value:f(week)},{label:'Per month',value:f(year/12)},{label:'Per day (5 days)',value:f(week/5)}]};}},
 {slug:'profit',group:'Everyday tools',icon:Wallet,title:'Business profit',description:'Revenue, costs, margin and break-even.',note:'Profit uses revenue minus total costs. Break-even separately uses fixed costs and per-unit contribution. Excludes tax.',
  fields:[{key:'revenue',label:'Revenue',suffix:'$',def:'10000'},{key:'costs',label:'Total costs',suffix:'$',def:'6000'},{key:'price',label:'Price per unit',suffix:'$',def:'100'},{key:'variable',label:'Variable cost per unit',suffix:'$',def:'40'},{key:'fixed',label:'Fixed costs',suffix:'$',def:'1000'}],
  compute:(n,f)=>{const profit=n('revenue')-n('costs');const margin=n('revenue')>0?profit/n('revenue')*100:null;if(!(Number.isFinite(profit+n('price')+n('variable')+n('fixed'))&&Math.min(n('revenue'),n('costs'),n('price'),n('variable'),n('fixed'))>=0))return null;return {headline:{label:profit<0?'Loss':'Profit',value:f(profit),tone:profit>=0?'good':'bad'},outs:[{label:'Profit margin',value:margin===null?'—':`${margin.toFixed(1)}%`,tone:profit>=0?'good':'bad'},{label:'Break-even units',value:n('price')>n('variable')?String(Math.ceil(n('fixed')/(n('price')-n('variable')))):'Not achievable at this unit price'}]};}}
];
export const calculatorTotalWord='Thirteen';

export function CalculatorHub({month}:{month:string}){
 return <>
  <Entrance className="panel finance-card finance-tool-intro fc-intro"><span className="finance-kicker">YOUR FINANCE TOOLKIT</span><h2>{calculatorTotalWord} practical calculators</h2><p>Choose a tool. Adjust the inputs and see a clear estimate without changing your ledger. Tools marked with a spark can start from your own numbers.</p></Entrance>
  {calculatorGroups.map(group=><section key={group} className="fc-group"><h3>{group}</h3><div className="finance-options calculator-options">{calculators.filter(c=>c.group===group).map(c=><Link key={c.slug} href={`/finance/calculators/${c.slug}?month=${month}`} className="fc-card"><span className="finance-option-icon"><c.icon size={22}/></span><div><strong>{c.title}</strong><p>{c.description}</p></div>{c.prefill&&<em className="fo-stat" title="Can use your own numbers"><Sparkles size={11}/> Uses your data</em>}<ArrowRight size={16}/></Link>)}</div></section>)}
 </>;
}

export function FinanceCalculator({name,ctx,month}:{name:string;ctx:CalcContext;month:string}){
 const info=calculators.find(c=>c.slug===name);
 const [inputs,setInputs]=useState<Record<string,string>>(()=>Object.fromEntries(calculators.flatMap(c=>c.fields.map(f=>[`${c.slug}.${f.key}`,f.def]))));
 const [operation,setOperation]=useState('add');
 if(!info)return <EmptyState title="Calculator not found" description="Go back to the calculators and choose a tool." variant="money"/>;
 const key=(k:string)=>`${info.slug}.${k}`;
 const n=(k:string)=>inputs[key(k)]?.trim()===''?NaN:Number(inputs[key(k)]);
 const fmt=(v:number)=>money(Math.round(v*100),ctx.currency);
 const result=info.compute(n,fmt,ctx,operation);
 const set=(k:string,v:string)=>setInputs(i=>({...i,[key(k)]:v}));
 const related=calculators.filter(c=>c.group===info.group&&c.slug!==info.slug).slice(0,3);
 const out=(o:Out)=><div key={o.label}><span>{o.label}</span><strong className={o.tone===undefined?'':o.tone==='good'?'positive':'negative'}>{o.value}</strong></div>;
 const total=result?.bar?.parts.reduce((s,p)=>s+p.value,0)||0;
 return <Entrance className="panel finance-card finance-calculator fc2">
  <div className="panel-heading"><div><span className="finance-kicker">{ctx.currency} TOOLKIT · {info.group.toUpperCase()}</span><h2>{info.title}</h2><p>{info.description}</p></div><span className="finance-option-icon"><info.icon size={24}/></span></div>
  <div className="finance-calculator-layout">
   <div className="finance-calculator-inputs">
    {info.prefill&&<button type="button" className="fc-prefill" onClick={()=>{const p=info.prefill!(ctx);setInputs(i=>({...i,...Object.fromEntries(Object.entries(p).filter(([,v])=>v!=='').map(([k,v])=>[key(k),v]))}));}}><Sparkles size={14}/>{info.prefillLabel}</button>}
    {info.fields.map(f=><label key={f.key}><span>{f.label}{(f.suffix||f.key==='principal')&&<small>{f.suffix==='$'?ctx.currency:f.suffix}</small>}</span><input aria-label={f.label} type="number" min="0" step={f.integer?'1':'any'} inputMode="decimal" value={inputs[key(f.key)]} onChange={e=>set(f.key,e.target.value)}/></label>)}
    {info.slug==='percentage'&&<label><span>Operation</span><Select label="Operation" value={operation} onChange={setOperation} options={[{value:'add',label:'Add percentage'},{value:'subtract',label:'Subtract percentage'},{value:'of',label:'Percentage of amount'}]}/></label>}
   </div>
   <div className="finance-calculator-results" aria-live="polite">
    {!result&&<p className="muted">Enter valid non-negative values. Terms must be whole months between 1 and 1,200.</p>}
    {result?.error&&<p className="negative" role="status">{result.error}</p>}
    {result&&!result.error&&<>
     {result.headline&&<div className="fc-headline"><span>{result.headline.label}</span><strong className={result.headline.tone===undefined?'':result.headline.tone==='good'?'positive':'negative'}>{result.headline.value}</strong></div>}
     <div className="fc-outs">{result.outs.map(out)}</div>
     {result.bar&&total>0&&<div className="fc-bar" role="img" aria-label={result.bar.label}><small>{result.bar.label}</small><div>{result.bar.parts.map(p=><i key={p.label} style={{flex:Math.max(p.value,0)||0.0001,background:p.color}}/>)}</div><ul>{result.bar.parts.map(p=><li key={p.label}><b style={{background:p.color}}/>{p.label} <span>{pct(p.value/total*100)}</span></li>)}</ul></div>}
     {result.progress&&<div className="fc-progress"><small>{result.progress.label}</small><div><i style={{width:`${Math.min(100,Math.max(0,result.progress.value))}%`}}/></div></div>}
    </>}
   </div>
  </div>
  <p className="finance-calculator-note">{info.note}</p>
  {!!related.length&&<div className="fc-related"><span>More in {info.group.toLowerCase()}</span>{related.map(c=><Link key={c.slug} href={`/finance/calculators/${c.slug}?month=${month}`}><c.icon size={14}/>{c.title}</Link>)}</div>}
 </Entrance>;
}
