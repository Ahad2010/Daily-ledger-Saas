import {money,monthDates,recordsOf,type LedgerRecord,type metrics} from '@ledger/shared';
type Metrics=ReturnType<typeof metrics>;
export type Insight={id:'pace'|'weekend'|'category'|'savings'|'largest';tone:'good'|'warn'|'info';title:string;text:string};
const dayOfWeek=(date:string)=>new Date(`${date}T12:00:00Z`).getUTCDay();
// Every insight is computed from the user's own recorded transactions; nothing is estimated beyond simple arithmetic.
export function buildInsights(records:LedgerRecord[],m:Metrics):Insight[]{
 const spend=recordsOf(records,'transaction').filter(r=>r.data.currency===m.currency&&r.data.type==='expense'&&r.data.date.startsWith(m.month)&&r.data.date<=m.end);
 if(!spend.length)return [];
 const insights:Insight[]=[];const days=monthDates(m.month);const elapsed=days.filter(d=>d<=m.end);
 if(m.budget){
  if(m.partial&&elapsed.length>=5){const projected=Math.round(m.expenses/elapsed.length*days.length);const over=projected>m.budget;insights.push({id:'pace',tone:over?'warn':'good',title:over?'On pace to pass your budget':'On pace to stay within budget',text:`At this pace you will spend ${money(projected,m.currency)} this month against a ${money(m.budget,m.currency)} budget.`});}
  else if(!m.partial){const over=m.expenses>m.budget;insights.push({id:'pace',tone:over?'warn':'good',title:over?'Budget exceeded':'Finished within budget',text:`You spent ${money(m.expenses,m.currency)} of a ${money(m.budget,m.currency)} budget.`});}
 }
 const weekendDays=elapsed.filter(d=>[0,6].includes(dayOfWeek(d))).length,weekdayDays=elapsed.length-weekendDays;
 const weekend=spend.filter(r=>[0,6].includes(dayOfWeek(r.data.date))).reduce((n,r)=>n+r.data.amount,0),weekday=spend.reduce((n,r)=>n+r.data.amount,0)-weekend;
 if(weekendDays&&weekdayDays&&weekend>0&&weekday>0){const ratio=(weekend/weekendDays)/(weekday/weekdayDays);
  if(ratio>=1.25)insights.push({id:'weekend',tone:'info',title:'Weekends cost more',text:`You spend about ${Math.round((ratio-1)*100)}% more per day on weekends than on weekdays.`});
  else if(ratio<=.8)insights.push({id:'weekend',tone:'info',title:'Weekdays cost more',text:`You spend about ${Math.round((1/ratio-1)*100)}% more per day on weekdays than on weekends.`});}
 const top=[...m.categories].sort((a,b)=>b.amount-a.amount)[0];
 if(top&&m.categories.length>1&&spend.length>=3)insights.push({id:'category',tone:'info',title:`${top.name} leads your spending`,text:`${money(top.amount,m.currency)} is ${Math.round(top.percentage)}% of everything you spent so far.`});
 if(m.income>0&&m.savingsRate!==null){const rate=Math.round(m.savingsRate);insights.push({id:'savings',tone:rate>=20?'good':rate<10?'warn':'info',title:rate>=20?'Strong savings rate':rate<10?'Savings are running low':'Steady savings rate',text:`You kept ${rate}% of your income this period.`});}
 const largest=[...spend].sort((a,b)=>b.data.amount-a.data.amount)[0];
 if(spend.length>=3)insights.push({id:'largest',tone:'info',title:'Largest single expense',text:`${largest.data.title} on ${largest.data.date} cost ${money(largest.data.amount,m.currency)}.`});
 return insights.slice(0,4);
}
