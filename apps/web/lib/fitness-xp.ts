import {recordsOf,type LedgerRecord,type Snapshot} from '@ledger/shared';
import {workoutVolume} from './fitness';

type Workout=LedgerRecord<'workout'>;
export const TIERS=[{min:1,name:'Rookie',color:'#9aa7a1'},{min:5,name:'Mover',color:'#4cc3ff'},{min:10,name:'Athlete',color:'#4ade80'},{min:20,name:'Warrior',color:'#f6c453'},{min:30,name:'Champion',color:'#ff9b52'},{min:45,name:'Legend',color:'#ff5d9a'}] as const;

/** XP for one finished session: showing up, time spent, effort, logged sets and weight moved. */
export const workoutXp=(w:Workout)=>50+Math.min(w.data.duration,90)+({Easy:0,Moderate:10,Hard:25}[(w.data.intensity||'Moderate') as 'Easy'|'Moderate'|'Hard'])+(w.data.exercises?.length?20:0)+Math.min(50,Math.floor(workoutVolume(w)/1000)*5);
/** Total XP needed to reach a level: 0, 100, 300, 600, 1000... */
export const xpToReach=(level:number)=>50*(level-1)*level;
export const levelAt=(xp:number)=>Math.max(1,Math.floor((1+Math.sqrt(1+0.08*Math.max(0,xp)))/2));
export const tierAt=(level:number)=>[...TIERS].reverse().find(t=>level>=t.min)||TIERS[0];
const shift=(date:string,days:number)=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);

export type Badge={id:string;name:string;hint:string;done:boolean};
export function fitnessStats(s:Snapshot,today:string){
 const done=recordsOf(s.records,'workout').filter(w=>w.data.done&&w.data.date<=today);
 const xp=done.reduce((n,w)=>n+workoutXp(w),0),level=levelAt(xp),floor=xpToReach(level),ceil=xpToReach(level+1);
 const days=new Set(done.map(w=>w.data.date));let streak=0,cursor=days.has(today)?today:shift(today,-1);while(days.has(cursor)){streak++;cursor=shift(cursor,-1);}
 const from=shift(today,-6),week=done.filter(w=>w.data.date>=from);
 const minutes=done.reduce((n,w)=>n+w.data.duration,0),withSets=done.filter(w=>w.data.exercises?.length).length;
 const weekXp=week.reduce((n,w)=>n+workoutXp(w),0);
 const quests=[{id:'sessions',label:'Train 3 times',value:week.length,target:3,unit:'sessions'},{id:'minutes',label:'Move for 150 minutes',value:week.reduce((n,w)=>n+w.data.duration,0),target:150,unit:'min'},{id:'sets',label:'Log a session with sets',value:week.filter(w=>w.data.exercises?.length).length,target:1,unit:'logged'}];
 const badges:Badge[]=[{id:'first',name:'First step',hint:'Finish your first workout',done:done.length>=1},{id:'five',name:'Getting serious',hint:'Finish 5 workouts',done:done.length>=5},{id:'ten',name:'Double digits',hint:'Finish 10 workouts',done:done.length>=10},{id:'streak3',name:'On fire',hint:'Train 3 days in a row',done:streak>=3||longest(days)>=3},{id:'hour',name:'Time well spent',hint:'Reach 500 minutes',done:minutes>=500},{id:'sets',name:'Tracker',hint:'Log a session with sets',done:withSets>=1},{id:'lvl5',name:'Mover',hint:'Reach level 5',done:level>=5}];
 return {xp,level,tier:tierAt(level),floor,ceil,into:xp-floor,span:ceil-floor,streak,weekXp,quests,badges,sessions:done.length,minutes};
}
function longest(days:Set<string>){let best=0;for(const d of days){if(days.has(shift(d,-1)))continue;let n=0,c=d;while(days.has(c)){n++;c=shift(c,1);}best=Math.max(best,n);}return best;}
