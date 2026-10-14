import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
const url=process.env.TEST_DATABASE_URL;
const secret='hardening-session-secret-32-characters-long';

test('the API refuses an invalid TRUST_PROXY_HOPS value instead of silently mis-keying rate limits',()=>{
 const run=(hops:string)=>spawnSync(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:url||'postgresql://x:x@127.0.0.1:1/x',SESSION_SECRET:secret,PORT:'4032',TRUST_PROXY_HOPS:hops},encoding:'utf8',timeout:30000});
 const bad=run('9');assert.notEqual(bad.status,0);assert.match(bad.stderr,/TRUST_PROXY_HOPS/);
});

test('a POST without a JSON body is a 400 validation error, not a 500',{skip:!url,timeout:60000},async()=>{
 const port=4031,origin='http://localhost:3000',base=`http://localhost:${port}`;
 const api=spawn(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:url,SESSION_SECRET:secret,FRONTEND_ORIGIN:origin,PORT:String(port),NODE_ENV:'development'},stdio:'pipe'});let logs='';api.stdout.on('data',d=>logs+=d);api.stderr.on('data',d=>logs+=d);
 try{
  let ready=false;for(let n=0;n<200&&!ready;n++){try{ready=(await fetch(base+'/health')).ok;}catch{/* still starting */}if(!ready)await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
  const first=await fetch(base+'/auth/csrf');const {csrf}=await first.json() as {csrf:string};const cookie=first.headers.getSetCookie()[0].split(';')[0];
  const response=await fetch(base+'/auth/forgot-password',{method:'POST',headers:{Cookie:cookie,Origin:origin,'X-CSRF-Token':csrf}});
  assert.equal(response.status,400);
 }finally{api.kill();}
});

for(const app of ['web','admin'])test(`${app} frontend sends security headers and long-lived caching for unhashed static assets`,()=>{
 const run=spawnSync(process.execPath,['--import','tsx','--eval',`import('./apps/${app}/next.config.ts').then(async m=>{const c=m.default.default||m.default;console.log(JSON.stringify(await c.headers()))})`],{env:{...process.env,VERCEL:'',NEXT_PUBLIC_DATA_MODE:'demo'},encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr);const rules=JSON.parse(run.stdout.trim().split('\n').at(-1)!) as {source:string;headers:{key:string;value:string}[]}[];
 const keys=(source:string)=>rules.filter(r=>r.source===source).flatMap(r=>r.headers.map(h=>h.key));
 assert.ok(keys('/:path*').includes('X-Frame-Options')&&keys('/:path*').includes('X-Content-Type-Options'));
 if(app==='web')assert.ok(keys('/fitness/:path*').includes('Cache-Control'));
 assert.ok(rules.some(r=>r.headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex'))));
});
