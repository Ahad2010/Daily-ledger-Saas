import {monthDates,recordsOf,schemas,localDate,money,type LedgerRecord,type RecordData} from './index';

export function planDate(month:string,day:number){return `${month}-${String(Math.min(day,monthDates(month).length)).padStart(2,'0')}`;}
export function monthBudgets(records:LedgerRecord[],month:string,currency:string){const eligible=recordsOf(records,'budget').filter(r=>r.data.currency===currency&&(r.data.month===month||(r.data.repeats&&r.data.month<=month)));const selected=new Map<string,LedgerRecord<'budget'>>();for(const r of eligible){const key=(r.data.category||'').toLowerCase();const old=selected.get(key);if(!old||(!r.data.repeats&&r.data.month===month)||r.data.month>old.data.month)selected.set(key,r);}return [...selected.values()];}
export function settledTransaction(records:LedgerRecord[],id:string,month:string){return recordsOf(records,'transaction').find(r=>r.data.sourceId===id&&r.data.sourceMonth===month);}
export function planTransaction(plan:LedgerRecord<'cashPlan'>,month:string,date:string):RecordData['transaction']{return schemas.transaction.parse({...plan.data,date,sourceId:plan.id,sourceMonth:month});}
export function budgetSpending(budget:LedgerRecord<'budget'>,records:LedgerRecord[],month:string,end:string){return recordsOf(records,'transaction').filter(r=>r.data.type==='expense'&&r.data.currency===budget.data.currency&&r.data.date.startsWith(month)&&r.data.date<=end&&(!budget.data.category||r.data.category===budget.data.category)).reduce((sum,r)=>sum+r.data.amount,0);}
export function loanEstimate(principal:number,annualRate:number,months:number){if(!Number.isFinite(principal+annualRate+months)||principal<0||annualRate<0||!Number.isInteger(months)||months<1||months>1200)return null;const rate=annualRate/1200;const payment=rate?principal*rate/(1-Math.pow(1+rate,-months)):principal/months;return {payment,interest:Math.max(0,payment*months-principal),total:payment*months};}
export function savingsEstimate(start:number,deposit:number,annualRate:number,months:number){if(!Number.isFinite(start+deposit+annualRate+months)||Math.min(start,deposit,annualRate)<0||!Number.isInteger(months)||months<0||months>1200)return null;const rate=annualRate/1200;const growth=Math.pow(1+rate,months);const total=start*growth+(rate?deposit*(growth-1)/rate:deposit*months);return Number.isFinite(total)?{total,contributed:start+deposit*months,interest:total-start-deposit*months}:null;}
export function debtEstimate(balance:number,annualRate:number,payment:number){if(!Number.isFinite(balance+annualRate+payment)||Math.min(balance,annualRate)<0||payment<=0)return null;let remaining=balance,total=0,months=0;const rate=annualRate/1200;if(balance>0&&payment<=balance*rate)return {unpayable:true,months:0,interest:0};while(remaining>.005&&months<1200){const due=remaining*(1+rate);const paid=Math.min(payment,due);remaining=due-paid;total+=paid;months++;}return {unpayable:remaining>.005,months,interest:Math.max(0,total-balance)};}


// Budget alerts fire once per budget, month and threshold when real spending reaches 80% and 100%.
export const budgetThresholds=[80,100] as const;
export function budgetAlertEnd(month:string,timezone:string,now=new Date()){const today=localDate(now,timezone);return month===today.slice(0,7)?today:monthDates(month).at(-1)!;}
export function budgetAlerts(records:LedgerRecord[],month:string,currency:string,end:string){
 return monthBudgets(records,month,currency).flatMap(budget=>{
  if(budget.data.amount<=0)return [];
  const spent=budgetSpending(budget,records,month,end),percent=spent/budget.data.amount*100,threshold=percent>=100?100:percent>=80?80:0;
  return threshold?[{budgetId:budget.id,version:budget.version,name:budget.data.category||budget.data.title,threshold,percent,spent,amount:budget.data.amount,currency,month}]:[];
 });
}
export function budgetAlertText(alert:{name:string;threshold:number;spent:number;amount:number;currency:string}){
 return alert.threshold>=100
  ?{title:`${alert.name}: budget reached`,body:`You have spent ${money(alert.spent,alert.currency)} of your ${money(alert.amount,alert.currency)} budget${alert.spent>alert.amount?` (${money(alert.spent-alert.amount,alert.currency)} over)`:''}.`}
  :{title:`${alert.name}: 80% of budget used`,body:`You have spent ${money(alert.spent,alert.currency)} of ${money(alert.amount,alert.currency)}. ${money(alert.amount-alert.spent,alert.currency)} remains this month.`};
}
