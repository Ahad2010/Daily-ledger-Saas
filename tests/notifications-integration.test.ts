import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const url=process.env.TEST_DATABASE_URL;
test('planning emails are paid-only, durable and cancelled when a meal is completed',{skip:!url,timeout:120000},async()=>{
 const pool=new pg.Pool({connectionString:url}),free=randomUUID(),pro=randomUUID(),meal=randomUUID(),day=new Date(Date.now()-86400000).toISOString().slice(0,10);
 const worker=()=>new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','apps/api/src/worker.ts'],{env:{...process.env,DATABASE_URL:url,RESEND_API_KEY:'',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',SESSION_SECRET:'notification-fixture-secret-at-least-32-chars'},windowsHide:true,stdio:'pipe'});let errors='';child.stderr.on('data',data=>errors+=data);child.once('exit',code=>code===0?resolve():reject(new Error(errors)));});
 try{for(const [id,plan] of [[free,'Free'],[pro,'Pro']]){await pool.query('INSERT INTO "User" (id,email,name,plan,"optionalEmails") VALUES ($1,$2,$3,$4,true)',[id,`${id}@example.com`,'Notification fixture',plan]);await pool.query('INSERT INTO "Record" (id,"userId",kind,data,"recordDate","updatedAt") VALUES ($1,$2,\'meal\',$3,$4,NOW())',[id===pro?meal:randomUUID(),id,JSON.stringify({title:'Fixture breakfast',date:day,slot:'Breakfast',notes:'',eaten:false}),day]);}
 await worker();await worker();const emailJobs=(await pool.query('SELECT "userId",status,"deliveredAt" FROM "Job" WHERE type=\'record-email\' AND "userId"=ANY($1)',[[free,pro]])).rows;assert.equal(emailJobs.length,1);assert.equal(emailJobs[0].userId,pro);assert.equal(emailJobs[0].status,'pending');assert.equal(emailJobs[0].deliveredAt,null);
 await pool.query('UPDATE "Record" SET data=jsonb_set(data,\'{eaten}\',\'true\'),version=version+1 WHERE id=$1',[meal]);await pool.query('UPDATE "Job" SET "dueAt"=NOW() WHERE "recordId"=$1 AND type=\'record-email\'',[meal]);await worker();assert.equal((await pool.query('SELECT status FROM "Job" WHERE "recordId"=$1 AND type=\'record-email\'',[meal])).rows[0].status,'cancelled');
 }finally{await pool.query('DELETE FROM "User" WHERE id=ANY($1)',[[free,pro]]);await pool.end();}
});
