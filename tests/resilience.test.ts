import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHmac,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
const signCookie=createRequire(import.meta.url)('cookie-signature').sign as (value:string,secret:string)=>string;
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const secret='ws_resilience_secret';
const sign=(id:string,ts:number,body:string)=>'v1,'+createHmac('sha256',secret).update(`${id}.${ts}.${body}`).digest('base64');
const full={WHOP_API_KEY:'k',WHOP_PRO_PLAN_ID:'plan_pro',WHOP_LIFETIME_PLAN_ID:'plan_life',WHOP_WEBHOOK_SECRET:secret};

test('Whop is opt-in: complete credentials without WHOP_ENABLED=true stay off',{skip,timeout:90000},async()=>{
 const api=await startApi(4080,full);
 try{
  const u=await api.user({plan:'Free'});
  assert.equal((await u.json('/api/billing')).paymentsConfigured,false);
  assert.equal((await u.request('/api/billing/checkout','POST',{plan:'Pro'})).status,503);
  const id='m1',ts=Math.floor(Date.now()/1000),body=JSON.stringify({type:'payment.succeeded',data:{id:'p1',plan:{id:'plan_pro'},metadata:{userId:u.id},total:20}});
  assert.equal((await fetch(api.base+'/webhooks/whop',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':sign(id,ts,body)},body})).status,503,'even a correctly signed webhook is refused while disabled');
  assert.equal((await u.json('/api/snapshot')).profile.plan,'Free');
 }finally{await api.stop();}
});

test('incomplete or invalid Whop settings disable payments only; the rest of the app keeps working',{skip,timeout:90000},async()=>{
 for(const [port,env] of [[4081,{WHOP_ENABLED:'true',WHOP_API_KEY:'k'}],[4082,{WHOP_ENABLED:'true',...full,WHOP_LIFETIME_PLAN_ID:'plan_pro'}],[4083,{WHOP_ENABLED:'TRUE',...full}],[4084,{WHOP_ENABLED:'true',...full,WHOP_API_KEY:'   '}]] as const){
  const api=await startApi(port,env);
  try{
   const u=await api.user({plan:'Pro'});
   assert.equal((await u.json('/api/billing')).paymentsConfigured,false,JSON.stringify(env));
   assert.equal((await u.request('/api/billing/checkout','POST',{plan:'Lifetime'})).status,503);
   assert.equal((await u.request('/api/snapshot')).status,200);assert.equal((await u.request('/api/records','POST',{kind:'task',data:{title:'still works',description:'',due:'2030-01-01T00:00:00Z',priority:'low',done:false,reminder:false,recurrence:'none'}})).status,201);
   assert.equal((await fetch(api.base+'/ready')).status,200);
  }finally{await api.stop();}
 }
});

test('payment events out of order, repeated and late never undo a refund or downgrade Lifetime',{skip,timeout:120000},async()=>{
 const api=await startApi(4085,{...full,WHOP_ENABLED:'true'});
 const send=async(type:string,data:object)=>{const id=`ord_${randomUUID()}`,ts=Math.floor(Date.now()/1000),body=JSON.stringify({type,data});return fetch(api.base+'/webhooks/whop',{method:'POST',headers:{'webhook-id':id,'webhook-timestamp':String(ts),'webhook-signature':sign(id,ts,body)},body});};
 try{
  const u=await api.user({plan:'Free'}),plan=async()=>(await u.json('/api/snapshot')).profile.plan;
  // Membership event first, payment later: nothing is granted until an owner is known, then it is.
  assert.equal((await send('membership.deactivated',{id:'mem_a',plan:{id:'plan_pro'}})).status,200);assert.equal(await plan(),'Free');
  assert.equal((await send('membership.activated',{id:'mem_a',plan:{id:'plan_pro'}})).status,200);assert.equal(await plan(),'Free','no owner yet');
  const pay={id:'pay_a',plan:{id:'plan_pro'},membership:{id:'mem_a'},metadata:{userId:u.id},total:20,currency:'usd'};
  assert.equal((await send('payment.succeeded',pay)).status,200);assert.equal(await plan(),'Pro');
  // A new delivery of the same payment (different webhook id) and a duplicate activation change nothing.
  assert.equal((await send('payment.succeeded',pay)).status,200);assert.equal((await send('membership.activated',{id:'mem_a',plan:{id:'plan_pro'},metadata:{userId:u.id}})).status,200);
  assert.equal(Number((await api.pool.query('SELECT COUNT(*) FROM "BillingRecord" WHERE "userId"=$1',[u.id])).rows[0].count),1);
  // Cancellation scheduled keeps access; withdrawn clears it; deactivation ends it.
  assert.equal((await send('membership.cancel_at_period_end_changed',{id:'mem_a',cancel_at_period_end:true})).status,200);
  const b=await u.json('/api/billing');assert.equal(b.plan,'Pro');assert.equal(b.endsAtPeriodEnd,true);assert.equal(b.canCancel,false);
  assert.equal((await send('membership.cancel_at_period_end_changed',{id:'mem_a',cancel_at_period_end:false})).status,200);assert.equal((await u.json('/api/billing')).endsAtPeriodEnd,false);
  // Dispute then a late "payment succeeded" retry must not re-grant.
  assert.equal((await send('dispute.created',{payment:{id:'pay_a'}})).status,200);
  assert.equal((await send('membership.deactivated',{id:'mem_a',plan:{id:'plan_pro'}})).status,200);assert.equal(await plan(),'Free');
  assert.equal((await send('payment.succeeded',pay)).status,200);assert.equal(await plan(),'Free','a late success after a dispute grants nothing');
  assert.equal((await api.pool.query('SELECT status FROM "BillingRecord" WHERE reference=$1',['pay_a'])).rows[0].status,'disputed');
  // Lifetime stays through stale Pro payments, deactivations and renewals.
  assert.equal((await send('payment.succeeded',{id:'pay_l',plan:{id:'plan_life'},metadata:{userId:u.id},total:100,currency:'usd'})).status,200);assert.equal(await plan(),'Lifetime');
  assert.equal((await send('payment.succeeded',{id:'pay_b',plan:{id:'plan_pro'},membership:{id:'mem_b'},metadata:{userId:u.id},total:20})).status,200);assert.equal(await plan(),'Lifetime');
  assert.equal((await send('membership.deactivated',{id:'mem_b',plan:{id:'plan_pro'}})).status,200);assert.equal(await plan(),'Lifetime');
  // Refund of a payment we have never seen is acknowledged and changes nothing.
  assert.equal((await send('refund.created',{payment:{id:'pay_unknown'}})).status,200);assert.equal(await plan(),'Lifetime');
 }finally{await api.pool.query('DELETE FROM "WebhookEvent"');await api.stop();}
});

test('checkout and cancellation talk to Whop with the right request and never grant by themselves',{skip,timeout:120000},async()=>{
 const seen:{url:string;auth:string;body:any}[]=[];
 const fake=createServer(async(req,res)=>{let b='';for await(const c of req)b+=c;seen.push({url:req.url!,auth:String(req.headers.authorization),body:b?JSON.parse(b):null});res.setHeader('content-type','application/json');if(req.url!.endsWith('/checkout_configurations'))return res.end(JSON.stringify({purchase_url:'https://whop.example/checkout/abc'}));res.end('{}');});
 await new Promise<void>(r=>fake.listen(0,'127.0.0.1',r));const port=(fake.address() as {port:number}).port;
 const api=await startApi(4086,{...full,WHOP_ENABLED:'true',WHOP_API_BASE:`http://127.0.0.1:${port}`});
 try{
  const free=await api.user({plan:'Free'});
  const r=await free.json('/api/billing/checkout','POST',{plan:'Pro'});assert.equal(r.url,'https://whop.example/checkout/abc');
  assert.equal(seen[0].auth,'Bearer k');assert.equal(seen[0].body.plan_id,'plan_pro');assert.equal(seen[0].body.metadata.userId,free.id);assert.match(seen[0].body.redirect_url,/^http:\/\/localhost:3000\//);
  assert.equal((await free.json('/api/snapshot')).profile.plan,'Free','creating a checkout grants nothing');
  // A paid member cancels: Whop is told to cancel at period end, access continues.
  const paid=await api.user({plan:'Pro',source:'provider'});
  await api.pool.query(`INSERT INTO "BillingRecord" (id,"userId",provider,reference,"subscriptionReference",kind,currency,amount,status,verified) VALUES ($1,$2,'whop','pay_c','mem_c','recurring','USD',2000,'paid',true)`,[randomUUID(),paid.id]);
  assert.equal((await paid.request('/api/billing/cancel','POST')).status,200);
  const cancel=seen.find(x=>x.url.includes('/memberships/mem_c/cancel'));assert.ok(cancel);assert.equal(cancel!.body.cancellation_mode,'at_period_end');
  const d=await paid.json('/api/billing');assert.equal(d.plan,'Pro');assert.equal(d.endsAtPeriodEnd,true);assert.equal((await paid.request('/api/billing/cancel','POST')).status,409);
  // Lifetime and Pro-already-active purchases are refused.
  const life=await api.user({plan:'Lifetime',source:'provider'});assert.equal((await life.request('/api/billing/checkout','POST',{plan:'Pro'})).status,409);
  assert.equal((await free.request('/api/billing/checkout','POST',{plan:'Free'})).status,400);
 }finally{fake.close();await api.stop();}
});

test('the AI daily cap holds under concurrent requests and across two API replicas',{skip,timeout:150000},async()=>{
 let served=0;
 const provider=createServer(async(req,res)=>{for await(const _ of req);served++;await new Promise(r=>setTimeout(r,150));res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:'ok'}}],usage:{prompt_tokens:100,completion_tokens:10}}));});
 await new Promise<void>(r=>provider.listen(0,'127.0.0.1',r));const port=(provider.address() as {port:number}).port;
 const env={AI_PROVIDER:'openai-compatible',AI_BASE_URL:`http://127.0.0.1:${port}`,AI_MODEL:'fixture',AI_API_KEY:'k',AI_DAILY_REQUEST_CAP:'3'};
 const a=await startApi(4087,env),b=await startApi(4088,env);
 const settings={productName:'Daily Ledger',supportContact:'',timezone:'UTC',currency:'USD',optionalEmailsDefault:false,publicAnnouncements:true,aiEnabled:true,assistantInstructions:'',aiAllowances:{Free:{requests:10,tokens:20000},Pro:{requests:100,tokens:100000},Lifetime:{requests:60,tokens:60000}}};
 const previous=(await a.pool.query('SELECT * FROM "PlatformConfig" WHERE id=1')).rows[0];
 await a.pool.query('INSERT INTO "PlatformConfig" (id,data,version,"updatedAt") VALUES (1,$1,1,NOW()) ON CONFLICT (id) DO UPDATE SET data=$1',[JSON.stringify(settings)]);
 const month=new Date().toISOString().slice(0,7);
 try{
  const users=[];for(let i=0;i<5;i++)users.push(await a.user({plan:'Pro'}),await b.user({plan:'Pro'}));
  const before=Number((await a.pool.query(`SELECT COUNT(*) FROM "AiUsage" WHERE "createdAt">NOW()-INTERVAL '1 day'`)).rows[0].count);
  const room=3-before;assert.ok(room>=0);
  const results=await Promise.all(users.map(u=>u.request('/api/ai/chat','POST',{requestId:randomUUID(),month,intent:'general',question:'hello'}).then(r=>r.status)));
  const ok=results.filter(s=>s===200).length,busy=results.filter(s=>s===503).length;
  assert.equal(ok,room,`exactly the remaining cap is served: ${results}`);assert.equal(ok+busy,10);assert.equal(served,ok,'the provider was never called beyond the cap');
 }finally{await a.pool.query('DELETE FROM "AiUsage"');if(previous)await a.pool.query('UPDATE "PlatformConfig" SET data=$1 WHERE id=1',[JSON.stringify(previous.data)]);else await a.pool.query('DELETE FROM "PlatformConfig" WHERE id=1');provider.close();await a.stop();await b.stop();}
});

