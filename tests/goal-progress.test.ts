import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot,goalProgress,schemas,type LedgerRecord} from '../packages/shared/src/index';
test('goal progress uses saved checkpoints only in step mode',()=>{
 const snapshot=demoSnapshot(),goal=snapshot.records.find(r=>r.kind==='goal') as LedgerRecord<'goal'>;
 assert.equal(goalProgress(goal,snapshot.records).percentage,60);
 const stepGoal={...goal,data:{...goal.data,tracking:'steps' as const}};
 assert.deepEqual([goalProgress(stepGoal,[]).percentage,goalProgress(stepGoal,[]).done],[0,false]);
 const steps=[{id:'one',kind:'milestone' as const,version:1,data:{title:'First step',goalId:goal.id,done:true}},{id:'two',kind:'milestone' as const,version:1,data:{title:'Second step',goalId:goal.id,done:false}}];
 assert.equal(goalProgress(stepGoal,steps).percentage,50);assert.equal(goalProgress(stepGoal,steps).done,false);
 steps[1].data.done=true;assert.equal(goalProgress(stepGoal,steps).percentage,100);assert.equal(goalProgress(stepGoal,steps).done,true);
 assert.equal(schemas.goal.safeParse({...goal.data,tracking:'arbitrary'}).success,false);
});
