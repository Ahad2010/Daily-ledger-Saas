// Run with TEST_DATABASE_URL against a disposable, migrated PostgreSQL database.
// Test-only persisted sessions are inserted directly; the application exposes no auth bypass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import pg from 'pg';
import { randomUUID,createHash,createHmac } from 'node:crypto';
const require=createRequire(import.meta.url);
const sign=require('cookie-signature').sign;
const url=process.env.TEST_DATABASE_URL;
test('real PostgreSQL: ownership, CSRF, concurrent quotas, versions, sessions and job cancellation',{skip:!url,timeout:180000},async()=>{
 const pool=new pg.Pool({connectionString:url});const secret='integration-session-secret-32-characters-long';const csrf='a'.repeat(64);const origin='http://localhost:3000';const port=4011;
 const processApi=spawn(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:url,SESSION_SECRET:secret,FRONTEND_ORIGIN:origin,PORT:String(port),NODE_ENV:'development'},windowsHide:true,stdio:'pipe'});let logs='';processApi.stdout.on('data',d=>logs+=d);processApi.stderr.on('data',d=>logs+=d);
 const users=[randomUUID(),randomUUID()];const sessions=[randomUUID(),randomUUID()];
 try{
  for(let i=0;i<2;i++){await pool.query('INSERT INTO "User" (id,"googleId",email,name) VALUES ($1,$2,$3,$4)',[users[i],'test-'+users[i],'test@example.com','Integration user']);await pool.query('INSERT INTO session (sid,sess,expire) VALUES ($1,$2,NOW()+INTERVAL \'1 hour\')',[sessions[i],JSON.stringify({cookie:{originalMaxAge:3600000,expires:new Date(Date.now()+3600000).toISOString(),httpOnly:true,path:'/',sameSite:'lax'},passport:{user:users[i]},csrf})]);}
  const base=`http://localhost:${port}`;let ready=false;for(let n=0;n<400;n++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,logs);
  const request=(index:number,path:string,method='GET',body?:unknown,token=csrf)=>fetch(base+path,{method,headers:{Cookie:`ledger.sid=${encodeURIComponent('s:'+sign(sessions[index],secret))}`,Origin:origin,'X-CSRF-Token':token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await fetch(base+'/api/snapshot')).status,401);assert.equal((await request(0,'/api/preferences','PATCH',{name:'X'},'invalid')).status,403);
  const task={kind:'task',data:{title:'Private task',description:'',due:'2026-01-01T00:00:00Z',priority:'high',done:false,reminder:true,recurrence:'none'}};
  const created=await request(0,'/api/records','POST',task);assert.equal(created.status,201);const a=await created.json() as any;
  assert.equal((await request(1,`/api/records/${a.id}`,'PATCH',{...task,version:1})).status,404);assert.equal((await request(1,`/api/records/${a.id}`,'DELETE',{version:1})).status,404);
  const bSnapshot=await (await request(1,'/api/snapshot')).json() as any;assert.equal(bSnapshot.records.length,0);assert.equal((await request(1,'/api/export')).status,200);const search=await (await request(1,'/api/records?q=Private')).json() as any;assert.equal(search.total,0);
  const results=await Promise.all(Array.from({length:35},(_,i)=>request(0,'/api/records','POST',{...task,data:{...task.data,title:'Task '+i}})));assert.equal(results.filter(r=>r.status===201).length,4);assert.equal(results.filter(r=>r.status===403).length,31);
  const updated=await request(0,`/api/records/${a.id}`,'PATCH',{...task,version:1,data:{...task.data,done:true}});assert.equal(updated.status,200);assert.equal((await request(0,`/api/records/${a.id}`,'PATCH',{...task,version:1})).status,409);
  const cancelled=await pool.query('SELECT status FROM "Job" WHERE "recordId"=$1',[a.id]);assert.equal(cancelled.rows.length,2);assert.ok(cancelled.rows.every(r=>r.status==='cancelled'));
  assert.equal((await request(0,'/api/reports/2020-09.csv')).status,403);assert.equal((await request(0,'/api/reports/2026-09.pdf')).status,403);assert.equal((await request(0,'/api/billing/checkout','POST',{plan:'Pro'})).status,503);
  await pool.query('UPDATE "User" SET plan=\'Pro\' WHERE id=$1',[users[0]]);
  const recurring=await request(0,'/api/records','POST',{kind:'recurring',data:{title:'Monthly test',amount:10000,currency:'USD',type:'income',category:'Work',account:'Checking',nextDate:'2026-01-31',frequency:'monthly',enabled:true,notes:''}});assert.equal(recurring.status,201);
  const runWorker=()=>new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','apps/api/src/worker.ts'],{env:{...process.env,DATABASE_URL:url,SESSION_SECRET:secret,FRONTEND_ORIGIN:origin,RESEND_API_KEY:''},windowsHide:true,stdio:'pipe'});let output='';child.stderr.on('data',d=>output+=d);child.on('exit',code=>code===0?resolve():reject(new Error(output)));});
  await runWorker();await runWorker();const count=await pool.query('SELECT COUNT(*)::int AS total FROM "Record" WHERE "userId"=$1 AND kind=\'notification\'',[users[0]]);assert.equal(count.rows[0].total,4);await runWorker();const secondCount=await pool.query('SELECT COUNT(*)::int AS total FROM "Record" WHERE "userId"=$1 AND kind=\'notification\'',[users[0]]);assert.equal(secondCount.rows[0].total,4);const occurrences=await pool.query('SELECT "uniqueKey" FROM "Record" WHERE "userId"=$1 AND kind=\'transaction\'',[users[0]]);assert.equal(new Set(occurrences.rows.map(r=>r.uniqueKey)).size,3);
  assert.equal((await request(0,'/auth/logout','POST',{})).status,204);assert.equal((await request(0,'/api/snapshot')).status,401);
  const preauth=async()=>{const response=await fetch(base+'/auth/csrf');const body=await response.json() as any;return {cookie:response.headers.getSetCookie()[0].split(';')[0],csrf:body.csrf};};
  const post=(session:{cookie:string;csrf:string},path:string,body:unknown)=>fetch(base+path,{method:'POST',headers:{Cookie:session.cookie,Origin:origin,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
  let local=await preauth();const email=`integration-${randomUUID()}@example.com`;const password='correct horse battery staple 42!';const signup=await post(local,'/auth/signup',{name:'Email account',email,password,returnTo:'https://evil.example'});assert.equal(signup.status,200);assert.equal((await signup.json() as any).returnTo,'/');const localCookie=signup.headers.getSetCookie()[0].split(';')[0];assert.notEqual(localCookie,local.cookie);
  const credential=await pool.query('SELECT * FROM "PasswordCredential" WHERE email=$1',[email]);users.push(credential.rows[0].userId);assert.ok(credential.rows[0].passwordHash.startsWith('scrypt:'));assert.ok(!credential.rows[0].passwordHash.includes(password));
  local=await preauth();assert.equal((await post(local,'/auth/login',{email,password:'wrong'})).status,401);const login=await post(local,'/auth/login',{email,password});assert.equal(login.status,200);const signedCookie=login.headers.getSetCookie()[0].split(';')[0];local=await preauth();assert.equal((await post(local,'/auth/forgot-password',{email})).status,503);
  const resetId=randomUUID();const userId=credential.rows[0].userId;const token=createHmac('sha256',secret).update(`password-reset:${resetId}:${userId}`).digest('hex');await pool.query('INSERT INTO "PasswordReset" (id,"userId","tokenHash","expiresAt") VALUES ($1,$2,$3,NOW()+INTERVAL \'1 hour\')',[resetId,userId,createHash('sha256').update(token).digest('hex')]);
  assert.equal((await post(local,'/auth/reset-password',{id:resetId,token:'b'.repeat(64),password:'new correct horse staple 42!'})).status,400);assert.equal((await post(local,'/auth/reset-password',{id:resetId,token,password:'new correct horse staple 42!'})).status,200);assert.equal((await post(local,'/auth/reset-password',{id:resetId,token,password:'another password word 42!'})).status,400);assert.equal((await fetch(base+'/auth/me',{headers:{Cookie:signedCookie}})).status,401);assert.equal((await post(local,'/auth/login',{email,password:'new correct horse staple 42!'})).status,200);
 }finally{processApi.kill();await pool.query('DELETE FROM session WHERE sid=ANY($1)',[sessions]);await pool.query('DELETE FROM "User" WHERE id=ANY($1)',[users]);await pool.end();}
});

