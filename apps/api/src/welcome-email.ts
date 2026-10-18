import {Resend} from 'resend';
import {renderEmail} from './email-template.js';
// Sent once, when an account is first created (email sign-up after the code, or first Google sign-in). A failure never blocks sign-up.
export async function sendWelcomeEmail(user:{id:string;email:string;name:string}){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM||!user.email)return;
 const first=(user.name||'').trim().split(/\s+/)[0]||'there';
 const origin=(process.env.FRONTEND_ORIGIN||'').replace(/\/$/,'');
 const trial=process.env.TRIAL_MODE!=='off';
 const parts={preheader:'Your workspace is ready. Here is a quick way to start.',heading:`Welcome, ${first}`,blocks:[
  {type:'p' as const,text:'Your Daily Ledger workspace is ready. Money, tasks, fitness, meals and goals now live in one calm place.'},
  {type:'list' as const,items:['Add your first income or expense from Quick add.','Create a habit and tick it off each day.','Set one goal that matters to you.']},
  ...(trial?[{type:'p' as const,text:'Want everything unlocked? You can start a free 7-day Pro trial from Settings, then Plan & usage. No card is needed.'}]:[]),
  {type:'note' as const,text:'Questions? Open Help in the app and send us a message. We read every one.'}],
  cta:{label:'Open Daily Ledger',url:origin||'https://dailyledger.store'},footer:'You are receiving this because you just created a Daily Ledger account.'};
 const text=`Welcome, ${first}\n\nYour Daily Ledger workspace is ready.\n\n- Add your first income or expense from Quick add.\n- Create a habit and tick it off each day.\n- Set one goal that matters to you.\n\nOpen Daily Ledger: ${parts.cta.url}\n`;
 try{
  const result=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.EMAIL_FROM,to:user.email,subject:'Welcome to Daily Ledger',text,html:renderEmail(parts)},{idempotencyKey:`welcome:${user.id}`});
  if(result.error)console.error('[auth] Resend rejected the welcome email:',result.error.message);
 }catch(error){console.error('[auth] Welcome email failed:',(error as Error).message);}
}
