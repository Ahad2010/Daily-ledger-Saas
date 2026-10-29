import {randomUUID} from 'node:crypto';
import {Resend} from 'resend';
import {db} from './db.js';
import {renderEmail} from './email-template.js';
import {resetToken,tokenHash} from './passwords.js';
const cooldown=45_000,lifetime=5*60_000;
// Emails a single-use reset link. It runs after the response is sent, so an unknown address and a real account answer the same way and take the same time.
export async function sendResetLink(email:string){
 const credential=await db.passwordCredential.findUnique({where:{email}});
 if(!credential)return;
 if(await db.passwordReset.findFirst({where:{userId:credential.userId,usedAt:null,createdAt:{gt:new Date(Date.now()-cooldown)}}}))return;
 const id=randomUUID(),token=resetToken(id,credential.userId);
 // An older unused link stays valid: if it were cancelled here, anyone could keep invalidating the owner's link by asking for new ones.
 // Using any one link marks all of them used (see the reset route), and each expires on its own after five minutes.
 await db.passwordReset.create({data:{id,userId:credential.userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+lifetime)}});
 const url=new URL('/reset-password',process.env.FRONTEND_ORIGIN);url.searchParams.set('id',id);url.searchParams.set('token',token);
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM){console.warn('[auth] Password reset requested but email delivery is not configured.');return;}
 const link=url.toString();
 const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
  from:process.env.EMAIL_FROM,to:email,subject:'Reset your Daily Ledger password',
  text:`Reset your Daily Ledger password using this single-use link. It is valid for 5 minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
  html:renderEmail({preheader:'Choose a new password. The link works once and expires in 5 minutes.',heading:'Reset your password',blocks:[{type:'p',text:'We got a request to reset the password for your Daily Ledger account. The link below works once and expires in 5 minutes.'},{type:'note',text:'If you did not ask for this, ignore this email. Your password has not changed.'}],cta:{label:'Choose a new password',url:link},footer:'You are receiving this because someone asked to reset the password for this email address.'})
 },{idempotencyKey:`password-reset-link:${id}`});
 if(result.error)console.error('[auth] Resend rejected the password reset email:',result.error.message);
}
