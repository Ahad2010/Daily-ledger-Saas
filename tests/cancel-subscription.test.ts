import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
test('a Pro member can cancel to Free once; Free and Lifetime accounts cannot',{skip,timeout:90000},async()=>{
 const api=await startApi(4054);
 try{
  const pro=await api.user({plan:'Pro',source:'provider'}),free=await api.user({plan:'Free'}),life=await api.user({plan:'Lifetime',source:'provider'});
  const before=await pro.json('/api/billing');assert.equal(before.canCancel,true);assert.equal(before.plan,'Pro');
  const res=await pro.request('/api/billing/cancel','POST');assert.equal(res.status,200);
  const after=await pro.json('/api/billing');assert.equal(after.plan,'Free');assert.equal(after.canCancel,false);assert.ok(after.cancelledAt);
  assert.equal((await pro.request('/api/billing/cancel','POST')).status,409);
  assert.equal((await free.request('/api/billing/cancel','POST')).status,409);
  const l=await life.request('/api/billing/cancel','POST');assert.equal(l.status,409);assert.equal((await life.json('/api/billing')).plan,'Lifetime');
  const me=await pro.json('/api/snapshot').catch(()=>null);if(me?.profile)assert.equal(me.profile.plan,'Free');
 }finally{await api.stop();}
});
