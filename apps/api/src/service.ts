import { Prisma, type User, type Record as DbRecord } from '@prisma/client';
import { kindSchema, schemas, quotaAllowed, localDate, planTransaction, type Kind, type LedgerRecord, type Snapshot, type RecordData } from '@ledger/shared';
import { db } from './db.js';
import {policy,allowed,publicLimits,platformSettings} from './platform.js';
export class HttpError extends Error{constructor(public status:number,message:string){super(message);}}
export const dto=(r:DbRecord):LedgerRecord=>({id:r.id,kind:r.kind,data:r.data,version:r.version} as LedgerRecord);
export function ownedWhere(userId:string,id:string){return {userId,id};}
export function metadata(kind:Kind,data:any){return {recordDate:data.date||data.month||data.nextDate||data.deadline||(data.due?data.due.slice(0,10):null),status:kind==='task'||kind==='grocery'||kind==='milestone'||kind==='workout'?(data.done?'done':'active'):data.active===false||data.enabled===false?'inactive':'active',uniqueKey:kind==='completion'?`habit:${data.habitId}:${data.date}`:kind==='meal'?`meal:${data.date}:${data.slot}`:kind==='budget'?`budget:${data.repeats?'repeat':data.month}:${data.currency}:${data.category||'all'}`:kind==='financeCategory'?`category:${data.type}:${data.title.toLowerCase()}`:kind==='transaction'&&data.sourceId?`cash-plan:${data.sourceId}:${data.sourceMonth}`:null};}
export async function snapshot(user:User):Promise<Snapshot>{const p=await policy(user);const settings=(await platformSettings()).settings;const [records,announcements,dismissals]=await Promise.all([db.record.findMany({where:{userId:user.id},orderBy:{createdAt:'asc'}}),db.announcement.findMany({where:{status:'published',...(settings.publicAnnouncements?{}:{id:'disabled'}),publishAt:{lte:new Date()},expiresAt:{gt:new Date()},audience:{in:['Everyone',p.plan]}}}),db.announcementDismissal.findMany({where:{userId:user.id}})]);return {profile:{name:user.name,email:user.email,currency:user.currency,timezone:user.timezone,plan:p.plan,allowances:publicLimits(p.limits),role:user.role,onboardingCompletedAt:user.onboardingCompletedAt?.toISOString()||null,persona:user.persona,focusAreas:user.focusAreas as string[],optionalEmails:user.optionalEmails,productUpdates:user.productUpdates},records:[...records.map(dto),...announcements.map(a=>({id:a.id,kind:'announcement' as const,data:a.data as RecordData['announcement'],version:a.version}))],dismissed:dismissals.map(d=>`${d.announcementId}:${d.version}`)};}
export async function saveRecord(userId:string,input:{id?:string;kind:Kind;data:unknown;version?:number}){
 const kind=kindSchema.parse(input.kind);if(['announcement','notification'].includes(kind))throw new HttpError(403,'This record type is managed by the server.');const data=schemas[kind].parse(input.data) as any;
 return db.$transaction(async tx=>{
  // Serialize quota checks and all writes for one owner, including concurrent creates.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(user.status!=='active')throw new HttpError(403,'This account is suspended.');if(kind==='workout'&&data.done&&data.date>localDate(new Date(),user.timezone))throw new HttpError(400,'Completed workouts must be dated today or earlier.');const effective=await policy(user,tx);const rows=await tx.record.findMany({where:{userId}});const existing=input.id?rows.find(r=>r.id===input.id):undefined;
  if(input.id&&!existing)throw new HttpError(404,'Record not found.');if(existing&&(input.version!==existing.version||kind!==existing.kind))throw new HttpError(409,'This record changed. Reload the workspace before saving.');
  const isSameMonth=kind==='transaction'&&existing&&(existing.data as any).date.slice(0,7)===data.date.slice(0,7);
  const activating=kind==='task'?existing&&(existing.data as any).done&&!data.done:kind==='habit'||kind==='goal'?existing&&!(existing.data as any).active&&data.active:kind==='automation'?existing&&!(existing.data as any).enabled&&data.enabled:false;
  if((!existing||activating||(kind==='transaction'&&!isSameMonth))&&!quotaAllowed(effective.plan,kind,data,rows.filter(r=>r.id!==input.id).map(dto),user.timezone,effective.limits))throw new HttpError(403,'Your plan allowance is reached. Existing records remain available.');
  if(kind==='recurring'&&effective.plan==='Free'&&!existing)throw new HttpError(403,'Recurring planning requires a paid plan.');
  if(kind==='task'&&data.recurrence!=='none'&&effective.plan==='Free'&&(!existing||(existing.data as any).recurrence!==data.recurrence))throw new HttpError(403,'Repeating tasks require a paid plan.');
  if(kind==='completion'){const habit=rows.find(r=>r.id===data.habitId&&r.kind==='habit');if(!habit)throw new HttpError(404,'Habit not found.');const h=habit.data as RecordData['habit'];if(!h.active||data.date<h.startDate||data.date>localDate(new Date(),user.timezone)||!h.days.includes(new Date(`${data.date}T12:00:00Z`).getUTCDay()))throw new HttpError(400,'This is not an eligible scheduled habit day.');}
  if(kind==='milestone'&&!rows.some(r=>r.id===data.goalId&&r.kind==='goal'))throw new HttpError(404,'Goal not found.');
  if(kind==='grocery'&&data.mealId&&!rows.some(r=>r.id===data.mealId&&r.kind==='meal'))throw new HttpError(404,'Meal not found.');
  if(kind==='transaction'&&(data.sourceId||data.sourceMonth)){if(!existing||(existing.data as any).sourceId!==data.sourceId||(existing.data as any).sourceMonth!==data.sourceMonth||!data.date.startsWith(data.sourceMonth))throw new HttpError(400,'Linked transactions must be created through Mark received or Mark paid. Keep their original month when editing.');}
  if(kind==='task')data.completedAt=data.done?(existing&&(existing.data as any).done?(existing.data as any).completedAt||null:new Date().toISOString()):null;
  const payload={data:data as Prisma.InputJsonValue,...metadata(kind,data)};
  const r=existing?await tx.record.update({where:{id:existing.id},data:{...payload,version:{increment:1}}}):await tx.record.create({data:{userId,kind,...payload}});
  if(kind==='task'){
   await tx.job.updateMany({where:{userId,recordId:r.id,status:{in:['pending','leased']}},data:{status:'cancelled'}});
   if(data.reminder&&!data.done){const dueAt=new Date(new Date(data.due).getTime()+86400000);const key=`task:${r.id}:${r.version}:${data.due}`;await tx.job.upsert({where:{key},create:{userId,key,type:'task-overdue',recordId:r.id,expectedVersion:r.version,dueAt},update:{}});}
  }
  // In-app reminders are always available; emails are separately gated by the worker.
  return dto(r);
 },{maxWait:30000,timeout:15000});
}
export async function settlePlan(userId:string,id:string,month:string,date:string,version:number){return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
 const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(user.status!=='active')throw new HttpError(403,'This account is suspended.');const plan=await tx.record.findFirst({where:{userId,id,kind:'cashPlan'}});
 if(!plan)throw new HttpError(404,'Income source or bill not found.');
 const key=`cash-plan:${id}:${month}`;const existing=await tx.record.findUnique({where:{userId_uniqueKey:{userId,uniqueKey:key}}});if(existing)return dto(existing);
 if(plan.version!==version)throw new HttpError(409,'This plan changed. Reload and retry.');
 if(!(plan.data as RecordData['cashPlan']).active)throw new HttpError(400,'Resume this plan before recording a payment.');
 if(!date.startsWith(month)||date>localDate(new Date(),user.timezone))throw new HttpError(400,'Choose an actual payment date in this month, no later than today.');
 const data=planTransaction(dto(plan) as LedgerRecord<'cashPlan'>,month,date);const rows=await tx.record.findMany({where:{userId,kind:'transaction'}});
 if(!await allowed(user,'transaction',data,rows.map(dto),tx))throw new HttpError(403,'Your monthly transaction allowance is reached.');
 return dto(await tx.record.create({data:{userId,kind:'transaction',data,...metadata('transaction',data)}}));
});}
export async function deleteRecord(userId:string,id:string,version:number){return db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;const r=await tx.record.findFirst({where:ownedWhere(userId,id)});if(!r)throw new HttpError(404,'Record not found.');if(r.version!==version)throw new HttpError(409,'Record changed. Reload before deleting.');if(r.kind==='habit'||r.kind==='goal'){const children=await tx.record.findMany({where:{userId,kind:r.kind==='habit'?'completion':'milestone',data:{path:[r.kind==='habit'?'habitId':'goalId'],equals:id}}});await tx.record.deleteMany({where:{userId,id:{in:children.map(c=>c.id)}}});}if(r.kind==='meal'){const groceries=await tx.record.findMany({where:{userId,kind:'grocery',data:{path:['mealId'],equals:id}}});for(const grocery of groceries){const data={...grocery.data as Record<string,unknown>};delete data.mealId;await tx.record.update({where:{id:grocery.id},data:{data:data as any,version:{increment:1}}});}}await tx.job.updateMany({where:{userId,recordId:id,status:{in:['pending','leased']}},data:{status:'cancelled'}});await tx.record.delete({where:{id}});});}
export async function markNotification(userId:string,id:string,version:number,read:boolean){const result=await db.record.updateMany({where:{...ownedWhere(userId,id),kind:'notification',version},data:{data:{...(await db.record.findFirstOrThrow({where:{...ownedWhere(userId,id),kind:'notification'}})).data as object,read},version:{increment:1}}});if(!result.count)throw new HttpError(409,'Notification changed. Reload and retry.');}

