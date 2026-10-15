import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const until=async<T>(read:()=>Promise<T>,done:(value:T)=>boolean,ms=15000)=>{const end=Date.now()+ms;let value=await read();while(!done(value)&&Date.now()<end){await new Promise(r=>setTimeout(r,400));value=await read();}return value;};
test('maintenance mode blocks customers with a 503 while admin tools, health and status stay open',{skip,timeout:180000},async()=>{
 const api=await startApi(4063);const previous=(await api.pool.query('SELECT * FROM "PlatformConfig" WHERE id=1')).rows[0];
 try{
  const admin=await api.user({admin:true,name:'Maintenance admin'}),member=await api.user({name:'Maintenance member'});
  const status=async()=>(await fetch(api.base+'/status')).json() as Promise<{maintenance:{enabled:boolean;message:string;until:string|null}}>;
  assert.equal((await status()).maintenance.enabled,false);assert.equal((await member.request('/api/snapshot')).status,200);
  const loaded=await admin.json('/api/admin/settings');const back=new Date(Date.now()+3600000).toISOString();
  const saved=await admin.request('/api/admin/settings','PATCH',{settings:{...loaded.settings,maintenance:{enabled:true,message:'Upgrading the database. Back shortly.',until:back}},version:loaded.version,reason:'Planned upgrade'});
  assert.equal(saved.status,200);
  const on=await until(status,s=>s.maintenance.enabled);assert.equal(on.maintenance.enabled,true);assert.equal(on.maintenance.message,'Upgrading the database. Back shortly.');assert.equal(on.maintenance.until,back);
  const blocked=await member.request('/api/snapshot');assert.equal(blocked.status,503);assert.equal(blocked.headers.get('retry-after'),'300');
  const body=await blocked.json() as {code:string;error:string;until:string};assert.equal(body.code,'MAINTENANCE');assert.equal(body.error,'Upgrading the database. Back shortly.');assert.equal(body.until,back);
  assert.equal((await member.request('/api/records','POST',{kind:'task',data:{title:'x'}})).status,503,'writes are blocked as well');
  assert.equal((await fetch(api.base+'/health')).status,200);
  assert.equal((await admin.request('/api/admin/settings')).status,200,'admin tools must stay reachable to switch the site back on');
  assert.equal((await admin.request('/api/snapshot')).status,200,'the signed-in administrator can still use the app to verify a fix');
  const current=await admin.json('/api/admin/settings');
  assert.equal((await admin.request('/api/admin/settings','PATCH',{settings:{...current.settings,maintenance:{enabled:false,message:'',until:null}},version:current.version,reason:'Upgrade finished'})).status,200);
  const off=await until(status,s=>!s.maintenance.enabled);assert.equal(off.maintenance.enabled,false);assert.equal((await member.request('/api/snapshot')).status,200);
  const audit=await admin.json('/api/admin/audit');assert.ok(audit.records.some((r:any)=>r.reason==='Planned upgrade'),'switching maintenance on is recorded in the admin audit log');
 }finally{
  if(previous)await api.pool.query('UPDATE "PlatformConfig" SET data=$1,version=$2 WHERE id=1',[previous.data,previous.version]);else await api.pool.query('DELETE FROM "PlatformConfig" WHERE id=1');
  await api.stop();
 }
});
test('a maintenance message longer than 280 characters is rejected',{skip,timeout:120000},async()=>{
 const api=await startApi(4064);const previous=(await api.pool.query('SELECT * FROM "PlatformConfig" WHERE id=1')).rows[0];
 try{const admin=await api.user({admin:true});const loaded=await admin.json('/api/admin/settings');
  const response=await admin.request('/api/admin/settings','PATCH',{settings:{...loaded.settings,maintenance:{enabled:true,message:'x'.repeat(281),until:null}},version:loaded.version,reason:'Too long'});
  assert.equal(response.status,400);
 }finally{if(previous)await api.pool.query('UPDATE "PlatformConfig" SET data=$1,version=$2 WHERE id=1',[previous.data,previous.version]);else await api.pool.query('DELETE FROM "PlatformConfig" WHERE id=1');await api.stop();}
});
