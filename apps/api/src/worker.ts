import 'dotenv/config';
import { Resend } from 'resend';
import { localDate, nextOccurrence, reminderEligible, type LedgerRecord, type RecordData } from '@ledger/shared';
import { db,pool } from './db.js';
import { dto,metadata } from './service.js';
import { resetToken } from './passwords.js';
import {policy,allowed} from './platform.js';
import {sendBrowser,habitReminderDate,localHour,zonedHour,recordReminder,notificationEmailAllowed} from './push.js';
const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;
async function queuePlanningEmail(userId:string,type:string,recordId:string,date:string,dueAt:Date,version:number){const user=await db.user.findUniqueOrThrow({where:{id:userId}});if(!user.optionalEmails||(await policy(user)).plan==='Free')return;const key=`${type}:${recordId}:${date}`;await db.job.upsert({where:{key},create:{userId,type,recordId,expectedVersion:version,key,dueAt,payload:{date}},update:{}});}
async function schedules(){
 await db.$executeRaw`UPDATE "Job" j SET "dueAt"=((r.data->>'due')::timestamptz+INTERVAL '23 hours') AT TIME ZONE 'UTC' FROM "Record" r WHERE j.type='task-overdue' AND j.status='pending' AND j.attempts=0 AND j."recordId"=r.id AND r.kind='task' AND j."expectedVersion"=r.version`;
 const subscribed=await db.user.findMany({where:{status:'active',OR:[{pushSubscriptions:{some:{reminders:true}}},{optionalEmails:true}]},take:1000});
 for(const user of subscribed){const today=localDate(new Date(),user.timezone);const morningKey=`morning-browser:${user.id}:${today}`;await db.job.upsert({where:{key:morningKey},create:{userId:user.id,type:'morning-browser',recordId:user.id,expectedVersion:1,key:morningKey,dueAt:zonedHour(today,8,user.timezone),payload:{date:today}},update:{}});const rows=await db.record.findMany({where:{userId:user.id,kind:{in:['goal','milestone','workout','meal','task']}}});const records=rows.map(dto);for(const row of rows){const reminder=recordReminder(dto(row),records);if(reminder){const key=`record-browser:${row.id}:${reminder.date}`;await db.job.upsert({where:{key},create:{userId:user.id,type:'record-browser',recordId:row.id,expectedVersion:row.version,key,dueAt:zonedHour(reminder.date,23,user.timezone),payload:{date:reminder.date}},update:{}});await queuePlanningEmail(user.id,'record-email',row.id,reminder.date,zonedHour(reminder.date,23,user.timezone),row.version);}else if(row.kind==='task'){const task=row.data as RecordData['task'];if(task.reminder&&!task.done){const key=`task:${row.id}:${row.version}:${task.due}:browser`;await db.job.upsert({where:{key},create:{userId:user.id,type:'task-browser',recordId:row.id,expectedVersion:row.version,key,dueAt:new Date(new Date(task.due).getTime()+23*3600000)},update:{}});}}}}
 // ponytail: at most 1,000 subscribed habits per tick; paginate this scan before larger deployments.
 const habits=await db.record.findMany({where:{kind:'habit',status:'active',user:{status:'active',OR:[{pushSubscriptions:{some:{reminders:true}}},{optionalEmails:true}]}},include:{user:true},take:1000});
 for(const habit of habits){const date=habitReminderDate(habit.data as RecordData['habit'],habit.user.timezone);if(!date||await db.record.findFirst({where:{userId:habit.userId,kind:'completion',recordDate:date,data:{path:['habitId'],equals:habit.id}}}))continue;const key=`habit-browser:${habit.id}:${date}`;await db.job.upsert({where:{key},create:{userId:habit.userId,type:'habit-browser',recordId:habit.id,expectedVersion:habit.version,key,dueAt:new Date(),payload:{date}},update:{}});await queuePlanningEmail(habit.userId,'habit-email',habit.id,date,new Date(),habit.version);}
 const definitions=await db.record.findMany({where:{kind:'recurring',status:'active'},take:100,orderBy:{recordDate:'asc'}});
 for(const definition of definitions)await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${definition.userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:definition.userId}});const fresh=await tx.record.findUnique({where:{id:definition.id}});if(!fresh||user.status!=='active'||(await policy(user,tx)).plan==='Free')return;
  const data=fresh.data as RecordData['recurring'];if(!data.enabled||data.nextDate>localDate(new Date(),user.timezone))return;
  const {title,amount,currency,type,category,account,notes}=data;const entry={title,amount,currency,type,category,account,notes,date:data.nextDate};const key=`recurring:${fresh.id}:${data.nextDate}`;
  const transactions=await tx.record.findMany({where:{userId:user.id,kind:'transaction'}});if(!await allowed(user,'transaction',entry,transactions.map(dto),tx))return;
  await tx.record.upsert({where:{userId_uniqueKey:{userId:user.id,uniqueKey:key}},create:{userId:user.id,kind:'transaction',data:entry,...metadata('transaction',entry),uniqueKey:key},update:{}});
  const updated={...data,nextDate:nextOccurrence(data.nextDate,data.frequency)};await tx.record.update({where:{id:fresh.id},data:{data:updated,...metadata('recurring',updated),version:{increment:1}}});
 });
 // A completed repeating task creates one next occurrence, not one per refresh.
 const repeating=await db.record.findMany({where:{kind:'task',status:'done'},take:100});
 for(const definition of repeating)await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${definition.userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:definition.userId}});const task=await tx.record.findUnique({where:{id:definition.id}});if(!task||user.status!=='active'||(await policy(user,tx)).plan==='Free')return;const data=task.data as RecordData['task'];if(!data.done||data.recurrence==='none')return;
  const key=`task-repeat:${task.id}`;if(await tx.record.findUnique({where:{userId_uniqueKey:{userId:user.id,uniqueKey:key}}}))return;
  const due=new Date(data.due);if(data.recurrence==='weekly')due.setUTCDate(due.getUTCDate()+7);else {const day=due.getUTCDate();due.setUTCDate(1);due.setUTCMonth(due.getUTCMonth()+1);due.setUTCDate(Math.min(day,new Date(Date.UTC(due.getUTCFullYear(),due.getUTCMonth()+1,0)).getUTCDate()));}
  const next={...data,done:false,completedAt:null,due:due.toISOString()};const all=await tx.record.findMany({where:{userId:user.id}});if(!await allowed(user,'task',next,all.map(dto),tx))return;
  const r=await tx.record.create({data:{userId:user.id,kind:'task',data:next,...metadata('task',next),uniqueKey:key}});if(next.reminder)await tx.job.create({data:{userId:user.id,type:'task-overdue',recordId:r.id,expectedVersion:r.version,key:`task:${r.id}:1:${next.due}`,dueAt:new Date(due.getTime()+23*3600000)}});if(next.reminder)await tx.job.create({data:{userId:user.id,type:'task-browser',recordId:r.id,expectedVersion:r.version,key:'task:'+r.id+':1:'+next.due+':browser',dueAt:new Date(due.getTime()+23*3600000)}});
 });
 const announcements=await db.announcement.findMany({where:{status:'published',publishAt:{lte:new Date(Date.now()-86400000)},expiresAt:{gt:new Date()}},take:100});
 for(const a of announcements){const data=a.data as RecordData['announcement'];if(!data.followup)continue;const users=await db.user.findMany({where:{status:'active',productUpdates:true}});for(const user of users){if(a.audience!=='Everyone'&&a.audience!==(await policy(user)).plan)continue;await db.job.upsert({where:{key:`announcement:${a.id}:${a.version}:${user.id}`},create:{key:`announcement:${a.id}:${a.version}:${user.id}`,userId:user.id,type:'announcement-followup',recordId:a.id,expectedVersion:a.version,dueAt:new Date(a.publishAt.getTime()+86400000)},update:{}});}}
}
async function deliver(jobId:string){
 await db.$transaction(async tx=>{
  const initial=await tx.job.findUniqueOrThrow({where:{id:jobId}});
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${initial.userId} FOR UPDATE`;
  const job=await tx.job.findUniqueOrThrow({where:{id:jobId}});if(job.status!=='leased')return;
  const user=await tx.user.findUniqueOrThrow({where:{id:job.userId}});if(user.status!=='active'){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}const effective=await policy(user,tx);let title='',emailEligible=false;
  if(['task-browser','habit-browser','morning-browser','record-browser','habit-email','record-email','admin-browser','admin-email'].includes(job.type)){
   let payload=job.payload as {title:string;body:string;url:string;actorId?:string};
   if(job.type==='task-browser'){const task=await tx.record.findFirst({where:{id:job.recordId,userId:user.id,kind:'task'}});const data=task?.data as RecordData['task']|undefined;if(!task||task.version!==job.expectedVersion||!data?.reminder||data.done||new Date(data.due).getTime()+23*3600000>Date.now()){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}payload={title:'A task is waiting for you',body:data.title,url:'/tasks'};}
   else if((job.type==='habit-browser'||job.type==='habit-email')){const date=(job.payload as {date:string}).date;const habit=await tx.record.findFirst({where:{id:job.recordId,userId:user.id,kind:'habit'}});const data=habit?.data as RecordData['habit']|undefined;const completed=await tx.record.findFirst({where:{userId:user.id,kind:'completion',recordDate:date,data:{path:['habitId'],equals:job.recordId}}});if(!habit||habit.version!==job.expectedVersion||!data?.active||date<data.startDate||!data.days.includes(new Date(date+'T12:00:00Z').getUTCDay())||completed){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}payload={title:'Your habit check-in is waiting',body:data.title,url:'/tasks'};}
   else if(job.type==='morning-browser'){const date=(job.payload as {date:string}).date,hour=localHour(user.timezone);if(localDate(new Date(),user.timezone)!==date||hour<8||hour>=12){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}payload={title:'Good morning ☀️',body:'Open Daily Ledger to plan your day and keep your tasks on track ✨',url:'/'};}
   else if((job.type==='record-browser'||job.type==='record-email')){const row=await tx.record.findFirst({where:{id:job.recordId,userId:user.id}});const steps=row?.kind==='goal'?await tx.record.findMany({where:{userId:user.id,kind:'milestone',data:{path:['goalId'],equals:row.id}}}):[];const reminder=row?recordReminder(dto(row),steps.map(dto)):null;if(!reminder||reminder.date!==(job.payload as {date:string}).date){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}payload=reminder;}
   else {const access=await tx.adminAccess.findUnique({where:{id:1},include:{user:true}});if(!access?.active||access.user.status!=='active'||access.userId!==payload.actorId||access.version!==job.expectedVersion||job.type==='admin-email'&&!notificationEmailAllowed(effective.plan,user.productUpdates)){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}}
   if(['habit-email','record-email'].includes(job.type)){const sentJobs=await tx.job.findMany({where:{userId:user.id,type:{in:['task-overdue','announcement-followup','habit-email','record-email']},deliveredAt:{not:null}}});const used=sentJobs.filter(j=>localDate(j.deliveredAt!,user.timezone).slice(0,7)===localDate(new Date(),user.timezone).slice(0,7)).length;if(!notificationEmailAllowed(effective.plan,user.optionalEmails)||used>=effective.limits.emails){await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null}});return;}}
   let sent=0;if(job.type.endsWith('-email')){if(!resend)throw new Error('Email delivery is not configured.');const first=await tx.deliveryAttempt.findFirst({where:{jobId:job.id},orderBy:{createdAt:'asc'}});if(first&&Date.now()-first.createdAt.getTime()>23*3600000)throw new Error('Delivery idempotency window expired; operator review required.');const result=await resend.emails.send({from:process.env.EMAIL_FROM!,to:user.email,subject:payload.title,text:`${payload.body}\n\n${process.env.FRONTEND_ORIGIN}${payload.url}\nManage announcement emails in Settings.`},{idempotencyKey:job.key});if(result.error)throw new Error('Announcement email delivery failed.');sent=1;}
   // ponytail: Web Push has no provider idempotency receipt; topic/tag replaces duplicate visible notifications after a crash.
   else sent=(await sendBrowser(tx,user.id,payload,job.key,!job.type.startsWith('admin-'))).sent;
   await tx.deliveryAttempt.update({where:{jobId_attempt:{jobId:job.id,attempt:job.attempts}},data:{status:sent?'sent':'skipped'}});await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null,deliveredAt:sent?new Date():null,lastError:null}});return;
  }
  if(job.type==='admin-test'){const access=await tx.adminAccess.findUnique({where:{id:1}});if(!access?.active||access.userId!==user.id||access.version!==job.expectedVersion){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}if(!resend)throw new Error('Resend is not configured.');const result=await resend.emails.send({from:process.env.EMAIL_FROM!,to:user.email,subject:'Daily Ledger test email',text:'This test email was explicitly requested from Daily Ledger Admin.'},{idempotencyKey:job.key});if(result.error)throw new Error('Test email delivery failed.');await tx.deliveryAttempt.update({where:{jobId_attempt:{jobId:job.id,attempt:job.attempts}},data:{status:'sent',providerId:result.data?.id}});await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null,deliveredAt:new Date()}});return;}
  if(job.type==='password-reset'){
   const reset=await tx.passwordReset.findFirst({where:{id:job.recordId,userId:user.id,usedAt:null,expiresAt:{gt:new Date()}}});const credential=await tx.passwordCredential.findUnique({where:{userId:user.id}});
   if(!reset||!credential){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}
   if(!resend||!process.env.SESSION_SECRET)throw new Error('Password reset delivery is not configured.');
   const url=new URL('/reset-password',process.env.FRONTEND_ORIGIN);url.searchParams.set('id',reset.id);url.searchParams.set('token',resetToken(reset.id,user.id));
   const result=await resend.emails.send({from:process.env.EMAIL_FROM!,to:credential.email,subject:'Reset your Daily Ledger password',text:`Reset your password using this single-use link, valid for one hour:\n${url}\n\nIf you did not request this, ignore this email. Your password has not changed.`},{idempotencyKey:job.key});if(result.error)throw new Error(result.error.message);
   await tx.deliveryAttempt.update({where:{jobId_attempt:{jobId:job.id,attempt:job.attempts}},data:{status:'sent',providerId:result.data?.id}});await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null,deliveredAt:new Date(),lastError:null}});return;
  }
  if(job.type==='task-overdue'){
   const task=await tx.record.findFirst({where:{id:job.recordId,userId:user.id,kind:'task'}});
   if(!task||task.version!==job.expectedVersion||!reminderEligible(dto(task) as LedgerRecord<'task'>,new Date())){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}
   title=`Overdue: ${(task.data as RecordData['task']).title}`;emailEligible=user.optionalEmails;
   await tx.record.upsert({where:{userId_uniqueKey:{userId:user.id,uniqueKey:`reminder:${job.key}`}},create:{userId:user.id,kind:'notification',uniqueKey:`reminder:${job.key}`,data:{title,read:false,date:localDate(new Date(),user.timezone)}},update:{}});
  }else{
   const a=await tx.announcement.findUnique({where:{id:job.recordId}});const dismissal=await tx.announcementDismissal.findUnique({where:{userId_announcementId_version:{userId:user.id,announcementId:job.recordId,version:job.expectedVersion}}});
   if(!a||a.status!=='published'||a.publishAt>new Date()||dismissal||a.version!==job.expectedVersion||a.expiresAt<=new Date()||(a.audience!=='Everyone'&&a.audience!==effective.plan)||!(a.data as RecordData['announcement']).followup){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}
   title=(a.data as RecordData['announcement']).title;emailEligible=user.productUpdates;
  }
  const rules=await tx.record.findMany({where:{userId:user.id,kind:'automation'}});const matching=rules.filter(r=>(r.data as RecordData['automation']).type===job.type);if(matching.length&&!matching.some(r=>(r.data as RecordData['automation']).enabled))emailEligible=false;
  const allowance=effective.limits.emails;const month=localDate(new Date(),user.timezone).slice(0,7);
  // Count successful sends by local calendar month; lock prevents concurrent quota bypass.
  const sends=await tx.job.findMany({where:{userId:user.id,type:{notIn:['password-reset','task-browser','habit-browser','morning-browser','record-browser','admin-browser','admin-email']},deliveredAt:{not:null}}});const used=sends.filter(j=>localDate(j.deliveredAt!,user.timezone).startsWith(month)).length;
  if(!emailEligible||!allowance||used>=allowance){await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null}});return;}
  if(!resend)throw new Error('Resend is not configured; durable email remains queued.');
  // Resend idempotency covers retry after a crash following provider acceptance.
  // Never retry beyond its 24-hour key window: uncertain deliveries require operator review.
  const first=await tx.deliveryAttempt.findFirst({where:{jobId:job.id},orderBy:{createdAt:'asc'}});
  if(first&&Date.now()-first.createdAt.getTime()>23*3600000)throw new Error('Delivery idempotency window expired; operator review required.');
  const result=await resend.emails.send({from:process.env.EMAIL_FROM!,to:user.email,subject:title,text:`${title}\n\nOpen your Daily Ledger workspace: ${process.env.FRONTEND_ORIGIN}\nManage reminder preferences in Settings.`},{idempotencyKey:job.key});
  if(result.error)throw new Error(result.error.message);
  await tx.deliveryAttempt.upsert({where:{jobId_attempt:{jobId:job.id,attempt:job.attempts}},create:{jobId:job.id,attempt:job.attempts,status:'sent',providerId:result.data?.id},update:{status:'sent',providerId:result.data?.id}});
  await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null,deliveredAt:new Date(),lastError:null}});
 },{timeout:30000});
}
export async function runWorker(){await schedules();const jobs=await db.$queryRaw<{id:string}[]>`UPDATE "Job" SET status='leased', "leaseUntil"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')+INTERVAL '2 minutes', attempts=attempts+1 WHERE id IN (SELECT id FROM "Job" WHERE (status='pending' OR (status='leased' AND "leaseUntil"<(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))) AND "dueAt"<=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AND attempts<"maxAttempts" ORDER BY "dueAt" LIMIT 25 FOR UPDATE SKIP LOCKED) RETURNING id`;
 for(const job of jobs){
  // Persist the attempt before delivery, so even a rolled-back/crashed send has a durable window.
  const current=await db.job.findUniqueOrThrow({where:{id:job.id}});await db.deliveryAttempt.upsert({where:{jobId_attempt:{jobId:job.id,attempt:current.attempts}},create:{jobId:job.id,attempt:current.attempts,status:'started'},update:{}});
  try{await deliver(job.id);console.log(JSON.stringify({job:job.id,status:'processed'}));}catch(e){const message=(e as Error).message;await db.deliveryAttempt.update({where:{jobId_attempt:{jobId:job.id,attempt:current.attempts}},data:{status:'failed',error:message}});await db.job.updateMany({where:{id:job.id,status:'leased'},data:{status:current.attempts>=current.maxAttempts?'failed':'pending',leaseUntil:null,lastError:message,dueAt:new Date(Date.now()+Math.min(3600000,300000*2**current.attempts))}});console.error(JSON.stringify({job:job.id,error:message}));}
 }
}
runWorker().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.$disconnect();await pool.end();});
