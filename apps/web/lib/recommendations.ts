import {monthBudgets,recordsOf,type LedgerRecord,type metrics} from '@ledger/shared';
type Metrics=ReturnType<typeof metrics>;
export type Recommendation={name:string;current:number;target:number|null;source:'budget'|'lastMonth'|null;saving:number;note:string};
function previousMonth(month:string){const [y,mo]=month.split('-').map(Number);const d=new Date(Date.UTC(y,mo-2,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;}
// Targets come only from the user's own category budget, or their own spending in the same days of last month.
// A saving is shown only when current spending is above that target, so nothing is guessed.
export function buildRecommendations(records:LedgerRecord[],m:Metrics):{rows:Recommendation[];total:number}{
 const budgets=monthBudgets(records,m.month,m.currency);const prev=previousMonth(m.month);const throughDay=m.end.slice(8);
 const last=new Map<string,number>();
 for(const r of recordsOf(records,'transaction')){if(r.data.type!=='expense'||r.data.currency!==m.currency||!r.data.date.startsWith(prev)||r.data.date.slice(8)>throughDay)continue;last.set(r.data.category,(last.get(r.data.category)||0)+r.data.amount);}
 const rows=[...m.categories].sort((a,b)=>b.amount-a.amount).slice(0,3).map(c=>{
  const budget=budgets.find(b=>b.data.category===c.name);const lastSpend=last.get(c.name)||0;
  const target=budget?budget.data.amount:lastSpend>0?lastSpend:null;const source=budget?'budget' as const:lastSpend>0?'lastMonth' as const:null;
  const saving=target!==null&&c.amount>target?c.amount-target:0;
  const note=source===null?'Set a budget to get a target':saving?(source==='budget'?'Over your budget':'Higher than last month'):(source==='budget'?'Within your budget':'At or below last month');
  return {name:c.name,current:c.amount,target,source,saving,note};
 });
 return {rows,total:rows.reduce((n,r)=>n+r.saving,0)};
}
