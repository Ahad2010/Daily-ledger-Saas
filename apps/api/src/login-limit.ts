import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
import type {Request,Response,NextFunction} from 'express';
import {PgStore} from './pg-rate-limit.js';
import {createHash} from 'node:crypto';
/** The key that one network and one email share. A successful sign-in clears exactly this pair (and nothing network-wide). */
export const loginPairKey=(req:{ip?:string;body?:{email?:unknown}})=>ipKeyGenerator(req.ip||'127.0.0.1')+':'+createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex');
export const loginLimit=rateLimit({store:new PgStore('login-ip'),windowMs:15*60000,limit:5,skipSuccessfulRequests:true,keyGenerator:loginPairKey,message:{error:'Too many failed sign-in attempts. Please try again in 15 minutes.'},standardHeaders:true,legacyHeaders:false});


// Per-account cap across all IPs, so spraying one address from many places still runs out of attempts.
export const loginAccountLimit=rateLimit({store:new PgStore('login-account'),windowMs:60*60000,limit:20,skipSuccessfulRequests:true,keyGenerator:req=>'account:'+createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex'),message:{error:'Too many failed sign-in attempts for this account. Please try again later or reset your password.'},standardHeaders:true,legacyHeaders:false,validate:{keyGeneratorIpFallback:false}});

// The administrator sign-in had only the per-email counter, so a spray of different emails from one network was never stopped.
// It now shares the per-network failure cap and has its own ceiling on every request from a network.
export const adminIpCeiling=rateLimit({store:new PgStore('admin-ip'),windowMs:15*60000,limit:300,keyGenerator:req=>ipKeyGenerator(req.ip||'127.0.0.1'),validate:{keyGeneratorIpFallback:false},message:{error:'Too many requests from this network. Please try again in a few minutes.'},standardHeaders:true,legacyHeaders:false});

// Network-wide cap on FAILED sign-ins. A flat number punishes a busy shared network (an office, a mobile carrier) for its own typos,
// so the allowance grows with the number of different accounts that signed in correctly from that network in the same window:
// 100 failures, plus 20 for every different account that signed in (up to 100 accounts). A network that only fails, which is what a
// password spray looks like, keeps the base of 100. One real account signing in again and again counts once, so it cannot stretch the cap.
const failStore=new PgStore('ip-fail'),okPairStore=new PgStore('ip-ok-pair'),okStore=new PgStore('ip-ok'),ipWindow=15*60000;
for(const store of [failStore,okPairStore,okStore])store.init({windowMs:ipWindow} as never);
export const IP_FAIL_BASE=100,IP_FAIL_CREDIT=20,IP_FAIL_CREDIT_MAX=100;
const ipOf=(req:{ip?:string})=>ipKeyGenerator(req.ip||'127.0.0.1');
export async function ipFailureGuard(req:Request,res:Response,next:NextFunction){
 try{
  const ip=ipOf(req),[fail,ok]=await Promise.all([failStore.get(ip),okStore.get(ip)]);
  const allowed=IP_FAIL_BASE+IP_FAIL_CREDIT*Math.min(ok?.totalHits||0,IP_FAIL_CREDIT_MAX);
  if(fail&&fail.totalHits>=allowed){res.set('Retry-After',String(Math.max(1,Math.ceil(((fail.resetTime?.getTime()||Date.now())-Date.now())/1000))));return res.status(429).json({error:'Too many failed sign-in attempts from this network. Please try again in a few minutes.'});}
 }catch{/* if the counters cannot be read, do not stop sign-ins */}
 next();
}
export const recordIpFailure=(req:{ip?:string})=>failStore.increment(ipOf(req)).then(()=>undefined,()=>undefined);
export async function recordIpSuccess(req:{ip?:string},email:string){
 try{const hash=createHash('sha256').update(email.trim().toLowerCase()).digest('hex'),first=await okPairStore.increment(ipOf(req)+':'+hash);if(first.totalHits===1)await okStore.increment(ipOf(req));}catch{/* credit is a convenience, never a reason to fail a sign-in */}
}
