import type {Request} from 'express';
import type {Prisma} from '@prisma/client';
import {db} from './db.js';
// Administrators see what happened and when, never what was written. Event metadata is limited to short, non-sensitive labels.
export const activityTypes=['auth.signup','auth.login','auth.login_failed','auth.logout','auth.password_reset','onboarding.completed','record.created','record.updated','record.deleted','data.exported','support.ticket_created','notifications.enabled','trial.started','admin.login','admin.login_failed','admin.suspend','admin.reactivate','admin.revoke-sessions','admin.set-plan','admin.grant','admin.remove-override'] as const;
export const RETENTION_DAYS=180;
// Keep only a coarse network location: the last IPv4 octet and the host half of an IPv6 address are dropped.
export function maskIp(ip?:string|null){
 if(!ip)return null;const v4=ip.replace(/^::ffff:/,'');
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(v4))return v4.replace(/\.\d{1,3}$/,'.0');
 if(ip==='::1')return ip;
 if(ip.includes(':'))return ip.split(':').slice(0,3).join(':')+'::';
 return null;
}
export function maskEmail(email:string){const [name='',domain='']=email.split('@');return `${name.slice(0,1)}***@${domain}`;}
type Input={userId?:string|null;type:string;meta?:Record<string,string|number|boolean|null>};
// Logging must never slow down or break the request that caused it, so it is fire-and-forget and swallows its own errors.
export function logActivity(req:Request|null,input:Input,client:Prisma.TransactionClient|typeof db=db){
 return client.activityEvent.create({data:{userId:input.userId??null,type:input.type,ip:maskIp(req?.ip),userAgent:req?.get('user-agent')?.slice(0,200)||null,meta:(input.meta??{}) as Prisma.InputJsonValue}}).then(()=>undefined,error=>{console.error('Activity log failed:',(error as Error).message);});
}
export async function pruneActivity(days=RETENTION_DAYS){const cutoff=new Date(Date.now()-days*86400000);return (await db.activityEvent.deleteMany({where:{createdAt:{lt:cutoff}}})).count;}