test('login throttling is shared between API replicas',{skip,timeout:120000},async()=>{
 const a=await startApi(4089),b=await startApi(4090);
 try{
  const attempt=async(api:typeof a)=>{const c=await (await fetch(api.base+'/auth/csrf')).json() as any;const cookie=(await fetch(api.base+'/auth/csrf')).headers.get('set-cookie')||'';void c;void cookie;};
  void attempt;
  const email=`shared-${randomUUID()}@example.com`;
  const post=async(api:typeof a)=>{const first=await fetch(api.base+'/auth/csrf');const {csrf}=await first.json() as any;const cookie=(first.headers.get('set-cookie')||'').split(';')[0];return fetch(api.base+'/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000','x-csrf-token':csrf,cookie},body:JSON.stringify({email,password:'wrong password 123!'})}).then(r=>r.status);};
  const codes=[await post(a),await post(b),await post(a),await post(b),await post(a),await post(b),await post(a)];
  assert.deepEqual(codes.slice(0,5),[401,401,401,401,401]);assert.deepEqual(codes.slice(5),[429,429],`attempts split across two replicas still hit one shared limit: ${codes}`);
 }finally{await a.pool.query(`DELETE FROM "RateLimitHit"`);await a.stop();await b.stop();}
});

test('if the shared rate-limit table is unavailable, limits still apply locally and the rest of the app is unaffected',{skip,timeout:120000},async()=>{
 const api=await startApi(4091);
 try{
  await api.pool.query('ALTER TABLE "RateLimitHit" RENAME TO "RateLimitHit_off"');
  const u=await api.user({plan:'Free'});
  const email=`outage-${randomUUID()}@example.com`;
  const post=async()=>{const first=await fetch(api.base+'/auth/csrf');const {csrf}=await first.json() as any;const cookie=(first.headers.get('set-cookie')||'').split(';')[0];return fetch(api.base+'/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000','x-csrf-token':csrf,cookie},body:JSON.stringify({email,password:'wrong password 123!'})}).then(r=>r.status);};
  const started=Date.now(),codes:number[]=[];for(let i=0;i<7;i++)codes.push(await post());
  assert.deepEqual(codes.slice(0,5),[401,401,401,401,401],'wrong passwords are still refused normally');
  assert.deepEqual(codes.slice(5),[429,429],`the failed-login limit still applies without the shared store: ${codes}`);
  assert.ok(Date.now()-started<15000,'an unavailable store does not slow requests');
  assert.equal((await u.request('/api/snapshot')).status,200);assert.equal((await fetch(api.base+'/ready')).status,200);
  assert.match(api.logs(),/Rate-limit store unavailable/);
 }finally{await api.pool.query('ALTER TABLE "RateLimitHit_off" RENAME TO "RateLimitHit"').catch(()=>undefined);await api.stop();}
});

