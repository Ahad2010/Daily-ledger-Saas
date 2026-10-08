import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
test('a future notification is not leased when PostgreSQL uses a non-UTC timezone',{skip:!process.env.TEST_DATABASE_URL,timeout:60000},async()=>{
 const url=process.env.TEST_DATABASE_URL,pool=new pg.Pool({connectionString:url}),user=randomUUID(),job=randomUUID();
 try{
  await pool.query('INSERT INTO "User" (id,email,name) VALUES ($1,$2,$3)',[user,`${user}@example.com`,'Clock fixture']);
  await pool.query('INSERT INTO "Job" (id,"userId",type,"recordId","expectedVersion",key,"dueAt") VALUES ($1,$2,$3,$4,1,$5,$6)',[job,user,'clock-fixture',user,`clock-${job}`,new Date(Date.now()+3600000).toISOString()]);
  const child=spawnSync(process.execPath,['--import','tsx','apps/api/src/worker.ts'],{env:{...process.env,DATABASE_URL:url,PGOPTIONS:'-c timezone=Asia/Karachi',RESEND_API_KEY:'',EMAIL_FROM:''},encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(child.status,0,child.stderr);const row=(await pool.query('SELECT status,attempts FROM "Job" WHERE id=$1',[job])).rows[0];assert.equal(row.status,'pending');assert.equal(row.attempts,0);
 }finally{await pool.query('DELETE FROM "User" WHERE id=$1',[user]);await pool.end();}
});
