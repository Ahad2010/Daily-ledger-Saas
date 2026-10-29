import {createHash,createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {Request,Response} from 'express';
import type {Prisma} from '@prisma/client';
import {db} from './db.js';
// A browser that has signed in successfully is remembered for 30 days. The cookie is "id.secret.signature": the secret is random,
// only its hash is stored, and the signature ties all of it to one user, so a cookie from one account is worth nothing on another.
export const TRUST_COOKIE='ledger.td';
const days=30,maxPerUser=10,production=process.env.NODE_ENV==='production';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const signature=(id:string,userId:string,secret:string)=>createHmac('sha256',process.env.SESSION_SECRET!).update(`trusted-device:${id}:${userId}:${secret}`).digest('hex');
const same=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
function presented(req:Request){
 const raw=(req.headers.cookie||'').split(';').map(part=>part.trim()).find(part=>part.startsWith(TRUST_COOKIE+'='));
 const [id,secret,sig]=(raw?.slice(TRUST_COOKIE.length+1)||'').split('.');
 return id&&secret&&sig?{id,secret,sig}:null;
}
async function validRow(req:Request,userId:string){
 const cookie=presented(req);if(!cookie||!same(signature(cookie.id,userId,cookie.secret),cookie.sig))return null;
 const row=await db.trustedDevice.findUnique({where:{id:cookie.id}});
 return row&&row.userId===userId&&row.expiresAt>new Date()&&same(row.secretHash,sha(cookie.secret))?row:null;
}
export async function isTrustedDevice(req:Request,userId:string|undefined){
 if(!userId)return false;
 try{return !!await validRow(req,userId);}catch{return false;}
}
/** Called after a correct password: refresh this browser's trust, or remember it for the first time. */
export async function trustThisDevice(req:Request,res:Response,userId:string){
 try{
  const options={httpOnly:true,secure:production,sameSite:'lax' as const,maxAge:days*86400000,path:'/'};
  const expiresAt=new Date(Date.now()+days*86400000),existing=await validRow(req,userId);
  if(existing){await db.trustedDevice.update({where:{id:existing.id},data:{lastUsedAt:new Date(),expiresAt}});const cookie=presented(req)!;res.cookie(TRUST_COOKIE,`${cookie.id}.${cookie.secret}.${cookie.sig}`,options);return;}
  await db.trustedDevice.deleteMany({where:{userId,expiresAt:{lt:new Date()}}});
  const old=await db.trustedDevice.findMany({where:{userId},orderBy:{lastUsedAt:'desc'},skip:maxPerUser-1,select:{id:true}});
  if(old.length)await db.trustedDevice.deleteMany({where:{id:{in:old.map(row=>row.id)}}});
  const id=randomUUID(),secret=randomBytes(32).toString('hex');
  await db.trustedDevice.create({data:{id,userId,secretHash:sha(secret),expiresAt}});
  res.cookie(TRUST_COOKIE,`${id}.${secret}.${signature(id,userId,secret)}`,options);
 }catch(error){console.error('[auth] Could not remember this device:',error instanceof Error?error.message:error);}
}
export const forgetTrustedDevices=(client:Prisma.TransactionClient|typeof db,userId:string)=>client.trustedDevice.deleteMany({where:{userId}});
