import test from 'node:test';
import assert from 'node:assert/strict';
import {levelAt,xpToReach,tierAt} from '../apps/web/lib/fitness-xp';

test('levels climb with XP and each level starts exactly at its threshold',()=>{
 assert.equal(levelAt(0),1);assert.equal(levelAt(99),1);assert.equal(levelAt(100),2);assert.equal(levelAt(299),2);assert.equal(levelAt(300),3);assert.equal(levelAt(1000),5);
 for(let level=1;level<60;level++){assert.equal(levelAt(xpToReach(level)),level);assert.equal(levelAt(xpToReach(level+1)-1),level);}
});
test('ranks change at 5, 10, 20, 30 and 45',()=>{
 assert.equal(tierAt(1).name,'Rookie');assert.equal(tierAt(4).name,'Rookie');assert.equal(tierAt(5).name,'Mover');assert.equal(tierAt(10).name,'Athlete');assert.equal(tierAt(20).name,'Warrior');assert.equal(tierAt(30).name,'Champion');assert.equal(tierAt(45).name,'Legend');
});

import {scoreWorkouts,DAILY_XP} from '../apps/web/lib/fitness-xp';
const w=(id:string,date:string,title:string,duration=60,extra:object={})=>({id,kind:'workout',version:1,data:{title,date,type:'Strength',duration,done:true,notes:'',...extra}}) as any;

test('farming is capped: same session twice, more than 3 a day and very long days stop earning',()=>{
 const day=[w('a','2026-10-01','Legs'),w('b','2026-10-01','Legs'),w('c','2026-10-01','Arms'),w('d','2026-10-01','Back'),w('e','2026-10-01','Core')];
 const scored=scoreWorkouts(day);
 assert.equal(scored.find(x=>x.w.id==='b')!.xp,0);assert.equal(scored.find(x=>x.w.id==='e')!.xp,0);
 assert.ok(scored.reduce((n,x)=>n+x.xp,0)<=DAILY_XP);
 assert.equal(scoreWorkouts([w('x','2026-10-02','Warm up',3)])[0].xp,10);
 assert.equal(scoreWorkouts([w('y','2026-10-02','Marathon',1000)])[0].xp,scoreWorkouts([w('z','2026-10-03','Marathon',90)])[0].xp);
});
