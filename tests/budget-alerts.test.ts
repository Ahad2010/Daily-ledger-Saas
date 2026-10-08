import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'UTC'}).format(new Date());
const runWorker=()=>new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','apps/api/src/worker.ts'],{env:{...process.env,RESEND_API_KEY:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',SESSION_SECRET:'feature-session-secret-at-least-32-characters'},stdio:'pipe'});let errors='';child.stderr.on('data',d=>errors+=d);child.once('exit',code=>code===0?resolve():reject(new Error(errors)));});
const expense=(amount:number,category='Food')=>({kind:'transaction',data:{title:'Spend',date:today(),amount,currency:'USD',type:'expense',category,account:'Cash',notes:''}});

test('budget alerts: one in-app notification and push job per threshold, shared by Free, rechecked by the worker',{skip,timeout:180000},async()=>{
 const api=await startApi(4043);
 try{
  const free=await api.user({plan:'Free'}),month=today().slice(0,7);
  const budget=await free.json('/api/records','POST',{kind:'budget',data:{title:'Food budget',month,amount:10000,currency:'USD',category:'Food'}});
  const notes=async()=>(await free.json('/api/snapshot')).records.filter((r:any)=>r.kind==='notification'&&r.data.title.startsWith('Food:'));
  assert.equal((await notes()).length,0);
  await free.json('/api/records','POST',expense(7000));assert.equal((await notes()).length,0,'70% is below the first threshold');
  await free.json('/api/records','POST',expense(1000));const at80=await notes();assert.equal(at80.length,1);assert.match(at80[0].data.title,/80% of budget used/);
  await free.json('/api/records','POST',expense(500));assert.equal((await notes()).length,1,'staying between thresholds does not repeat');
  await free.json('/api/records','POST',expense(1500));const at100=await notes();assert.equal(at100.length,2);assert.ok(at100.some((r:any)=>/budget reached/.test(r.data.title)));
  await free.json('/api/records','POST',expense(300));assert.equal((await notes()).length,2,'past 100% does not repeat');
  const jobs=(await api.pool.query('SELECT key,status FROM "Job" WHERE "userId"=$1 AND type=\'budget-browser\' ORDER BY key',[free.id])).rows;
  assert.deepEqual(jobs.map(j=>j.key),[`budget-browser:${budget.id}:${month}:100`,`budget-browser:${budget.id}:${month}:80`].sort());
  await runWorker();
  const after=(await api.pool.query('SELECT status,"deliveredAt" FROM "Job" WHERE "userId"=$1 AND type=\'budget-browser\'',[free.id])).rows;
  assert.ok(after.every(j=>j.status==='done'),'processed even without a registered browser');assert.ok(after.every(j=>j.deliveredAt===null),'nothing is claimed as delivered when no browser exists');
  const email=(await free.json('/api/snapshot')).planDetails.usage.emails;assert.equal(email,0,'browser budget pushes never count as email usage');
 }finally{await api.stop();}
});

test('the worker cancels a queued budget alert when spending falls back below the threshold',{skip,timeout:180000},async()=>{
 const api=await startApi(4044);
 try{
  const u=await api.user({plan:'Pro'}),month=today().slice(0,7);
  await u.json('/api/records','POST',{kind:'budget',data:{title:'Overall',month,amount:10000,currency:'USD'}});
  const spent=await u.json('/api/records','POST',expense(9000,'Other'));
  assert.equal((await api.pool.query('SELECT COUNT(*)::int AS n FROM "Job" WHERE "userId"=$1 AND type=\'budget-browser\' AND status=\'pending\'',[u.id])).rows[0].n,1);
  assert.equal((await u.request('/api/records/'+spent.id,'DELETE',{version:spent.version})).status,204);
  await runWorker();
  assert.equal((await api.pool.query('SELECT status FROM "Job" WHERE "userId"=$1 AND type=\'budget-browser\'',[u.id])).rows[0].status,'cancelled');
 }finally{await api.stop();}
});
