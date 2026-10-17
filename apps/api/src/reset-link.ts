import {randomUUID} from 'node:crypto';
import {Resend} from 'resend';
import {db} from './db.js';
import {resetToken,tokenHash} from './passwords.js';
const cooldown=45_000,lifetime=60*60_000;
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
// Emails a single-use reset link. It runs after the response is sent, so an unknown address and a real account answer the same way and take the same time.
export async function sendResetLink(email:string){
 const credential=await db.passwordCredential.findUnique({where:{email}});
 if(!credential)return;
 if(await db.passwordReset.findFirst({where:{userId:credential.userId,usedAt:null,createdAt:{gt:new Date(Date.now()-cooldown)}}}))return;
 const id=randomUUID(),token=resetToken(id,credential.userId);
 await db.$transaction([
  db.passwordReset.updateMany({where:{userId:credential.userId,usedAt:null},data:{usedAt:new Date()}}),
  db.passwordReset.create({data:{id,userId:credential.userId,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+lifetime)}})
 ]);
 const url=new URL('/reset-password',process.env.FRONTEND_ORIGIN);url.searchParams.set('id',id);url.searchParams.set('token',token);
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM){console.warn('[auth] Password reset requested but email delivery is not configured.');return;}
 const link=url.toString();
 const result=await new Resend(process.env.RESEND_API_KEY).emails.send({
  from:process.env.EMAIL_FROM,to:email,subject:'Reset your Daily Ledger password',
  text:`Reset your Daily Ledger password using this single-use link. It is valid for one hour.\n\n${link}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
  html:`<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111"><h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1><p style="font-size:15px;line-height:1.6;color:#444">Use the button below to choose a new Daily Ledger password. The link works once and expires in one hour.</p><p style="margin:28px 0"><a href="${escape(link)}" style="background:#111;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:600;font-size:15px;display:inline-block">Choose a new password</a></p><p style="font-size:13px;line-height:1.6;color:#777">If you did not ask for this, ignore this email. Your password has not changed.</p></div>`
 },{idempotencyKey:`password-reset-link:${id}`});
 if(result.error)console.error('[auth] Resend rejected the password reset email:',result.error.message);
}
