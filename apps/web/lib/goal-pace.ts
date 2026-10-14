import {goalProgress,type LedgerRecord} from '@ledger/shared';
export type GoalPace={status:'done'|'ahead'|'on-track'|'at-risk'|'overdue';label:string;remaining:number;perWeek:number|null;projected:string|null};
const dayMs=86400000;
const stamp=(date:string)=>Date.parse(`${date}T12:00:00Z`);
// Pace compares progress with the share of time used. Goals saved before a start date existed only get the weekly amount needed.
export function goalPace(goal:LedgerRecord<'goal'>,progress:ReturnType<typeof goalProgress>,today:string):GoalPace{
 const remaining=Math.max(0,progress.target-progress.current);
 if(progress.done)return {status:'done',label:'Achieved',remaining:0,perWeek:null,projected:null};
 const daysLeft=Math.ceil((stamp(goal.data.deadline)-stamp(today))/dayMs);
 if(daysLeft<0)return {status:'overdue',label:'Past target',remaining,perWeek:null,projected:null};
 const perWeek=remaining/Math.max(1,daysLeft/7);
 const start=goal.data.startDate;const total=start?Math.ceil((stamp(goal.data.deadline)-stamp(start))/dayMs):0;const used=start?Math.max(0,Math.ceil((stamp(today)-stamp(start))/dayMs)):0;
 if(!start||total<=0)return {status:'on-track',label:'In progress',remaining,perWeek,projected:null};
 const timeShare=Math.min(1,used/total)*100;const gap=progress.percentage-timeShare;
 const rate=used>0?progress.current/used:0;const projected=rate>0?new Date(stamp(today)+Math.ceil(remaining/rate)*dayMs).toISOString().slice(0,10):null;
 if(gap>=10)return {status:'ahead',label:'Ahead of pace',remaining,perWeek,projected};
 if(gap>=-10)return {status:'on-track',label:'On track',remaining,perWeek,projected};
 return {status:'at-risk',label:'Behind pace',remaining,perWeek,projected};
}
