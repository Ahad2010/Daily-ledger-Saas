import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {startApi} from './support/api';
import {verifySignature} from '../apps/api/src/whop';
import {trialKey} from '../apps/api/src/billing';
const skip=!process.env.TEST_DATABASE_URL;
const secret='ws_test_secret_value';
const sign=(id:string,ts:number,body:string,key=secret)=>'v1,'+createHmac('sha256',key).update(`${id}.${ts}.${body}`).digest('base64');

test('webhook signatures: exact body, fresh timestamp, any listed v1 signature',()=>{
 const body='{"type":"payment.succeeded"}',ts=Math.floor(Date.now()/1000);
 assert.equal(verifySignature(body,{id:'msg_1',timestamp:String(ts),signature:sign('msg_1',ts,body)},secret),true);
 assert.equal(verifySignature(body,{id:'msg_1',timestamp:String(ts),signature:'v1,AAAA '+sign('msg_1',ts,body)},secret),true,'one of several signatures is enough');
 assert.equal(verifySignature(body+' ',{id:'msg_1',timestamp:String(ts),signature:sign('msg_1',ts,body)},secret),false,'changed body');
 assert.equal(verifySignature(body,{id:'msg_2',timestamp:String(ts),signature:sign('msg_1',ts,body)},secret),false,'changed id');
 assert.equal(verifySignature(body,{id:'msg_1',timestamp:String(ts),signature:sign('msg_1',ts,body,'other')},secret),false,'wrong secret');
 const old=ts-600;assert.equal(verifySignature(body,{id:'msg_1',timestamp:String(old),signature:sign('msg_1',old,body)},secret),false,'replay outside the five minute window');
 assert.equal(verifySignature(body,{id:'',timestamp:'',signature:''},secret),false);
});

test('trial key folds plus-tags and Gmail dots into one mailbox',()=>{
 assert.equal(trialKey('Jane.Doe+promo@Gmail.com'),'janedoe@gmail.com');
 assert.equal(trialKey('j.a.n.e.d.o.e@googlemail.com'),'janedoe@gmail.com');
 assert.equal(trialKey('jane.doe+x@company.com'),'jane.doe@company.com');
});

test('without Whop settings, payments stay off and the webhook grants nothing',{skip,timeout:90000},async()=>{
 const api=await startApi(4060,{WHOP_API_KEY:'',WHOP_PRO_PLAN_ID:'',WHOP_LIFETIME_PLAN_ID:'',WHOP_WEBHOOK_SECRET:''});
 try{
  const u=await api.user({plan:'Free'});
  assert.equal((await u.request('/api/billing/checkout','POST',{plan:'Pro'})).status,503);
  const hook=await fetch(api.base+'/webhooks/whop',{method:'POST',body:'{}'});assert.equal(hook.status,503);
  assert.equal((await u.json('/api/billing')).paymentsConfigured,false);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free');
 }finally{await api.stop();}
});

