import {db} from './db.js';
import {platformSettings} from './platform.js';
import {HttpError} from './service.js';

export async function googleAccount(profile:{id:string;displayName:string;emails?:{value:string;verified?:boolean}[]}){
 const email=profile.emails?.find(item=>item.verified===true)?.value.trim().toLowerCase();
 if(!email)throw new HttpError(401,'Google must provide a verified email address.');
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
  const linked=await tx.user.findUnique({where:{googleId:profile.id}});
  if(linked)return {...linked,referralNew:false};
  const existing=await tx.user.findMany({where:{email:{equals:email,mode:'insensitive'}}});
  if(existing.length>1||existing[0]?.googleId)throw new HttpError(409,'Contact support to connect this Google account.');
  if(existing[0])return {...await tx.user.update({where:{id:existing[0].id},data:{googleId:profile.id}}),referralNew:false};
  const settings=(await platformSettings(tx)).settings;
  return {...await tx.user.create({data:{googleId:profile.id,email,name:profile.displayName||'Daily Ledger user',currency:settings.currency,timezone:settings.timezone,optionalEmails:settings.optionalEmailsDefault}}),referralNew:true};
 });
}