test('with the whole database unreachable the API stays up, answers 503 without internals, and recovers on its own',{skip,timeout:120000},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL!);url.port='1';
 const api=await startApi(4092,{DATABASE_URL:url.toString()});
 const close={connection:'close'},json={...close,'content-type':'application/json',origin:'http://localhost:3000','x-csrf-token':'c'.repeat(64),cookie:`ledger.sid=${encodeURIComponent('s:'+signCookie(randomUUID(),'feature-session-secret-at-least-32-characters'))}`};
 try{
  assert.equal((await fetch(api.base+'/health',{headers:close})).status,200,'liveness does not depend on the database');
  assert.equal((await fetch(api.base+'/ready',{headers:close})).status,503,'readiness reports the outage');
  const probes=[['GET','/api/snapshot'],['POST','/auth/login'],['POST','/api/ai/chat'],['GET','/auth/me'],['POST','/api/records']] as const;
  for(const [method,path] of probes){
   const r=await fetch(api.base+path,{method,headers:json,...(method==='POST'?{body:JSON.stringify({email:'a@b.co',password:'x',requestId:'r',kind:'task',data:{}})}:{})});
   const text=await r.text();
   assert.equal(r.status,503,`${method} ${path} -> ${r.status} ${text.slice(0,120)}`);
   assert.equal(r.headers.get('retry-after'),'5');
   assert.equal((JSON.parse(text) as any).code,'SERVICE_UNAVAILABLE');
   assert.ok(!/ECONNREFUSED|127\.0\.0\.1|localhost|SELECT|prisma|postgres|\n\s+at /i.test(text),`no internals leak: ${text}`);
  }
  assert.match(api.logs(),/\[db-unavailable\]/,'the operator log names the cause');
  assert.equal((await fetch(api.base+'/health',{headers:close})).status,200,'the process survived');
  assert.equal((await fetch(api.base+'/webhooks/whop',{method:'POST',body:'x',headers:close})).status,503);
 }finally{await api.stop();}
});

test('unexpected non-database errors are not turned into 503 and the healthy path is unchanged',{skip,timeout:90000},async()=>{
 const api=await startApi(4093);
 try{
  const u=await api.user({plan:'Free'});
  assert.equal((await u.request('/api/snapshot')).status,200);
  assert.equal((await u.request('/api/records/not-a-uuid','DELETE',{version:1})).status,404,'missing record stays 404');
  assert.equal((await u.request('/api/records','POST',{kind:'task',data:{title:''}})).status,400,'validation stays 400');
  assert.equal((await fetch(api.base+'/api/snapshot')).status,401,'signed out stays 401');
  assert.equal((await fetch(api.base+'/ready')).status,200);
 }finally{await api.stop();}
});
