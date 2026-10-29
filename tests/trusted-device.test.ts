import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
import {passwordUser,attempt,postFrom,trustCookie} from './support/login';
const skip=!process.env.TEST_DATABASE_URL;
const strong='Correct-horse-battery-9!',wrong='wrong-password-1!';
const env={LOGIN_MAX_DELAY_MS:'900',LOGIN_FRICTION_AFTER:'10'};
async function pressure(api:{base:string},email:string,count:number,first=100){
 for(let i=0;i<count;i++){const r=await attempt(api.base,{email,password:wrong,ip:`203.0.113.${first+Math.floor(i/4)}`});await r.text();}
}
const timed=async<T>(work:()=>Promise<T>)=>{const t=Date.now(),value=await work();return {value,ms:Date.now()-t};};

test('an attacker spreading wrong tries over many networks slows the owner down but never locks them out',{skip,timeout:240000},async()=>{
 const api=await startApi(4111,env);
 try{
  const email=`owner-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  await pressure(api,email,40);
  const {value:r,ms}=await timed(()=>attempt(api.base,{email,password:strong,ip:'198.51.100.200'}));
  assert.equal(r.status,200,'the owner with the right password always gets in');assert.ok(ms>=800,`an unfamiliar device waits a little (${ms} ms)`);
  assert.ok(trustCookie(r),'and this device is remembered for next time');
 }finally{await api.stop();}
});

test('a remembered device is not slowed down even while the account is under attack',{skip,timeout:240000},async()=>{
 const api=await startApi(4112,env);
 try{
  const email=`trusted-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  const first=await attempt(api.base,{email,password:strong,ip:'198.51.100.201'});const cookie=trustCookie(first)!;assert.ok(cookie);
  await pressure(api,email,40);
  const {value:r,ms}=await timed(()=>attempt(api.base,{email,password:strong,ip:'198.51.100.202',cookie}));
  assert.equal(r.status,200);assert.ok(ms<700,`no wait for the remembered device (${ms} ms)`);
  await pressure(api,email,40); // the owner's good sign-in cleared the pressure, so put it back before the forged-cookie check
  const forged=await timed(()=>attempt(api.base,{email,password:strong,ip:'198.51.100.203',cookie:'ledger.td='+'a'.repeat(30)+'.'+'b'.repeat(64)+'.'+'c'.repeat(64)}));
  assert.equal(forged.value.status,200);assert.ok(forged.ms>=800,'a made-up cookie earns nothing');
 }finally{await api.stop();}
});

test('a remembered device belongs to one person only',{skip,timeout:240000},async()=>{
 const api=await startApi(4113,env);
 try{
  const a=`a-${Date.now()}@example.com`,b=`b-${Date.now()}@example.com`;await passwordUser(api,a,strong);await passwordUser(api,b,strong);
  const cookie=trustCookie(await attempt(api.base,{email:a,password:strong,ip:'198.51.100.210'}))!;
  await pressure(api,b,40);
  const {value:r,ms}=await timed(()=>attempt(api.base,{email:b,password:strong,ip:'198.51.100.211',cookie}));
  assert.equal(r.status,200);assert.ok(ms>=800,"someone else's remembered device does not count for this account");
 }finally{await api.stop();}
});

test('resetting the password forgets every remembered device and clears the account pressure',{skip,timeout:240000},async()=>{
 const api=await startApi(4114,env);
 try{
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.SESSION_SECRET||='feature-session-secret-at-least-32-characters';process.env.FRONTEND_ORIGIN||='http://localhost:3000';
  const {resetToken}=await import('../apps/api/src/passwords');
  const email=`reset-trust-${Date.now()}@example.com`,user=await passwordUser(api,email,strong);
  const cookie=trustCookie(await attempt(api.base,{email,password:strong,ip:'198.51.100.220'}))!;
  assert.equal(Number((await api.pool.query('SELECT COUNT(*) FROM "TrustedDevice" WHERE "userId"=$1',[user.id])).rows[0].count),1);
  await pressure(api,email,40);
  const id=crypto.randomUUID(),token=resetToken(id,user.id),{tokenHash}=await import('../apps/api/src/passwords');
  await api.pool.query('INSERT INTO "PasswordReset" (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,NOW()+INTERVAL \'5 minutes\')',[id,user.id,tokenHash(token)]);
  const done=await postFrom(api.base,'/auth/reset-password',{id,token,password:'Another-strong-pass-7!'},'198.51.100.221');assert.equal(done.status,200);
  assert.equal(Number((await api.pool.query('SELECT COUNT(*) FROM "TrustedDevice" WHERE "userId"=$1',[user.id])).rows[0].count),0,'no remembered device survives a reset');
  const {value:r,ms}=await timed(()=>attempt(api.base,{email,password:'Another-strong-pass-7!',ip:'198.51.100.222',cookie}));
  assert.equal(r.status,200);assert.ok(ms<700,`the old attack is forgotten, so there is no wait (${ms} ms)`);
 }finally{await api.stop();}
});
