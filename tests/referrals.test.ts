import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
import {recordReferral} from '../apps/api/src/referrals.js';
const sign=createRequire(import.meta.url)('cookie-signature').sign,url=process.env.TEST_DATABASE_URL;
test('referral links are stable; ranking is paid, verified, private and duplicate-safe',{skip:!url,timeout:120000},async()=>{
 const pool=new pg.Pool({connectionString:url}),users=[randomUUID(),randomUUID(),randomUUID(),randomUUID()],sids=users.map(()=>randomUUID()),secret='referral-test-secret-at-least-32-characters',base='http://localhost:4018';
 const processApi=spawn(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:url,SESSION_SECRET:secret,PORT:'4018',NODE_ENV:'test',FRONTEND_ORIGIN:'http://localhost:3000',ADMIN_ORIGIN:'http://localhost:3003',RESEND_API_KEY:'',EMAIL_FROM:''},windowsHide:true,stdio:'pipe'});let logs='';processApi.stderr.on('data',chunk=>logs+=chunk);
 const client=new pg.Pool({connectionString:url});
 // The helper uses a Prisma transaction in production; test it through a client bound only to the disposable DB.
 const {PrismaClient}=await import('@prisma/client'),{PrismaPg}=await import('@prisma/adapter-pg');const prisma=new PrismaClient({adapter:new PrismaPg(client)});
 try{
  for(let i=0;i<users.length;i++){await pool.query('INSERT INTO "User" (id,email,name,plan) VALUES ($1,$2,$3,$4)',[users[i],`ref-${users[i]}@example.com`,i===0?'Ahad Noor':'Referral fixture',i===0?'Pro':i===1?'Lifetime':'Free']);await pool.query('INSERT INTO session (sid,sess,expire) VALUES ($1,$2,NOW()+INTERVAL \'1 hour\')',[sids[i],JSON.stringify({cookie:{httpOnly:true,path:'/'},passport:{user:users[i]},csrf:'fixture'})]);}
  let ready=false;for(let i=0;i<400;i++){if(processApi.exitCode!==null)break;try{if((await fetch(base+'/ready')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
  const get=(i:number,path='/api/referrals')=>fetch(base+path,{headers:{Cookie:`ledger.sid=${encodeURIComponent('s:'+sign(sids[i],secret))}`}});
  const own=await (await get(0)).json() as any;assert.match(own.code,/^ahad-noor-[a-f0-9]{12}$/);assert.equal(own.rankingActive,false);assert.equal((await get(0,'/api/referrals/ranking')).status,403);
  const free=await (await get(2)).json() as any;assert.ok(free.link.includes('signup?ref='));assert.equal((await get(2,'/api/referrals/ranking')).status,403);
  const renamed='Renamed '+users[0];await pool.query('UPDATE "User" SET name=$2 WHERE id=$1',[users[0],renamed]);assert.equal((await (await get(0)).json() as any).code,own.code);
  const user=(i:number)=>({id:users[i],email:`ref-${users[i]}@example.com`});
  await recordReferral(prisma,user(0),own.code);assert.equal((await pool.query('SELECT COUNT(*) FROM "Referral" WHERE "referrerId"=$1',[users[0]])).rows[0].count,'0');
  await prisma.$transaction(tx=>recordReferral(tx,user(2),own.code));await prisma.$transaction(tx=>recordReferral(tx,user(2),own.code));assert.equal((await pool.query('SELECT COUNT(*) FROM "Referral" WHERE "referrerId"=$1',[users[0]])).rows[0].count,'1');
  const life=await (await get(1)).json() as any;await recordReferral(prisma,user(2),life.code);await recordReferral(prisma,user(3),life.code);
  const active=await (await get(0,'/api/referrals/ranking')).json() as any;assert.equal(active.rankingActive,true);assert.equal(active.total,1);assert.ok(active.leaders.length>=2);assert.ok(!JSON.stringify(active).includes('@example.com'));assert.equal(active.leaders.filter((r:any)=>r.you).length,1);
  await pool.query('UPDATE "User" SET status=\'suspended\' WHERE id=$1',[users[2]]);assert.equal((await (await get(0)).json() as any).rankingActive,false);
  await pool.query('UPDATE "User" SET status=\'active\' WHERE id=$1',[users[2]]);await pool.query('INSERT INTO "EntitlementOverride" (id,"userId",plan,reason,"expiresAt","grantedBy") VALUES ($1,$2,\'Free\',\'Fixture downgrade\',$3,$4)',[randomUUID(),users[0],new Date(Date.now()+3600000).toISOString(),users[1]]);assert.equal((await get(0,'/api/referrals/ranking')).status,403);assert.ok(!(await (await get(1)).json() as any).leaders.some((row:any)=>row.name===renamed));
  const logout=(origin:string)=>fetch(base+'/auth/logout',{method:'POST',headers:{Cookie:`ledger.sid=${encodeURIComponent('s:'+sign(sids[3],secret))}`,Origin:origin,'X-CSRF-Token':'fixture'}});assert.equal((await logout('http://evil.example')).status,403);assert.equal((await logout('http://localhost:3003')).status,204);
 }finally{processApi.kill();await pool.query('DELETE FROM session WHERE sid=ANY($1)',[sids]);await pool.query('DELETE FROM "User" WHERE id=ANY($1)',[users]);await prisma.$disconnect();await client.end();await pool.end();}
});
