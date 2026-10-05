import {readFileSync,writeFileSync} from 'node:fs';
function edit(file,run){writeFileSync(file,run(readFileSync(file,'utf8')));}
edit('apps/api/src/server.ts',s=>{
 s=s.replace("import { passwordAuth } from './password-auth.js';","import { passwordAuth } from './password-auth.js';\nimport {adminAuthentication,adminRoutes} from './admin.js';\nimport {aiRoutes} from './ai.js';");
 const start=s.indexOf('function auth('),end=s.indexOf('function csrf(',start);s=s.slice(0,start)+"async function auth(req:Request,res:Response,next:NextFunction){if(!req.isAuthenticated())return res.status(401).json({error:'Sign in to access your workspace.'});const u=req.user as User;if(u.status!=='active')return res.status(403).json({error:'This account is suspended. Contact support.'});if(!u.lastActiveAt||u.lastActiveAt.getTime()<Date.now()-300000)await db.user.update({where:{id:u.id},data:{lastActiveAt:new Date()}});next();}\n"+s.slice(end);
 s=s.replace("app.use('/auth',passwordAuth(csrf));","app.use('/auth',passwordAuth(csrf));\napp.use('/auth/admin',adminAuthentication(csrf));");
 s=s.replace("app.get('/api/snapshot'","app.use('/api/admin',adminRoutes());\napp.use('/api/ai',aiRoutes());\napp.get('/api/snapshot'");
 s=s.split('\n').filter(line=>!line.startsWith("app.post('/api/admin/announcements'")).join('\n');
 s=s.replace("app.post('/api/billing/checkout'", "app.post('/api/announcements/:id/read',async(req,res)=>{const id=String(req.params.id);const version=z.number().int().positive().parse(req.body.version);const a=await db.announcement.findUnique({where:{id}});const s=await snapshot(req.user as User);if(!a||a.status!=='published'||a.version!==version||a.publishAt>new Date()||a.expiresAt<=new Date()||(a.audience!=='Everyone'&&a.audience!==s.profile.plan))throw new HttpError(404,'Announcement not available.');await db.announcementRead.upsert({where:{userId_announcementId_version:{userId:req.user!.id,announcementId:id,version}},create:{userId:req.user!.id,announcementId:id,version},update:{}});res.json({ok:true});});\napp.post('/api/billing/checkout'");return s;
});
edit('apps/api/src/service.ts',s=>{
 s=s.replace("import { db } from './db.js';","import { db } from './db.js';\nimport {policy,allowed,publicLimits,platformSettings} from './platform.js';");
 s=s.replace("snapshot(user:User):Promise<Snapshot>{const", "snapshot(user:User):Promise<Snapshot>{const p=await policy(user);const settings=(await platformSettings()).settings;const");
 s=s.replace("where:{publishAt:{lte:new Date()},expiresAt:{gt:new Date()},audience:{in:['Everyone',user.plan]}}", "where:{status:'published',...(settings.publicAnnouncements?{}:{id:'disabled'}),publishAt:{lte:new Date()},expiresAt:{gt:new Date()},audience:{in:['Everyone',p.plan]}}");
 s=s.replace("plan:user.plan as Plan,role:user.role", "plan:p.plan,allowances:publicLimits(p.limits),role:user.role");
 s=s.replace("const user=await tx.user.findUniqueOrThrow({where:{id:userId}});const rows", "const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(user.status!=='active')throw new HttpError(403,'This account is suspended.');const effective=await policy(user,tx);const rows");
 s=s.replace("!quotaAllowed(user.plan as Plan,kind,data,rows.filter(r=>r.id!==input.id).map(dto),user.timezone)", "!await allowed(user,kind,data,rows.filter(r=>r.id!==input.id).map(dto),tx)");
 s=s.replaceAll("user.plan==='Free'","effective.plan==='Free'");
 s=s.replace("const user=await tx.user.findUniqueOrThrow({where:{id:userId}});const plan=", "const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(user.status!=='active')throw new HttpError(403,'This account is suspended.');const plan=");
 s=s.replace("!quotaAllowed(user.plan as Plan,'transaction',data,rows.map(dto),user.timezone)","!await allowed(user,'transaction',data,rows.map(dto),tx)");
 return s.replace('schemas, quotaAllowed,','schemas,');
});
edit('apps/api/src/password-auth.ts',s=>s.replace("if(!valid||!credential)","if(!valid||!credential||credential.user.status!=='active')"));
edit('apps/api/src/worker.ts',s=>{
 s=s.replace("import { resetToken } from './passwords.js';","import { resetToken } from './passwords.js';\nimport {policy,allowed} from './platform.js';");
 s=s.replace("if(!fresh||user.plan==='Free')return;","if(!fresh||user.status!=='active'||(await policy(user,tx)).plan==='Free')return;");
 s=s.replace("if(!task||user.plan==='Free')return;","if(!task||user.status!=='active'||(await policy(user,tx)).plan==='Free')return;");
 s=s.replace("if(!quotaAllowed(user.plan as Plan,'task',next,all.map(dto),user.timezone))return;","if(!await allowed(user,'task',next,all.map(dto),tx))return;");
 s=s.replace("const announcements=await db.announcement.findMany({where:{publishAt:","const announcements=await db.announcement.findMany({where:{status:'published',publishAt:");
 s=s.replace("where:{productUpdates:true,...(a.audience==='Everyone'?{}:{plan:a.audience})}","where:{status:'active',productUpdates:true}");
 s=s.replace("for(const user of users)await db.job.upsert", "for(const user of users){if(a.audience!=='Everyone'&&a.audience!==(await policy(user)).plan)continue;await db.job.upsert");
 s=s.replace("dueAt:new Date(a.publishAt.getTime()+86400000)},update:{}});}","dueAt:new Date(a.publishAt.getTime()+86400000)},update:{}});}}");
 s=s.replace("const user=await tx.user.findUniqueOrThrow({where:{id:job.userId}});let", "const user=await tx.user.findUniqueOrThrow({where:{id:job.userId}});if(user.status!=='active'){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}const effective=await policy(user,tx);let");
 s=s.replace("if(job.type==='password-reset'){","if(job.type==='admin-test'){const access=await tx.adminAccess.findUnique({where:{id:1}});if(!access?.active||access.userId!==user.id||access.version!==job.expectedVersion){await tx.job.update({where:{id:job.id},data:{status:'cancelled',leaseUntil:null}});return;}if(!resend)throw new Error('Resend is not configured.');const result=await resend.emails.send({from:process.env.EMAIL_FROM!,to:user.email,subject:'Daily Ledger test email',text:'This test email was explicitly requested from Daily Ledger Admin.'},{idempotencyKey:job.key});if(result.error)throw new Error('Test email delivery failed.');await tx.deliveryAttempt.update({where:{jobId_attempt:{jobId:job.id,attempt:job.attempts}},data:{status:'sent',providerId:result.data?.id}});await tx.job.update({where:{id:job.id},data:{status:'done',leaseUntil:null,deliveredAt:new Date()}});return;}\n  if(job.type==='password-reset'){");
 s=s.replace("if(!a||dismissal", "if(!a||a.status!=='published'||a.publishAt>new Date()||dismissal");s=s.replace("a.audience!==user.plan","a.audience!==effective.plan");
 s=s.replace("const allowance=plans[user.plan as Plan].emails;","const allowance=effective.limits.emails;");
 s=s.replace("AND attempts<5", "AND attempts<\"maxAttempts\"");s=s.replace("current.attempts>=5", "current.attempts>=current.maxAttempts");
 s=s.replace('reminderEligible, plans, quotaAllowed,','reminderEligible,');s=s.replace('type LedgerRecord, type Plan,','type LedgerRecord,');
 return s;
});
