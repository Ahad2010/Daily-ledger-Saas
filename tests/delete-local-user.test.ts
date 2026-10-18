import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const skip=!process.env.TEST_DATABASE_URL;
const run=(args:string[],env:Record<string,string>={})=>spawnSync(process.execPath,['scripts/delete-local-user.mjs',...args],{env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL!,...env},encoding:'utf8',timeout:30000});

test('the local delete command shows first, deletes only with --yes, and clears everything that blocks a fresh sign-up',{skip,timeout:90000},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:2});
 const email=`delete-${randomUUID()}@example.com`,keepEmail=`keep-${randomUUID()}@example.com`;
 const make=async(e:string)=>{const id=randomUUID();await pool.query('INSERT INTO "User" (id,email,name,"createdAt") VALUES ($1,$2,$3,NOW())',[id,e,'Fixture']);await pool.query('INSERT INTO "PasswordCredential" (id,"userId",email,"passwordHash","updatedAt") VALUES ($1,$2,$3,$4,NOW())',[randomUUID(),id,e,'scrypt:aa:bb']);await pool.query(`INSERT INTO "Record" (id,"userId",kind,data,"updatedAt") VALUES ($1,$2,'task','{}',NOW())`,[randomUUID(),id]);await pool.query(`INSERT INTO "BillingRecord" (id,"userId",provider,reference,kind,currency,amount,status) VALUES ($1,$2,'whop',$3,'recurring','USD',2000,'paid')`,[randomUUID(),id,'ref-'+id]);const sid=randomUUID();await pool.query("INSERT INTO session (sid,sess,expire) VALUES ($1,$2,NOW()+INTERVAL '1 hour')",[sid,JSON.stringify({cookie:{},passport:{user:id}})]);return {id,sid};};
 const target=await make(email),keep=await make(keepEmail);
 await pool.query(`INSERT INTO "AuthChallenge" (id,email,purpose,"codeHash","expiresAt") VALUES ($1,$2,'signup','x',NOW()+INTERVAL '5 minutes')`,[randomUUID(),email]);
 const count=async(sql:string,v:unknown[])=>Number((await pool.query(sql,v)).rows[0].count);
 try{
  const dry=run([email]);assert.equal(dry.status,0,dry.stderr);assert.match(dry.stdout,/Add --yes/);assert.equal(await count('SELECT COUNT(*) FROM "User" WHERE id=$1',[target.id]),1,'a dry run deletes nothing');
  const done=run([email.toUpperCase(),'--yes']);assert.equal(done.status,0,done.stderr);assert.match(done.stdout,/Deleted 1 account/);
  for(const [sql,label] of [['SELECT COUNT(*) FROM "User" WHERE id=$1','user'],['SELECT COUNT(*) FROM "PasswordCredential" WHERE "userId"=$1','credential'],['SELECT COUNT(*) FROM "Record" WHERE "userId"=$1','records'],['SELECT COUNT(*) FROM "BillingRecord" WHERE "userId"=$1','billing']] as const)assert.equal(await count(sql,[target.id]),0,label);
  assert.equal(await count('SELECT COUNT(*) FROM session WHERE sid=$1',[target.sid]),0,'session');assert.equal(await count('SELECT COUNT(*) FROM "AuthChallenge" WHERE email=$1',[email]),0,'pending sign-up codes');
  assert.equal(await count('SELECT COUNT(*) FROM "User" WHERE id=$1',[keep.id]),1,'another account is untouched');assert.equal(await count('SELECT COUNT(*) FROM "Record" WHERE "userId"=$1',[keep.id]),1);assert.equal(await count('SELECT COUNT(*) FROM session WHERE sid=$1',[keep.sid]),1);
  // The same email can create an account again.
  await pool.query('INSERT INTO "User" (id,email,name) VALUES ($1,$2,$3)',[randomUUID(),email,'Again']);
  assert.match(run([randomUUID()+'@example.com']).stdout,/No account/);
 }finally{await pool.query('DELETE FROM session WHERE sid=ANY($1)',[[target.sid,keep.sid]]);await pool.query('DELETE FROM "User" WHERE lower(email)=ANY($1)',[[email,keepEmail]]);await pool.end();}
});

test('the local delete command refuses the administrator, remote databases and production',{skip,timeout:60000},async()=>{
 const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL,max:1});const id=randomUUID(),email=`admin-${randomUUID()}@example.com`;
 await pool.query('INSERT INTO "User" (id,email,name) VALUES ($1,$2,$3)',[id,email,'Admin']);await pool.query('INSERT INTO "AdminAccess" (id,"userId",version,active,"updatedAt") VALUES (1,$1,1,true,NOW())',[id]);
 try{
  const admin=run([email,'--yes']);assert.notEqual(admin.status,0);assert.match(admin.stderr,/administrator/);assert.equal(Number((await pool.query('SELECT COUNT(*) FROM "User" WHERE id=$1',[id])).rows[0].count),1);
  const remote=run([email,'--yes'],{DATABASE_URL:'postgresql://u:p@db.example.com:5432/app'});assert.notEqual(remote.status,0);assert.match(remote.stderr,/not on this computer/);
  const prod=run([email,'--yes'],{NODE_ENV:'production'});assert.notEqual(prod.status,0);assert.match(prod.stderr,/production/);
  assert.notEqual(run([]).status,0);
 }finally{await pool.query('DELETE FROM "AdminAccess" WHERE "userId"=$1',[id]);await pool.query('DELETE FROM "User" WHERE id=$1',[id]);await pool.end();}
});
