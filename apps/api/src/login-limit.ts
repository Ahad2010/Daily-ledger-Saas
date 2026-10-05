import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
import {createHash} from 'node:crypto';
export const loginLimit=rateLimit({windowMs:15*60000,limit:5,skipSuccessfulRequests:true,keyGenerator:req=>ipKeyGenerator(req.ip||'127.0.0.1')+':'+createHash('sha256').update(String(req.body?.email||'').trim().toLowerCase()).digest('hex'),message:{error:'Too many failed sign-in attempts. Please try again in 15 minutes.'},standardHeaders:true,legacyHeaders:false});
