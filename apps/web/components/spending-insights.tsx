'use client';
import {CalendarDays,CircleAlert,PieChart,PiggyBank,ReceiptText,TrendingUp,Sparkles} from 'lucide-react';
import {money,type Snapshot,type metrics} from '@ledger/shared';
import {Panel} from './dashboard-charts';
import {AnimatedProgress} from './animation';
import {buildInsights,type Insight} from '../lib/insights';
type Metrics=ReturnType<typeof metrics>;
const icons={pace:TrendingUp,weekend:CalendarDays,category:PieChart,savings:PiggyBank,largest:ReceiptText} as const;
export function BudgetPulse({m}:{m:Metrics}){
 const usage=m.budget?Math.min(100,Math.round((m.expenses/m.budget)*100)):0;const left=m.budget?m.budget-m.expenses:0;
 return <Panel className="budget-pulse"><div className="panel-heading"><div><h2>Budget vs actual</h2><p>{m.budget?`${money(m.expenses,m.currency)} spent of ${money(m.budget,m.currency)}`:'Set a monthly budget to track your pace.'}</p></div></div>
  {m.budget?<><div className="pulse-figure"><strong className={left<0?'negative':'positive'}>{money(Math.abs(left),m.currency)}</strong><span>{left<0?'over budget':'left this month'}</span></div><div className={`pulse-bar ${usage>=100?'is-over':usage>=80?'is-hot':''}`}><AnimatedProgress value={usage}/></div><div className="pulse-scale"><span>{usage}% used</span><span>{money(m.budget,m.currency)}</span></div></>:<p className="muted">Your budget bar appears here once you set an overall limit.</p>}
 </Panel>;
}
export function SpendingInsights({s,m}:{s:Snapshot;m:Metrics}){
 const items:Insight[]=buildInsights(s.records,m);
 return <Panel className="insights-panel"><div className="panel-heading"><div><h2>Smart insights</h2><p>Based only on your recorded transactions</p></div><Sparkles size={18} aria-hidden="true"/></div>
  {items.length?<ul className="insight-list">{items.map(item=>{const Icon=item.tone==='warn'?CircleAlert:icons[item.id];return <li key={item.id} data-tone={item.tone}><span className="insight-icon"><Icon size={17}/></span><div><strong>{item.title}</strong><p>{item.text}</p></div></li>;})}</ul>:<p className="muted">Record a few expenses and your personal insights will appear here.</p>}
 </Panel>;
}
