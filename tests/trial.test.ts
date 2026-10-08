import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const task=(title:string)=>({kind:'task',data:{title,description:'',due:'2030-01-01T00:00:00Z',priority:'low',done:false,reminder:false,recurrence:'none'}});

test('free trial: one per account, server-enforced, expires into normal Free limits without deleting data',{skip,timeout:120000},async()=>{
 const api=await startApi(4041);
 try{
  const free=await api.user({plan:'Free'}),pro=await api.user({plan:'Pro'});
  const before=await free.json('/api/snapshot');assert.equal(before.profile.plan,'Free');assert.equal(before.planDetails.trial.available,true);
  assert.equal((await pro.request('/api/billing/trial','POST')).status,409,'a paid account cannot start a trial');
  // Concurrent clicks start exactly one trial.
  const results=await Promise.all(Array.from({length:6},()=>free.request('/api/billing/trial','POST')));
  assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,5);
  const during=await free.json('/api/snapshot');assert.equal(during.profile.plan,'Pro');assert.equal(during.planDetails.trial.available,false);assert.equal(during.planDetails.trial.used,true);
  const endsAt=new Date(during.planDetails.trial.endsAt).getTime();assert.ok(Math.abs(endsAt-(Date.now()+7*86400000))<60000,'trial lasts seven days');
  // Free caps (5 unfinished tasks) are lifted during the trial.
  const created=await Promise.all(Array.from({length:8},(_,i)=>free.request('/api/records','POST',task('Trial task '+i))));assert.equal(created.filter(r=>r.status===201).length,8);
  // Trial end: access reverts by itself, records stay, new above-limit work is blocked, no second trial.
  await api.pool.query('UPDATE "EntitlementOverride" SET "expiresAt"=NOW()-INTERVAL \'1 minute\' WHERE "userId"=$1',[free.id]);
  const after=await free.json('/api/snapshot');assert.equal(after.profile.plan,'Free');assert.equal(after.planDetails.trial.available,false);assert.equal(after.planDetails.trial.endsAt,null);assert.equal(after.records.filter((r:any)=>r.kind==='task').length,8);
  assert.equal((await free.request('/api/records','POST',task('Over the Free limit'))).status,403);
  assert.equal((await free.request('/api/billing/trial','POST')).status,409);
  const details=await free.json('/api/billing');assert.deepEqual(details.payments,[]);assert.equal(details.paymentsConfigured,false);assert.equal(details.trial.used,true);
 }finally{await api.stop();}
});

test('a suspended account cannot start a trial',{skip,timeout:60000},async()=>{
 const api=await startApi(4042);
 try{const banned=await api.user({status:'suspended'});assert.equal((await banned.request('/api/billing/trial','POST')).status,403);}finally{await api.stop();}
});
