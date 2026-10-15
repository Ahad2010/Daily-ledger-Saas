import {localDate,recordsOf,type Snapshot} from '@ledger/shared';
export type DailyBrief={period:'morning'|'afternoon'|'evening'|'night';greeting:string;line:string;open:{tasks:number;habits:number}};
const plural=(n:number,one:string,many=one+'s')=>`${n} ${n===1?one:many}`;
// A greeting for the account holder's own local time, with counts taken from their own open tasks and scheduled habits.
export function dailyBrief(s:Snapshot,asOf:Date):DailyBrief{
 const timezone=s.profile.timezone;const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:timezone,hour:'numeric',hourCycle:'h23'}).format(asOf));
 const today=localDate(asOf,timezone);const weekday=new Date(`${today}T12:00:00Z`).getUTCDay();
 const period=hour>=5&&hour<12?'morning':hour>=12&&hour<17?'afternoon':hour>=17&&hour<22?'evening':'night';
 const first=(s.profile.name||'').trim().split(/\s+/)[0]||'there';
 const tasks=recordsOf(s.records,'task').filter(r=>!r.data.done&&localDate(r.data.due,timezone)<=today).length;
 const done=new Set(recordsOf(s.records,'completion').filter(r=>r.data.date===today).map(r=>r.data.habitId));
 const habits=recordsOf(s.records,'habit').filter(r=>r.data.active&&r.data.startDate<=today&&r.data.days.includes(weekday)&&!done.has(r.id)).length;
 const greeting=`Good ${period==='night'?'night':period}, ${first}`;
 const open=[tasks?plural(tasks,'task'):'',habits?plural(habits,'habit'):''].filter(Boolean).join(' and ');
 let line:string;
 if(!tasks&&!habits)line=period==='morning'?'Nothing is scheduled yet today. Want to plan your day?':period==='afternoon'?'Your list is clear for now. Anything to add?':'Everything on today’s list is done. Nicely done.';
 else if(period==='morning')line=`You have ${open} for today. Want a plan for the day?`;
 else if(period==='afternoon')line=`${open[0].toUpperCase()+open.slice(1)} still open today. Shall we get them moving?`;
 else line=`${open[0].toUpperCase()+open.slice(1)} still open. Let’s wrap up the day.`;
 return {period,greeting,line,open:{tasks,habits}};
}
