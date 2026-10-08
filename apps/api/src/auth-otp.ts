import {createHmac,randomInt,randomUUID,randomBytes,timingSafeEqual} from 'node:crypto';
import {Resend} from 'resend';
import {db} from './db.js';
import {HttpError} from './service.js';
import {platformSettings} from './platform.js';
import {tokenHash} from './passwords.js';
import {recordReferral} from './referrals.js';

const lifetime=10*60000,cooldown=45000;
const digest=(id:string,code:string)=>createHmac('sha256',process.env.SESSION_SECRET!).update(`auth-otp:${id}:${code}`).digest('hex');
export const otpConfigured=()=>!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM);
export function otpView(row:{id:string;email:string;purpose:string;expiresAt:Date;sentAt:Date}){return {id:row.id,email:row.email,purpose:row.purpose,expiresAt:row.expiresAt.toISOString(),resendAt:new Date(row.sentAt.getTime()+cooldown).toISOString()};}

export async function issueOtp(input:{email:string;purpose:'signup'|'reset';name?:string;passwordHash?:string;returnTo?:string;referralCode?:string},resendId?:string){
 if(!otpConfigured())throw new HttpError(503,'Verification email is not configured. Please contact your workspace operator.');
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.email}))`;
  const now=new Date(),old=await tx.authChallenge.findUnique({where:{email_purpose:{email:input.email,purpose:input.purpose}}});
  if(resendId&&(!old||old.id!==resendId||old.usedAt||old.verifiedAt))throw new HttpError(400,'Start a new verification request.');
  if(old&&now.getTime()-old.sentAt.getTime()<cooldown)throw new HttpError(429,'Wait 45 seconds before requesting another code.');
  if(old&&old.expiresAt>now&&old.attempts>=5)throw new HttpError(429,'Too many incorrect codes. Start again after this code expires.');
  const account=await tx.user.findFirst({where:{email:input.email}});
  if(input.purpose==='signup'&&account)throw new HttpError(409,'An account already uses this email. Use your original sign-in method.');
  const credential=input.purpose==='reset'?await tx.passwordCredential.findUnique({where:{email:input.email}}):null;
  // A fresh challenge ID also invalidates other browsers holding an older signup request.
  const id=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0');
  const data={codeHash:digest(id,code),proofHash:null,expiresAt:new Date(now.getTime()+lifetime),sentAt:now,verifiedAt:null,usedAt:null,attempts:old&&old.expiresAt>now?old.attempts:0,
   name:input.name??old?.name??null,passwordHash:input.passwordHash??old?.passwordHash??null,returnTo:input.returnTo??old?.returnTo??'/',referralCode:input.referralCode??old?.referralCode??null};
  const row=await tx.authChallenge.upsert({where:{email_purpose:{email:input.email,purpose:input.purpose}},create:{id,email:input.email,purpose:input.purpose,...data},update:{...data,id}});
  // Keep the response identical for unknown reset emails; no account information is exposed.
  if(input.purpose==='signup'||credential){
   const result=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.EMAIL_FROM!,to:input.email,subject:input.purpose==='signup'?'Verify your Daily Ledger email':'Your Daily Ledger password reset code',text:`Your Daily Ledger verification code is: ${code}\n\nIt expires in 10 minutes. Never share this code. If you did not request it, ignore this email.`},{idempotencyKey:`auth-otp:${id}:${now.getTime()}`});
   if(result.error)throw new HttpError(502,'The verification email could not be sent. Please retry shortly.');
  }
  return otpView(row);
 },{timeout:30000});
}

export async function verifyOtp(id:string,code:string,purpose:'signup'|'reset'){
 const result=await db.$transaction(async tx=>{
  const first=await tx.authChallenge.findUnique({where:{id}});
  if(!first)return {error:'This code is invalid or expired. Request a new code.'};
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${first.email}))`;
  await tx.$queryRaw`SELECT id FROM "AuthChallenge" WHERE id=${id} FOR UPDATE`;
  const row=await tx.authChallenge.findUnique({where:{id}});
  if(!row||row.purpose!==purpose||row.usedAt||row.verifiedAt||row.expiresAt<=new Date())return {error:'This code is invalid or expired. Request a new code.'};
  if(row.attempts>=5)return {error:'Too many incorrect codes. Start again after this code expires.',status:429};
  const valid=timingSafeEqual(Buffer.from(digest(id,code)),Buffer.from(row.codeHash));
  if(!valid){await tx.authChallenge.update({where:{id},data:{attempts:{increment:1}}});return {error:row.attempts===4?'Too many incorrect codes. Start again after this code expires.':'The verification code is incorrect.',status:row.attempts===4?429:400};}
  if(purpose==='signup'){
   if(await tx.user.findFirst({where:{email:row.email}}))return {error:'An account already uses this email. Log in instead.',status:409};
   const settings=(await platformSettings(tx)).settings;
   const user=await tx.user.create({data:{email:row.email,name:row.name!,currency:settings.currency,timezone:settings.timezone,optionalEmails:settings.optionalEmailsDefault,credential:{create:{email:row.email,passwordHash:row.passwordHash!}}}});
   await recordReferral(tx,user,row.referralCode);
   await tx.authChallenge.update({where:{id},data:{verifiedAt:new Date(),usedAt:new Date(),passwordHash:null,codeHash:''}});
   return {user,returnTo:row.returnTo};
  }
  if(!await tx.passwordCredential.findUnique({where:{email:row.email}}))return {error:'This code is invalid or expired. Request a new code.'};
  const token=randomBytes(32).toString('hex');
  await tx.authChallenge.update({where:{id},data:{verifiedAt:new Date(),proofHash:tokenHash(token),codeHash:''}});
  return {token};
 },{timeout:30000});
 if('error' in result)throw new HttpError(result.status||400,result.error!);
 return result;
}
