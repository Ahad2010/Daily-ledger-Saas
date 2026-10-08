import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {db} from './db.js';
import {HttpError} from './service.js';

const cloud=()=>({name:process.env.CLOUDINARY_CLOUD_NAME,key:process.env.CLOUDINARY_API_KEY,secret:process.env.CLOUDINARY_API_SECRET});
export const cloudinaryConfigured=()=>{const c=cloud();return !!(c.name&&c.key&&c.secret&&/^[a-z0-9_-]+$/i.test(c.name));};
// Cloudinary signature: parameters sorted by name, joined as k=v&k=v, API secret appended, SHA-1 hex.
export function cloudinarySignature(params:Record<string,string|number>,secret:string){
 const payload=Object.keys(params).sort().map(k=>`${k}=${params[k]}`).join('&');
 return createHash('sha1').update(payload+secret).digest('hex');
}
const folder='daily-ledger/avatars';
export const avatarPublicIdPattern=(userId:string)=>new RegExp(`^${folder}/${userId}-[a-f0-9]{8}$`);
// Only images stored in OUR Cloudinary account, under this user's own public ID, can become an avatar.
export function validAvatar(userId:string,cloudName:string,url:string,publicId:string){
 if(!avatarPublicIdPattern(userId).test(publicId))return false;
 const escaped=publicId.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`^https://res\\.cloudinary\\.com/${cloudName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/image/upload/(?:[a-z0-9_,.:-]+/)*(?:v\\d+/)?${escaped}\\.(?:jpg|jpeg|png|webp)$`,'i').test(url);
}
async function destroy(publicId:string|null){
 if(!publicId||!cloudinaryConfigured())return;
 const c=cloud(),timestamp=Math.floor(Date.now()/1000),signature=cloudinarySignature({public_id:publicId,timestamp},c.secret!);
 try{await fetch(`https://api.cloudinary.com/v1_1/${c.name}/image/destroy`,{method:'POST',body:new URLSearchParams({public_id:publicId,timestamp:String(timestamp),api_key:c.key!,signature}),signal:AbortSignal.timeout(8000)});}
 catch(error){console.error('Avatar cleanup failed:',(error as Error).message);}
}
export function avatarRoutes(){
 const router=Router();
 const limiter=rateLimit({windowMs:3600000,limit:20,keyGenerator:req=>req.user!.id,message:{error:'Too many photo changes. Please try again later.'},standardHeaders:true,legacyHeaders:false});
 router.get('/',async(req,res)=>{const user=await db.user.findUniqueOrThrow({where:{id:req.user!.id}});res.json({configured:cloudinaryConfigured(),avatarUrl:user.avatarUrl});});
 router.post('/sign',limiter,(req,res)=>{
  if(!cloudinaryConfigured())throw new HttpError(503,'Profile photos are not configured.');
  const c=cloud(),timestamp=Math.floor(Date.now()/1000),publicId=`${folder}/${req.user!.id}-${randomBytes(4).toString('hex')}`;
  const signed={allowed_formats:'jpg,png,webp',public_id:publicId,timestamp,transformation:'c_fill,g_auto,h_256,w_256'};
  res.json({...signed,cloudName:c.name,apiKey:c.key,signature:cloudinarySignature(signed,c.secret!),uploadUrl:`https://api.cloudinary.com/v1_1/${c.name}/image/upload`});
 });
 router.put('/',limiter,async(req,res)=>{
  if(!cloudinaryConfigured())throw new HttpError(503,'Profile photos are not configured.');
  const input=z.object({url:z.string().url().max(500),publicId:z.string().max(200)}).parse(req.body);
  if(!validAvatar(req.user!.id,cloud().name!,input.url,input.publicId))throw new HttpError(400,'This image is not a valid Daily Ledger profile photo.');
  const old=await db.user.findUniqueOrThrow({where:{id:req.user!.id}});
  await db.user.update({where:{id:req.user!.id},data:{avatarUrl:input.url,avatarPublicId:input.publicId}});
  if(old.avatarPublicId&&old.avatarPublicId!==input.publicId)void destroy(old.avatarPublicId);
  res.json({avatarUrl:input.url});
 });
 router.delete('/',limiter,async(req,res)=>{
  const old=await db.user.findUniqueOrThrow({where:{id:req.user!.id}});
  await db.user.update({where:{id:req.user!.id},data:{avatarUrl:null,avatarPublicId:null}});void destroy(old.avatarPublicId);res.status(204).end();
 });
 return router;
}
