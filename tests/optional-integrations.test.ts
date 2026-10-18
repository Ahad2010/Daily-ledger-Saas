import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {startApi} from './support/api';
import {hashPassword} from '../apps/api/src/passwords';
const skip=!process.env.TEST_DATABASE_URL;
// Every value below must never appear in a response body or in the server log.
const SECRETS={RESEND_API_KEY:'re_SENTINEL_resend_key_111',GOOGLE_CLIENT_SECRET:'GOCSPX-SENTINEL-google-222',AI_API_KEY:'sk-SENTINEL-ai-key-333',VAPID_PRIVATE_KEY:'SENTINEL-vapid-private-444',WHOP_API_KEY:'whop_SENTINEL_key_555',WHOP_WEBHOOK_SECRET:'ws_SENTINEL_hook_666',CLOUDINARY_API_SECRET:'SENTINEL-cloudinary-777'};
const aiSettings={productName:'Daily Ledger',supportContact:'',timezone:'UTC',currency:'USD',optionalEmailsDefault:false,publicAnnouncements:true,aiEnabled:true,assistantInstructions:'',aiAllowances:{Free:{requests:10,tokens:20000},Pro:{requests:100,tokens:100000},Lifetime:{requests:60,tokens:60000}}};

async function csrfPost(base:string,path:string,body:unknown){const first=await fetch(base+'/auth/csrf');const {csrf}=await first.json() as any;const cookie=(first.headers.get('set-cookie')||'').split(';')[0];return fetch(base+path,{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3000','x-csrf-token':csrf,cookie},body:JSON.stringify(body)});}

test('no optional integration configured: core app, password login and free plan all work; Google is the only thing disabled',{skip,timeout:120000},async()=>{
 const api=await startApi(4100,{GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',GOOGLE_CALLBACK_URL:'',RESEND_API_KEY:'',EMAIL_FROM:'',AI_PROVIDER:'',AI_API_KEY:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',WHOP_ENABLED:'',CLOUDINARY_CLOUD_NAME:''});
 try{
  const health=await (await fetch(api.base+'/health')).json() as any;
  assert.equal(health.googleConfigured,false);assert.equal(health.billing,'not-configured');assert.equal(health.passwordConfigured,true);
  assert.equal((await fetch(api.base+'/auth/google')).status,503,'Google sign-in alone reports itself unavailable');
  assert.equal((await fetch(api.base+'/ready')).status,200);
  const u=await api.user({plan:'Free'}),email=`pw-${randomUUID()}@example.com`,password='correct horse battery 42!';
  await api.pool.query('INSERT INTO "PasswordCredential" (id,"userId",email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())',[randomUUID(),u.id,email,await hashPassword(password)]);
  const login=await csrfPost(api.base,'/auth/login',{email,password});assert.equal(login.status,200,'email/password login works with Google off');
  assert.ok((login.headers.get('set-cookie')||'').includes('ledger.sid'));
  assert.equal((await u.request('/api/snapshot')).status,200);
  assert.equal((await u.json('/api/ai/status')).locked,true);
  assert.equal((await u.request('/api/ai/chat','POST',{requestId:randomUUID(),month:'2026-10',intent:'general',question:'hi'})).status,403);
  assert.equal((await u.json('/api/push')).configured,false);
  assert.equal((await u.request('/api/billing/checkout','POST',{plan:'Pro'})).status,503);
  assert.equal((await u.request('/api/records','POST',{kind:'task',data:{title:'works',description:'',due:'2030-01-01T00:00:00Z',priority:'low',done:false,reminder:false,recurrence:'none'}})).status,201);
  // Email provider missing: reset still answers generically and the server stays up.
  assert.equal((await csrfPost(api.base,'/auth/forgot-password',{email})).status,200);
  assert.equal((await fetch(api.base+'/ready')).status,200);
 }finally{await api.stop();}
});

test('invalid or unreachable providers fail only their own feature, and no secret reaches a response or the log',{skip,timeout:150000},async()=>{
 const api=await startApi(4101,{...SECRETS,GOOGLE_CLIENT_ID:'bad-client-id',GOOGLE_CALLBACK_URL:'not a url',EMAIL_FROM:'nobody@invalid.invalid',AI_PROVIDER:'openai-compatible',AI_BASE_URL:'http://127.0.0.1:9',AI_MODEL:'m',VAPID_PUBLIC_KEY:'not-a-key',VAPID_SUBJECT:'nonsense',WHOP_ENABLED:'true',CLOUDINARY_CLOUD_NAME:'x',CLOUDINARY_API_KEY:'y'});
 const bodies:string[]=[];
 const grab=async(r:Response)=>{const t=await r.text();bodies.push(t);return {status:r.status,text:t};};
 const previous=(await api.pool.query('SELECT * FROM "PlatformConfig" WHERE id=1')).rows[0];
 await api.pool.query('INSERT INTO "PlatformConfig" (id,data,version,"updatedAt") VALUES (1,$1,1,NOW()) ON CONFLICT (id) DO UPDATE SET data=$1',[JSON.stringify(aiSettings)]);
 try{
  const pro=await api.user({plan:'Pro'}),admin=await api.user({plan:'Pro',admin:true});
  assert.equal((await grab(await fetch(api.base+'/health'))).status,200);
  const google=await fetch(api.base+'/auth/google',{redirect:'manual'});assert.ok([302,500,503].includes(google.status),`google ${google.status}`);await grab(google);
  // AI provider unreachable: a clean 502, then every other route still answers.
  const chat=await grab(await pro.request('/api/ai/chat','POST',{requestId:randomUUID(),month:'2026-10',intent:'general',question:'hello'}));assert.equal(chat.status,502);
  for(const path of ['/api/snapshot','/api/billing','/api/push','/api/ai/status','/api/referrals','/api/export'])assert.equal((await grab(await pro.request(path))).status,200,path);
  for(const path of ['/api/admin/ai','/api/admin/summary','/api/admin/automations','/api/admin/notifications','/api/admin/settings'])await grab(await admin.request(path));
  // Email provider unreachable.
  const reset=await csrfPost(api.base,'/auth/forgot-password',{email:'someone@example.com'});assert.equal(reset.status,200);await grab(reset);
  // Hostile webhook traffic and malformed requests.
  await grab(await fetch(api.base+'/webhooks/whop',{method:'POST',body:'garbage'}));
  await grab(await fetch(api.base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{bad'}));
  assert.equal((await fetch(api.base+'/ready')).status,200,'server still healthy');
  const all=bodies.join('\n');
  for(const [name,value] of Object.entries(SECRETS))assert.ok(!all.includes(value),`${name} leaked into a response`);
  assert.ok(!all.includes('feature-session-secret'),'session secret leaked into a response');
  await api.stop();
  for(const [name,value] of Object.entries(SECRETS))assert.ok(!api.logs().includes(value),`${name} leaked into the server log`);
  assert.ok(!api.logs().includes('feature-session-secret'),'session secret leaked into the log');
 }finally{await api.pool.query('DELETE FROM "AiUsage"').catch(()=>undefined);if(previous)await api.pool.query('UPDATE "PlatformConfig" SET data=$1 WHERE id=1',[JSON.stringify(previous.data)]).catch(()=>undefined);else await api.pool.query('DELETE FROM "PlatformConfig" WHERE id=1').catch(()=>undefined);await api.stop().catch(()=>undefined);}
});

test('core configuration is still validated at startup',{skip,timeout:60000},()=>{
 const run=(env:Record<string,string>)=>spawnSync(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL!,SESSION_SECRET:'x'.repeat(40),FRONTEND_ORIGIN:'http://localhost:3000',PORT:'4102',NODE_ENV:'development',...env},encoding:'utf8',timeout:20000});
 const short=run({SESSION_SECRET:'short'});assert.notEqual(short.status,0);assert.match(short.stderr,/SESSION_SECRET/);
 const origin=run({FRONTEND_ORIGIN:'http://localhost:3000/path'});assert.notEqual(origin.status,0);assert.match(origin.stderr,/exact origins/);
 const insecure=run({NODE_ENV:'production',TRUST_PROXY_HOPS:'2',FRONTEND_ORIGIN:'http://app.example.com'});assert.notEqual(insecure.status,0);assert.match(insecure.stderr,/HTTPS in production/);
});
