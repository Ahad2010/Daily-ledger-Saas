// Starts the real API against the disposable TEST_DATABASE_URL and injects persisted sessions directly
// (the application exposes no auth bypass). Shared by feature integration tests.
import {spawn,type ChildProcess} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
const sign=createRequire(import.meta.url)('cookie-signature').sign as (value:string,secret:string)=>string;
export const origin='http://localhost:3000';
export async function startApi(port:number,env:Record<string,string>={}){
 const url=process.env.TEST_DATABASE_URL!,secret='feature-session-secret-at-least-32-characters',csrf='c'.repeat(64);
 const pool=new pg.Pool({connectionString:url}),users:string[]=[],sessions:string[]=[];
 const child:ChildProcess=spawn(process.execPath,['--import','tsx','apps/api/src/server.ts'],{env:{...process.env,DATABASE_URL:url,SESSION_SECRET:secret,FRONTEND_ORIGIN:origin,PORT:String(port),NODE_ENV:'development',RESEND_API_KEY:'',EMAIL_FROM:'',...env},stdio:'pipe'});
 let logs='';child.stdout?.on('data',d=>logs+=d);child.stderr?.on('data',d=>logs+=d);
 const base=`http://localhost:${port}`;let ready=false;
 for(let n=0;n<300&&!ready;n++){try{ready=(await fetch(base+'/health')).ok;}catch{/* starting */}if(!ready)await new Promise(r=>setTimeout(r,200));}
 if(!ready)throw new Error('API did not start: '+logs);
 async function user(fields:{plan?:string;timezone?:string;currency?:string;status?:string;name?:string}={}){
  const id=randomUUID(),sid=randomUUID();users.push(id);sessions.push(sid);
  await pool.query('INSERT INTO "User" (id,"googleId",email,name,plan,timezone,currency,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[id,'g-'+id,`${id}@example.com`,fields.name||'Feature user',fields.plan||'Free',fields.timezone||'UTC',fields.currency||'USD',fields.status||'active']);
  await pool.query("INSERT INTO session (sid,sess,expire) VALUES ($1,$2,NOW()+INTERVAL '1 hour')",[sid,JSON.stringify({cookie:{originalMaxAge:3600000,expires:new Date(Date.now()+3600000).toISOString(),httpOnly:true,path:'/',sameSite:'lax'},passport:{user:id},csrf})]);
  const request=(path:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:{Cookie:`ledger.sid=${encodeURIComponent('s:'+sign(sid,secret))}`,Origin:origin,'X-CSRF-Token':csrf,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {id,request,json:async<T=any>(path:string,method='GET',body?:unknown)=>(await request(path,method,body)).json() as Promise<T>};
 }
 return {user,pool,base,logs:()=>logs,async stop(){child.kill();await pool.query('DELETE FROM session WHERE sid=ANY($1)',[sessions]);await pool.query('DELETE FROM "User" WHERE id=ANY($1)',[users]);await pool.end();}};
}
