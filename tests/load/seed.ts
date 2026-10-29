// Fills a DISPOSABLE local database with a realistic crowd for the k6 load test: users with a password, a live session each, and some records.
// Usage: LOAD_DATABASE_URL=<local db> SESSION_SECRET=<same secret the API is started with> [LOAD_USERS=10000] [LOAD_RECORDS=50] tsx tests/load/seed.ts <out.json>
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import pg from 'pg';
import {hashPassword} from '../../apps/api/src/passwords';
const sign=createRequire(import.meta.url)('cookie-signature').sign as (value:string,secret:string)=>string;
const url=process.env.LOAD_DATABASE_URL,secret=process.env.SESSION_SECRET,out=process.argv[2];
if(!url||!secret||!out)throw new Error('Set LOAD_DATABASE_URL and SESSION_SECRET and pass an output file.');
if(!/(localhost|127\.0\.0\.1)/.test(url))throw new Error('Refusing to seed anything that is not a local database.');
const users=Number(process.env.LOAD_USERS||10000),records=Number(process.env.LOAD_RECORDS||50),password='Load-test-pass-1!';
const pool=new pg.Pool({connectionString:url});
async function main(){
const hash=await hashPassword(password);
await pool.query(`INSERT INTO "User" (id,"googleId",email,name,plan,timezone,currency,status,"entitlementSource","onboardingCompletedAt")
 SELECT gen_random_uuid(),'load-'||n,'load'||n||'@example.com','Load User '||n,CASE WHEN n%10=0 THEN 'Pro' ELSE 'Free' END,'Asia/Karachi','PKR','active','free',NOW() FROM generate_series(1,$1) n`,[users]);
await pool.query(`INSERT INTO "PasswordCredential" (id,"userId",email,"passwordHash","updatedAt") SELECT gen_random_uuid(),id,email,$1,NOW() FROM "User" WHERE email LIKE 'load%@example.com'`,[hash]);
await pool.query(`INSERT INTO "Record" (id,"userId",kind,data,"recordDate","updatedAt")
 SELECT gen_random_uuid(),u.id,'transaction',jsonb_build_object('title','Item '||g,'date',to_char(NOW()-(g||' days')::interval,'YYYY-MM-DD'),'amount',(g*137)%9000+100,'currency','PKR','type',CASE WHEN g%7=0 THEN 'income' ELSE 'expense' END,'category','Food','account','Cash','notes',''),to_char(NOW()-(g||' days')::interval,'YYYY-MM-DD'),NOW()
 FROM "User" u CROSS JOIN generate_series(1,$1) g WHERE u.email LIKE 'load%@example.com'`,[records]);
const rows=(await pool.query(`SELECT id,email FROM "User" WHERE email LIKE 'load%@example.com' ORDER BY email`)).rows as {id:string;email:string}[];
const csrf='c'.repeat(64),sessions:{email:string;cookie:string}[]=[];
for(let i=0;i<rows.length;i+=1000){
 const part=rows.slice(i,i+1000),sids=part.map((_,k)=>`load-sid-${i+k}`);
 await pool.query(`INSERT INTO session (sid,sess,expire) SELECT s.sid,jsonb_build_object('cookie',jsonb_build_object('originalMaxAge',86400000,'httpOnly',true,'path','/','sameSite','lax'),'passport',jsonb_build_object('user',s.uid),'csrf',$3::text)::json,NOW()+INTERVAL '1 day' FROM unnest($1::text[],$2::text[]) AS s(sid,uid)`,[sids,part.map(r=>r.id),csrf]);
 part.forEach((r,k)=>sessions.push({email:r.email,cookie:'ledger.sid='+encodeURIComponent('s:'+sign(sids[k],secret))}));
}
writeFileSync(out,JSON.stringify({password,csrf,sessions}));
console.log(JSON.stringify({users:rows.length,recordsPerUser:records,file:out}));
await pool.end();
}
main().catch(error=>{console.error(error);process.exit(1);});
