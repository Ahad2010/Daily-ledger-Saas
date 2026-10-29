import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
import {PgStore} from './pg-rate-limit.js';
import {createHash} from 'node:crypto';
export const loginLimit=rateLimit({store:new PgStore('login-ip'),windowMs:15*60000,limit:5,skipSuccessfulRequests:true,keyGenerator:req=>ipKeyGenerator(req.ip||'127.0.0.1')+':'+createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex'),message:{error:'Too many failed sign-in attempts. Please try again in 15 minutes.'},standardHeaders:true,legacyHeaders:false});

// Per-network cap on FAILED sign-ins, so one IP cannot spray many different emails. Successful sign-ins are not counted, so a shared office or carrier IP is fine.
export const loginIpFailLimit=rateLimit({store:new PgStore('login-ip-fail'),windowMs:15*60000,limit:100,skipSuccessfulRequests:true,keyGenerator:req=>ipKeyGenerator(req.ip||'127.0.0.1'),validate:{keyGeneratorIpFallback:false},message:{error:'Too many failed sign-in attempts from this network. Please try again in a few minutes.'},standardHeaders:true,legacyHeaders:false});

// Per-account cap across all IPs, so spraying one address from many places still runs out of attempts.
export const loginAccountLimit=rateLimit({store:new PgStore('login-account'),windowMs:60*60000,limit:20,skipSuccessfulRequests:true,keyGenerator:req=>'account:'+createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex'),message:{error:'Too many failed sign-in attempts for this account. Please try again later or reset your password.'},standardHeaders:true,legacyHeaders:false,validate:{keyGeneratorIpFallback:false}});

// The administrator sign-in had only the per-email counter, so a spray of different emails from one network was never stopped.
// It now shares the per-network failure cap and has its own ceiling on every request from a network.
export const adminIpCeiling=rateLimit({store:new PgStore('admin-ip'),windowMs:15*60000,limit:300,keyGenerator:req=>ipKeyGenerator(req.ip||'127.0.0.1'),validate:{keyGeneratorIpFallback:false},message:{error:'Too many requests from this network. Please try again in a few minutes.'},standardHeaders:true,legacyHeaders:false});