test('Whop webhooks: signed events grant, repeat safely, downgrade, refund and never trust the redirect',{skip,timeout:120000},async()=>{
 const api=await startApi(4061,{WHOP_API_KEY:'test-key',WHOP_PRO_PLAN_ID:'plan_pro',WHOP_LIFETIME_PLAN_ID:'plan_life',WHOP_WEBHOOK_SECRET:secret,WHOP_SANDBOX:'true',WHOP_ENABLED:'true'});
 let n=0;
 const send=async(type:string,data:object,opts:{id?:string;sig?:string;ts?:number}={})=>{
  const id=opts.id||`msg_${Date.now()}_${n++}`,ts=opts.ts??Math.floor(Date.now()/1000),body=JSON.stringify({type,data});
  return fetch(api.base+'/webhooks/whop',{method:'POST',headers:{'content-type':'application/json','webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':opts.sig??sign(id,ts,body)},body});
 };
 try{
  const u=await api.user({plan:'Free'}),other=await api.user({plan:'Free'});
  assert.equal((await u.json('/api/billing')).paymentsConfigured,true);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free','visiting checkout or returning from it grants nothing');
  // Unsigned, tampered and replayed deliveries are refused and change nothing.
  assert.equal((await send('membership.activated',{id:'mem_1',plan:{id:'plan_pro'},metadata:{userId:u.id}},{sig:'v1,bogus'})).status,400);
  assert.equal((await send('membership.activated',{id:'mem_1',plan:{id:'plan_pro'},metadata:{userId:u.id}},{ts:Math.floor(Date.now()/1000)-3600})).status,400);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free');
  // A signed purchase for another person's id still only upgrades the account named in its own metadata.
  const paid={id:'pay_1',plan:{id:'plan_pro'},membership:{id:'mem_1'},metadata:{userId:u.id},total:20,currency:'usd'};
  const first=await send('payment.succeeded',paid,{id:'msg_fixed_1'});assert.equal(first.status,200);assert.equal((await first.json() as any).duplicate,false);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Pro');assert.equal((await other.json('/api/snapshot')).profile.plan,'Free');
  const again=await send('payment.succeeded',paid,{id:'msg_fixed_1'});assert.equal(again.status,200);assert.equal((await again.json() as any).duplicate,true);
  assert.equal(Number((await api.pool.query('SELECT COUNT(*) FROM "BillingRecord" WHERE reference=$1',['pay_1'])).rows[0].count),1);
  const billing=await u.json('/api/billing');assert.equal(billing.payments.length,1);assert.equal(billing.payments[0].amount,2000);assert.equal(billing.canCancel,true);
  // Unknown plan ids and unknown owners are acknowledged but grant nothing.
  assert.equal((await send('payment.succeeded',{id:'pay_x',plan:{id:'plan_unknown'},metadata:{userId:other.id},total:1})).status,200);
  assert.equal((await send('payment.succeeded',{id:'pay_y',plan:{id:'plan_pro'},metadata:{userId:'00000000-0000-0000-0000-000000000000'},total:1})).status,200);
  assert.equal((await other.json('/api/snapshot')).profile.plan,'Free');
  // Membership ends: Pro returns to Free. An older membership ending later does not touch a newer one.
  assert.equal((await send('membership.deactivated',{id:'mem_old',plan:{id:'plan_pro'}})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Pro');
  assert.equal((await send('membership.deactivated',{id:'mem_1',plan:{id:'plan_pro'}})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free');
  // Lifetime: granted by its payment, kept when a stale Pro event arrives, removed by a refund.
  assert.equal((await send('payment.succeeded',{id:'pay_life',plan:{id:'plan_life'},metadata:{userId:u.id},total:100,currency:'usd'})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Lifetime');
  assert.equal((await send('membership.activated',{id:'mem_2',plan:{id:'plan_pro'},metadata:{userId:u.id}})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Lifetime','a Pro event cannot downgrade Lifetime');
  assert.equal((await send('refund.created',{payment:{id:'pay_life'}})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free');
  assert.equal((await api.pool.query('SELECT status FROM "BillingRecord" WHERE reference=$1',['pay_life'])).rows[0].status,'refunded');
  // Garbage that is validly signed is rejected cleanly, not with a crash.
  const id='msg_garbage',ts=Math.floor(Date.now()/1000);
  assert.equal((await fetch(api.base+'/webhooks/whop',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':sign(id,ts,'not json')},body:'not json'})).status,400);
 }finally{await api.pool.query('DELETE FROM "WebhookEvent"');await api.stop();}
});

test('a trial cannot be farmed with an alias of the same mailbox',{skip,timeout:90000},async()=>{
 const api=await startApi(4062);
 try{
  const a=await api.user({plan:'Free'}),b=await api.user({plan:'Free'});
  await api.pool.query('UPDATE "User" SET email=$2 WHERE id=$1',[a.id,'Real.Person+one@gmail.com']);
  await api.pool.query('UPDATE "User" SET email=$2 WHERE id=$1',[b.id,'realperson+two@gmail.com']);
  assert.equal((await a.request('/api/billing/trial','POST')).status,201);
  assert.equal((await b.request('/api/billing/trial','POST')).status,409);
 }finally{await api.stop();}
});
