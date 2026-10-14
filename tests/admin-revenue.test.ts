import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
test('admin overview breaks accounts and verified revenue down by plan; trials and admin grants are never revenue',{skip,timeout:150000},async()=>{
 const api=await startApi(4054);
 try{
  const admin=await api.user({admin:true,plan:'Free',name:'Revenue admin'});
  const before=await admin.json('/api/admin/overview');
  const pay=(userId:string,kind:string,amount:number,verified=true,status='paid')=>api.pool.query('INSERT INTO "BillingRecord" (id,"userId",provider,reference,kind,currency,amount,status,verified) VALUES ($1,$2,\'whop\',$3,$4,\'USD\',$5,$6,$7)',[randomUUID(),userId,'ref-'+randomUUID(),kind,amount,status,verified]);
  const paidPro=await api.user({plan:'Pro',source:'provider'}),paidLifetime=await api.user({plan:'Lifetime',source:'provider'}),granted=await api.user({plan:'Pro',source:'manual'}),trial=await api.user({plan:'Free'}),free=await api.user({plan:'Free'});
  assert.equal((await trial.request('/api/billing/trial','POST')).status,201);
  await pay(paidPro.id,'recurring',2000);await pay(paidPro.id,'recurring',2000);await pay(paidLifetime.id,'lifetime',10000);
  await pay(paidPro.id,'recurring',9999,false);await pay(paidPro.id,'recurring',9999,true,'refunded');await pay(granted.id,'recurring',777,false);
  const after=await admin.json('/api/admin/overview');
  const delta=(plan:string,key:string)=>after.planBreakdown[plan][key]-before.planBreakdown[plan][key];
  assert.deepEqual(['accounts','paid','granted','trial'].map(k=>delta('Pro',k)),[3,1,1,1],'Pro: paid, admin-granted and trial accounts are separated');
  assert.deepEqual(['accounts','paid','granted','trial'].map(k=>delta('Lifetime',k)),[1,1,0,0]);assert.equal(delta('Free','accounts'),1,'only the free account; the trial user counts as Pro while the trial runs');
  const money=(plan:'Pro'|'Lifetime')=>(after.revenueByPlan[plan].USD||0)-(before.revenueByPlan[plan].USD||0);
  assert.equal(money('Pro'),4000,'only verified, paid records count; refunded and unverified do not');assert.equal(money('Lifetime'),10000);
  assert.equal(after.revenue.USD.recurring-(before.revenue.USD?.recurring||0),4000);assert.equal(after.revenue.USD.lifetime-(before.revenue.USD?.lifetime||0),10000);
  assert.equal((await free.request('/api/admin/overview')).status,403,'customers cannot read platform revenue');
 }finally{await api.stop();}
});
