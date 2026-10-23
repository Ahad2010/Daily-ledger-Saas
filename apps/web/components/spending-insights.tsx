'use client';
import Link from 'next/link';
import {ArrowRight,CalendarDays,CircleAlert,PieChart,PiggyBank,Plus,ReceiptText,TrendingUp,Sparkles} from 'lucide-react';
import {money,type Snapshot,type metrics} from '@ledger/shared';
import {Panel} from './dashboard-charts';
import {AnimatedProgress} from './animation';
import {buildInsights,type Insight} from '../lib/insights';
type Metrics=ReturnType<typeof metrics>;
// Shown on a new workspace so the cards explain what they will do. Wording only, never numbers that look like the user's own.
const previews=[{id:'pace',tone:'good',title:'Your spending pace',text:'See whether you are on track to stay inside your budget this month.'},{id:'category',tone:'good',title:'Where your money goes',text:'Find the category that takes the biggest share of your spending.'},{id:'savings',tone:'good',title:'Your savings rate',text:'Know how much of your income you keep after expenses.'},{id:'largest',tone:'good',title:'Biggest single expense',text:'Spot the one purchase that moved your month the most.'}] as const;
const icons={pace:TrendingUp,weekend:CalendarDays,category:PieChart,savings:PiggyBank,largest:ReceiptText} as const;
export function BudgetPulse({m}:{m:Metrics}){
 const usage=m.budget?Math.min(100,Math.round((m.expenses/m.budget)*100)):0;const left=m.budget?m.budget-m.expenses:0;
 return <Panel className="budget-pulse"><div className="panel-heading"><div><h2>Budget vs actual</h2><p>{m.budget?`${money(m.expenses,m.currency)} spent of ${money(m.budget,m.currency)}`:'Set a monthly budget to track your pace.'}</p></div></div>
  {m.budget?<><div className="pulse-figure"><strong className={left<0?'negative':'positive'}>{money(Math.abs(left),m.currency)}</strong><span>{left<0?'over budget':'left this month'}</span></div><div className={`pulse-bar ${usage>=100?'is-over':usage>=80?'is-hot':''}`}><AnimatedProgress value={usage}/></div><div className="pulse-scale"><span>{usage}% used</span><span>{money(m.budget,m.currency)}</span></div></>:<div className="pulse-empty"><div className="pulse-preview" aria-hidden="true"><span className="preview-tag">Example</span><div className="pulse-figure"><strong>$1,200</strong><span>left this month</span></div><div className="pulse-bar"><div className="progress"><div style={{width:'40%'}}/></div></div><div className="pulse-scale"><span>40% used</span><span>$2,000</span></div></div><p className="muted">Set one overall monthly limit and a live bar shows how much is left, day by day.</p><Link className="button" href="/finance/budgets">Set a budget<ArrowRight size={14}/></Link></div>}
 </Panel>;
}
export function SpendingInsights({s,m,stack=false,onAdd}:{s:Snapshot;m:Metrics;stack?:boolean;onAdd?:()=>void}){
 const items:Insight[]=buildInsights(s.records,m);
 return <Panel className={`insights-panel${stack?' insights-stack':''}`}><div className="panel-heading"><div><h2>Smart insights</h2><p>Based only on your recorded transactions</p></div><Sparkles size={18} aria-hidden="true"/></div>
  {items.length?<ul className="insight-list">{items.map(item=>{const Icon=item.tone==='warn'?CircleAlert:icons[item.id];return <li key={item.id} data-tone={item.tone}><span className="insight-icon"><Icon size={17}/></span><div><strong>{item.title}</strong><p>{item.text}</p></div></li>;})}</ul>:<><ul className="insight-list insight-preview" aria-label="Examples of the insights you will see">{previews.map(item=>{const Icon=icons[item.id as keyof typeof icons];return <li key={item.id} data-tone={item.tone}><span className="insight-icon"><Icon size={17}/></span><div><strong>{item.title}</strong><p>{item.text}</p></div></li>;})}</ul><div className="insight-cta"><p className="muted">Log a couple of expenses this month and these turn into your own personal insights.</p>{onAdd&&<button type="button" className="button" onClick={onAdd}><Plus size={14}/>Add your first expense</button>}</div></>}
 </Panel>;
}
