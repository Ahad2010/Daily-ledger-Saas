import {recordsOf,type LedgerRecord,type Snapshot} from '@ledger/shared';
export type Exercise={name:string;sets:{reps:number;weight:number}[]};
export type Program={id:string;name:string;level:string;blurb:string;days:{title:string;type:string;duration:number;exercises:Exercise[]}[]};
const sets=(n:number,reps:number,weight=0)=>Array.from({length:n},()=>({reps,weight}));
const ex=(name:string,n:number,reps:number):Exercise=>({name,sets:sets(n,reps)});
export const programs:Program[]=[
 {id:'full-body-3',name:'Full body, 3 days',level:'Beginner',blurb:'Three simple sessions a week covering every muscle group.',days:[
  {title:'Full body A',type:'Strength',duration:50,exercises:[ex('Squat',3,8),ex('Bench press',3,8),ex('Barbell row',3,8),ex('Plank (seconds)',3,30)]},
  {title:'Full body B',type:'Strength',duration:50,exercises:[ex('Deadlift',3,5),ex('Overhead press',3,8),ex('Lat pulldown',3,10),ex('Lunges',3,10)]},
  {title:'Full body C',type:'Strength',duration:50,exercises:[ex('Leg press',3,10),ex('Incline dumbbell press',3,10),ex('Seated cable row',3,10),ex('Bicep curl',3,12)]}]},
 {id:'push-pull-legs',name:'Push / Pull / Legs',level:'Intermediate',blurb:'A classic 3-day split you can run once or twice a week.',days:[
  {title:'Push day',type:'Strength',duration:60,exercises:[ex('Bench press',4,8),ex('Overhead press',3,8),ex('Incline dumbbell press',3,10),ex('Tricep pushdown',3,12),ex('Lateral raise',3,15)]},
  {title:'Pull day',type:'Strength',duration:60,exercises:[ex('Deadlift',3,5),ex('Pull-up',4,8),ex('Barbell row',3,8),ex('Face pull',3,15),ex('Bicep curl',3,12)]},
  {title:'Leg day',type:'Strength',duration:60,exercises:[ex('Squat',4,8),ex('Romanian deadlift',3,10),ex('Leg press',3,12),ex('Leg curl',3,12),ex('Calf raise',4,15)]}]},
 {id:'home-bodyweight',name:'Home, no equipment',level:'Beginner',blurb:'Bodyweight sessions you can do anywhere in about 30 minutes.',days:[
  {title:'Home upper body',type:'Bodyweight',duration:30,exercises:[ex('Push-ups',4,12),ex('Pike push-ups',3,8),ex('Dips (chair)',3,10),ex('Plank (seconds)',3,40)]},
  {title:'Home lower body',type:'Bodyweight',duration:30,exercises:[ex('Squats',4,15),ex('Lunges',3,12),ex('Glute bridge',3,15),ex('Calf raise',3,20)]},
  {title:'Home cardio and core',type:'Cardio',duration:30,exercises:[ex('Jumping jacks',3,40),ex('Mountain climbers',3,30),ex('Crunches',3,20),ex('Leg raises',3,12)]}]},
];
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
// Schedules a program on its days from tomorrow, spread every other day so rest days are built in.
export function scheduleProgram(program:Program,from:string){return program.days.map((day,i)=>({...day,date:shift(from,1+i*2),program:program.name}));}
export const setVolume=(e:Exercise)=>e.sets.reduce((n,s)=>n+s.reps*s.weight,0);
export const workoutVolume=(w:LedgerRecord<'workout'>)=>(w.data.exercises||[]).reduce((n,e)=>n+setVolume(e),0);
// Epley estimate of a one-rep maximum for the heaviest meaningful set.
export const oneRepMax=(weight:number,reps:number)=>reps<=1?weight:Math.round(weight*(1+reps/30)*10)/10;
export type Record1={name:string;weight:number;reps:number;e1rm:number;date:string};
export function personalRecords(s:Snapshot):Record1[]{
 const best=new Map<string,Record1>();
 recordsOf(s.records,'workout').filter(w=>w.data.done).forEach(w=>(w.data.exercises||[]).forEach(e=>e.sets.forEach(set=>{
  if(set.weight<=0||set.reps<=0)return;const e1rm=oneRepMax(set.weight,set.reps);const found=best.get(e.name);
  if(!found||e1rm>found.e1rm)best.set(e.name,{name:e.name,weight:set.weight,reps:set.reps,e1rm,date:w.data.date});
 })));
 return [...best.values()].sort((a,b)=>b.e1rm-a.e1rm);
}
export function weekSummary(s:Snapshot,today:string){
 const from=shift(today,-6);const done=recordsOf(s.records,'workout').filter(w=>w.data.done&&w.data.date>=from&&w.data.date<=today);
 return {sessions:done.length,minutes:done.reduce((n,w)=>n+w.data.duration,0),volume:done.reduce((n,w)=>n+workoutVolume(w),0)};
}
export function weightTrend(s:Snapshot){
 const rows=recordsOf(s.records,'bodyMetric').slice().sort((a,b)=>a.data.date.localeCompare(b.data.date));
 const first=rows[0],last=rows.at(-1);
 return {rows,change:first&&last&&first!==last?Math.round((last.data.weight-first.data.weight)*10)/10:null,latest:last?.data.weight??null};
}
export const exerciseNames=['Squat','Bench press','Deadlift','Overhead press','Barbell row','Pull-up','Lat pulldown','Leg press','Romanian deadlift','Incline dumbbell press','Bicep curl','Tricep pushdown','Lateral raise','Lunges','Plank (seconds)','Push-ups','Dips (chair)','Calf raise','Leg curl','Face pull'];
