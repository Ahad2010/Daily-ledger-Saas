import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const task=(title:string)=>({kind:'task',data:{title,description:'',due:'2030-01-01T00:00:00Z',priority:'low',done:false,reminder:false,recurrence:'none'}});

test('a hosted deploy without NODE_ENV=production or TRUST_PROXY_HOPS refuses to start',{skip,timeout:60000},()=>{
 const run=(env:Record<string,string>)=>spawnSync(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL!,SESSION_SECRET:'x'.repeat(40),FRONTEND_ORIGIN:'https://app.example.com',PORT:'4070',TRUST_PROXY_HOPS:'',...env},encoding:'utf8',timeout:20000});
 const railway=run({RAILWAY_ENVIRONMENT:'production',NODE_ENV:'development'});assert.match(railway.stderr,/NODE_ENV=production/);
 const delete_=(()=>{const e={...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL!,SESSION_SECRET:'x'.repeat(40),FRONTEND_ORIGIN:'https://app.example.com',PORT:'4071',NODE_ENV:'production'} as Record<string,string|undefined>;delete e.TRUST_PROXY_HOPS;return spawnSync(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:e,encoding:'utf8',timeout:20000});})();
 assert.match(delete_.stderr,/TRUST_PROXY_HOPS/);
});

test('record search runs in the database with correct paging, and validation errors stay short',{skip,timeout:90000},async()=>{
 const api=await startApi(4072);
 try{
  const u=await api.user({plan:'Pro'}),other=await api.user({plan:'Pro'});
  for(const t of ['Buy MILK today','Call plumber','Milk run 100%','Pay rent'])assert.equal((await u.request('/api/records','POST',task(t))).status,201);
  assert.equal((await other.request('/api/records','POST',task('Secret milk task'))).status,201);
  const all=await u.json('/api/records?kind=task');assert.equal(all.total,4);
  const milk=await u.json('/api/records?kind=task&q=milk');assert.equal(milk.total,2);assert.equal(milk.records.length,2,'search never returns another account\'s rows');
  const pct=await u.json('/api/records?q=100%25');assert.equal(pct.total,1,'% is matched literally');
  const paged=await u.json('/api/records?kind=task&limit=3&page=2');assert.equal(paged.records.length,1);assert.equal(paged.total,4);
  const bad=await u.request('/api/records','POST',{kind:'task',data:{title:''}});assert.equal(bad.status,400);
  const body=await bad.json() as any;assert.ok(Array.isArray(body.details));assert.ok(body.details.every((d:any)=>Object.keys(d).sort().join()==='message,path'));
  assert.equal((await u.request('/api/snapshot')).headers.get('cache-control'),'no-store');
 }finally{await api.stop();}
});
