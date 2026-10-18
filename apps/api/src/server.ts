import {googleAccount} from './google-account.js';
import {referralRoutes,recordReferral,referralCodeSchema} from './referrals.js';
import {PgStore} from './pg-rate-limit.js';
import {billingRoutes} from './billing.js';
import {whopWebhookRoutes,whopConfigured,whopStatus} from './whop.js';
import {importRoutes} from './import.js';
import {avatarRoutes} from './avatar.js';
import {pushRoutes} from './push.js';
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit,{ipKeyGenerator} from 'express-rate-limit';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import {renderReportPdf} from './report-pdf.js';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { kindSchema, preferenceSchema, onboardingSchema, schemas, fullReportRows, csv, metrics, plans, safeReturnTo, localDate } from '@ledger/shared';
import { db,pool } from './db.js';
import { snapshot,saveRecord,deleteRecord,markNotification,settlePlan,HttpError,dto } from './service.js';
import {otpConfigured} from './auth-otp.js';
import {sendWelcomeEmail} from './welcome-email.js';
import { passwordAuth } from './password-auth.js';
import {adminAuthentication,adminRoutes} from './admin.js';
import {supportRoutes} from './support.js';
import {aiRoutes} from './ai.js';
import {policy,platformSettings} from './platform.js';
import {logActivity} from './activity.js';
import {savePreferences} from './preferences.js';
declare module 'express-session' {interface SessionData{csrf?:string;returnTo?:string;referralCode?:string}}
// Passport extends Express's ambient namespace for session identity.
// eslint-disable-next-line @typescript-eslint/no-namespace
declare global {namespace Express {interface User {id:string}}}
const production=process.env.NODE_ENV==='production';
const origin=process.env.FRONTEND_ORIGIN||'http://localhost:3000';const secret=process.env.SESSION_SECRET;
if(!secret||secret.length<32)throw new Error('Set SESSION_SECRET to at least 32 random characters.');
const origins=[origin,process.env.ADMIN_ORIGIN].filter((value):value is string=>!!value);
for(const value of origins){const url=new URL(value);if(url.origin!==value||(production&&url.protocol!=='https:'))throw new Error('FRONTEND_ORIGIN and ADMIN_ORIGIN must be exact origins using HTTPS in production.');}
// A hosted deploy (Railway sets RAILWAY_ENVIRONMENT) without NODE_ENV=production would send session cookies without the Secure flag and accept http origins.
if(process.env.RAILWAY_ENVIRONMENT&&!production)throw new Error('Set NODE_ENV=production on the API service.');
if(production&&process.env.TRUST_PROXY_HOPS===undefined)throw new Error('Set TRUST_PROXY_HOPS in production (2 when the Vercel /backend rewrite sits in front of Railway, 1 when clients call Railway directly). Rate limits depend on it.');
// Proxy hops in front of the API: 1 = Railway only; 2 = Vercel /backend rewrite -> Railway (so rate limits key on the real client IP).
const proxyHops=Number(process.env.TRUST_PROXY_HOPS??1);if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>3)throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 3.');
export const app=express();app.set('trust proxy',proxyHops);app.use(helmet());
// Payment webhooks need the untouched raw body for their signature, so they are mounted before the JSON parser. They are open only while payments are configured.
app.use('/webhooks',whopWebhookRoutes());
app.use(cors({origin:origins,credentials:true}));app.use(express.json({limit:'128kb'}));app.use((req,_res,next)=>{req.body??={};next();});app.use(rateLimit({windowMs:60000,limit:180,message:{error:"Too many requests. Please try again shortly."},standardHeaders:true,legacyHeaders:false}));
const cookie={httpOnly:true,secure:production,sameSite:'lax' as const,maxAge:7*86400000,path:'/'};
app.use(session({name:'ledger.sid',secret,resave:false,saveUninitialized:false,cookie,store:new (connectPg(session))({pool,tableName:'session',createTableIfMissing:false})}));app.use(passport.initialize());app.use(passport.session());
passport.serializeUser((user,done)=>done(null,user.id));passport.deserializeUser(async(id:string,done)=>{try{const user=await db.user.findUnique({where:{id}});done(null,user||false);}catch(e){done(e);}});
const googleReady=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_CALLBACK_URL);
if(googleReady)passport.use(new GoogleStrategy({clientID:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!,callbackURL:process.env.GOOGLE_CALLBACK_URL!,state:true},async(_access,_refresh,profile,done)=>{try{done(null,await googleAccount(profile));}catch(e){done(e as Error);}}));
app.get('/health',(_req,res)=>res.json({status:'ok',googleConfigured:googleReady,passwordConfigured:true,signupConfigured:otpConfigured(),resetConfigured:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),billing:whopConfigured()?'whop':!production&&process.env.BILLING_STUB_ENABLED==='true'?'development-stub':'not-configured'}));
app.get('/ready',async(_req,res)=>{try{await db.$queryRaw`SELECT 1`;res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable',message:'Database connection is not ready.'});}});
// Maintenance mode: administrators switch it on in Platform Settings. Customers get a 503 with the admin's message; the admin tools,
// health checks and the public status endpoint stay reachable so the site can be switched back on.
let maintenanceCache={at:0,value:{enabled:false,message:'',until:null as string|null}};
async function maintenanceState(){if(Date.now()-maintenanceCache.at<3000)return maintenanceCache.value;try{maintenanceCache={at:Date.now(),value:(await platformSettings()).settings.maintenance};}catch{maintenanceCache={at:Date.now(),value:maintenanceCache.value};}return maintenanceCache.value;}
app.get('/status',async(_req,res)=>{res.set('Cache-Control','no-store');res.json({maintenance:await maintenanceState()});});
const maintenanceOpen=/^\/(health|ready|status|auth\/csrf|auth\/admin|api\/admin|webhooks)(\/|$)/;
app.use(async(req,res,next)=>{const m=await maintenanceState();if(!m.enabled||maintenanceOpen.test(req.path)||req.session?.adminUserId)return next();res.status(503).set('Retry-After','300').json({error:m.message||'Daily Ledger is down for maintenance. Please check back soon.',code:'MAINTENANCE',until:m.until});});
app.get('/auth/google',rateLimit({store:new PgStore('google'),windowMs:60000,limit:20,message:{error:"Too many Google sign-in attempts. Please try again shortly."}}), (req,res,next)=>{if(!googleReady)return res.status(503).json({error:'Google sign-in is not configured. Set the backend OAuth environment variables.'});req.session.returnTo=safeReturnTo(req.query.returnTo);req.session.referralCode=req.query.ref?referralCodeSchema.parse(req.query.ref):undefined;passport.authenticate('google',{scope:['profile','email']})(req,res,next);});
app.get('/auth/google/callback',(req,res,next)=>{if(!googleReady)return res.status(503).json({error:'Google sign-in is not configured.'});const returnTo=safeReturnTo(req.session.returnTo),referralCode=req.session.referralCode;passport.authenticate('google',async(error:Error,user:(Express.User&{email?:string;referralNew?:boolean})|false)=>{if(error||!user)return res.redirect(`${origin}/login?auth=failed&returnTo=${encodeURIComponent(returnTo)}`);try{if(user.referralNew&&user.email)await recordReferral(db,{id:user.id,email:user.email},referralCode);}catch(e){return next(e);}if(user.referralNew&&user.email)void sendWelcomeEmail(user as {id:string;email:string;name:string});req.session.regenerate(err=>{if(err)return next(err);req.logIn(user,e=>{if(e)return next(e);void logActivity(req,{userId:user.id,type:user.referralNew?'auth.signup':'auth.login',meta:{via:'google'}});req.session.csrf=randomBytes(32).toString('hex');req.session.save(saveError=>saveError?next(saveError):res.redirect(origin+returnTo));});});})(req,res,next);});
function identity(req:Request,res:Response,next:NextFunction){if(!req.isAuthenticated())return res.status(401).json({error:'Sign in to access your workspace.'});next();}
async function auth(req:Request,res:Response,next:NextFunction){if(!req.isAuthenticated())return res.status(401).json({error:'Sign in to access your workspace.'});const u=req.user as User;if(u.status!=='active')return res.status(403).json({error:'This account is suspended. Contact support.'});if(!u.lastActiveAt||u.lastActiveAt.getTime()<Date.now()-300000)await db.user.update({where:{id:u.id},data:{lastActiveAt:new Date()}});next();}
function csrf(req:Request,res:Response,next:NextFunction){const supplied=req.get('X-CSRF-Token')||'';const expected=req.session.csrf||'';const requestOrigin=req.get('Origin');if(!requestOrigin||!origins.includes(requestOrigin)||!expected||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(403).json({error:'Invalid request origin or CSRF token. Reload and try again.'});next();}
app.use('/auth',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use('/auth',passwordAuth(csrf));
app.use('/auth/admin',adminAuthentication(csrf));
app.get('/auth/me',identity,(req,res)=>{req.session.csrf ||= randomBytes(32).toString('hex');const u=req.user as User;res.json({user:{name:u.name,email:u.email,status:u.status},csrf:req.session.csrf});});
app.post('/auth/logout',identity,csrf,(req,res,next)=>{void logActivity(req,{userId:(req.user as User).id,type:'auth.logout'});req.logout(e=>{if(e)return next(e);req.session.destroy(err=>{if(err)return next(err);res.clearCookie('ledger.sid',{httpOnly:true,secure:production,sameSite:'lax',path:'/'}).status(204).end();});});});
app.use('/api/support',identity,(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():csrf(req,res,next),supportRoutes());
app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use('/api',auth);app.use('/api',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():csrf(req,res,next));
// Reads that load or scan a whole workspace get their own per-account allowance on top of the global per-IP one.
const heavy=rateLimit({store:new PgStore('heavy'),windowMs:60000,limit:90,message:{error:'Too many requests. Please try again shortly.'},standardHeaders:true,legacyHeaders:false,keyGenerator:req=>'u:'+(req.user?.id??ipKeyGenerator(req.ip||'127.0.0.1')),validate:{keyGeneratorIpFallback:false}});
for(const path of ['/snapshot','/records','/export','/reports','/summary'])app.use('/api'+path,(req,res,next)=>req.method==='GET'?heavy(req,res,next):next());
app.use('/api/admin',adminRoutes());
app.use('/api/ai',aiRoutes());
app.use('/api/push',pushRoutes());
app.use('/api/referrals',referralRoutes());
app.use('/api/billing',billingRoutes());
app.use('/api/import',importRoutes());
app.use('/api/profile/avatar',avatarRoutes());
app.get('/api/snapshot',async(req,res)=>{res.json(await snapshot(req.user as User));});
app.get('/api/records',async(req,res)=>{const page=z.coerce.number().int().min(1).max(10000).default(1).parse(req.query.page);const limit=z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);const kind=req.query.kind?kindSchema.parse(req.query.kind):undefined;const q=z.string().max(160).default('').parse(req.query.q);const where={userId:req.user!.id,...(kind?{kind}:{}),...(typeof req.query.from==='string'?{recordDate:{gte:req.query.from,...(typeof req.query.to==='string'?{lt:req.query.to}:{})}}:{})};
 if(!q){const [rows,total]=await Promise.all([db.record.findMany({where,orderBy:[{recordDate:'desc'},{id:'asc'}],skip:(page-1)*limit,take:limit}),db.record.count({where})]);return res.json({records:rows.map(dto),page,limit,total});}
 // Search runs in the database (case-insensitive match on the stored JSON) so only one page of rows is ever loaded.
 const like='%'+q.toLowerCase().replace(/[\\%_]/g,'\\$&')+'%';
 const matches=await db.$queryRaw<{id:string}[]>`SELECT id FROM "Record" WHERE "userId"=${req.user!.id} AND (${kind??null}::text IS NULL OR kind=${kind??null}) AND (${typeof req.query.from==='string'?req.query.from:null}::text IS NULL OR "recordDate">=${typeof req.query.from==='string'?req.query.from:null}) AND (${typeof req.query.to==='string'&&typeof req.query.from==='string'?req.query.to:null}::text IS NULL OR "recordDate"<${typeof req.query.to==='string'&&typeof req.query.from==='string'?req.query.to:null}) AND lower(data::text) LIKE ${like} ORDER BY "recordDate" DESC,id ASC LIMIT ${limit} OFFSET ${(page-1)*limit}`;
 const [{count}]=await db.$queryRaw<{count:bigint}[]>`SELECT COUNT(*) AS count FROM "Record" WHERE "userId"=${req.user!.id} AND (${kind??null}::text IS NULL OR kind=${kind??null}) AND (${typeof req.query.from==='string'?req.query.from:null}::text IS NULL OR "recordDate">=${typeof req.query.from==='string'?req.query.from:null}) AND (${typeof req.query.to==='string'&&typeof req.query.from==='string'?req.query.to:null}::text IS NULL OR "recordDate"<${typeof req.query.to==='string'&&typeof req.query.from==='string'?req.query.to:null}) AND lower(data::text) LIKE ${like}`;
 const rows=await db.record.findMany({where:{id:{in:matches.map(m=>m.id)},userId:req.user!.id}});const order=new Map(matches.map((m,i)=>[m.id,i]));rows.sort((a,b)=>(order.get(a.id)??0)-(order.get(b.id)??0));
 res.json({records:rows.map(dto),page,limit,total:Number(count)});});
const mutationSchema=z.object({kind:kindSchema,data:z.unknown(),version:z.number().int().positive().optional()});
app.post('/api/records',async(req,res)=>{const input=mutationSchema.parse(req.body);const saved=await saveRecord(req.user!.id,input);void logActivity(req,{userId:req.user!.id,type:'record.created',meta:{kind:input.kind}});res.status(201).json(saved);});
app.post('/api/finance/plans/:id/settle',async(req,res)=>{const {month,date,version}=z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),date:schemas.transaction.shape.date,version:z.number().int().positive()}).parse(req.body);res.json(await settlePlan(req.user!.id,String(req.params.id),month,date,version));});
app.patch('/api/records/:id',async(req,res)=>{const input=mutationSchema.parse(req.body);const id=String(req.params.id);if(input.kind==='notification'){await markNotification(req.user!.id,id,input.version!,schemas.notification.parse(input.data).read);return res.json({ok:true});}const saved=await saveRecord(req.user!.id,{...input,id});void logActivity(req,{userId:req.user!.id,type:'record.updated',meta:{kind:input.kind}});res.json(saved);});
app.delete('/api/records/:id',async(req,res)=>{const {version}=z.object({version:z.number().int().positive()}).parse(req.body);await deleteRecord(req.user!.id,String(req.params.id),version);void logActivity(req,{userId:req.user!.id,type:'record.deleted'});res.status(204).end();});
app.post('/api/onboarding',async(req,res)=>{const data=onboardingSchema.parse(req.body);const user=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.user!.id} FOR UPDATE`;const current=await tx.user.findUniqueOrThrow({where:{id:req.user!.id}});if(current.status!=='active')throw new HttpError(403,'This account is suspended.');if(current.onboardingCompletedAt)return current;await savePreferences(current.id,data,tx);return tx.user.update({where:{id:current.id},data:{persona:data.persona,focusAreas:data.focusAreas,referralSource:data.referralSource||null,onboardingCompletedAt:new Date()}});});if(!(req.user as User).onboardingCompletedAt)void logActivity(req,{userId:req.user!.id,type:'onboarding.completed',meta:{persona:user.persona??null}});res.json({completedAt:user.onboardingCompletedAt,persona:user.persona});});
app.patch('/api/preferences',async(req,res)=>{const data=preferenceSchema.parse(req.body);await savePreferences(req.user!.id,data);res.json({ok:true});});
app.get('/api/summary',async(req,res)=>{const s=await snapshot(req.user as User);const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);res.json(metrics(s.records,month,s.profile.currency,s.profile.timezone));});
app.get('/api/export',async(req,res)=>{const data=await snapshot(req.user as User);void logActivity(req,{userId:req.user!.id,type:'data.exported'});res.json(data);});
app.get('/api/reports/:file',async(req,res)=>{const file=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])\.(csv|pdf)$/).parse(req.params.file);const month=file.slice(0,7);const s=await snapshot(req.user as User);const plan=plans[s.profile.plan];if(!plan.history&&month!==localDate(new Date(),s.profile.timezone).slice(0,7))throw new HttpError(403,'Historical monthly reports require Pro or Lifetime. Your records and full export remain available.','UPGRADE_REQUIRED');if(file.endsWith('.pdf')&&!plan.pdf)throw new HttpError(403,'PDF export requires Pro or Lifetime.','UPGRADE_REQUIRED');res.setHeader('Content-Disposition',`attachment; filename="daily-ledger-${file}"`);if(file.endsWith('.csv'))return res.type('text/csv').send(csv(fullReportRows(s,month)));res.type('application/pdf');renderReportPdf(res,s,month);});
app.post('/api/announcements/:id/dismiss',async(req,res)=>{const {version}=z.object({version:z.number().int().positive()}).parse(req.body);const user=req.user as User;const effective=await policy(user);const a=await db.announcement.findFirst({where:{id:String(req.params.id),version,status:'published',audience:{in:['Everyone',effective.plan]},publishAt:{lte:new Date()},expiresAt:{gt:new Date()}}});if(!a)throw new HttpError(404,'Announcement not found.');await db.announcementDismissal.upsert({where:{userId_announcementId_version:{userId:user.id,announcementId:a.id,version}},create:{userId:user.id,announcementId:a.id,version},update:{}});res.json({ok:true});});
app.post('/api/announcements/:id/read',async(req,res)=>{const id=String(req.params.id);const version=z.number().int().positive().parse(req.body.version);const a=await db.announcement.findUnique({where:{id}});const s=await snapshot(req.user as User);if(!a||a.status!=='published'||a.version!==version||a.publishAt>new Date()||a.expiresAt<=new Date()||(a.audience!=='Everyone'&&a.audience!==s.profile.plan))throw new HttpError(404,'Announcement not available.');await db.announcementRead.upsert({where:{userId_announcementId_version:{userId:req.user!.id,announcementId:id,version}},create:{userId:req.user!.id,announcementId:id,version},update:{}});res.json({ok:true});});
app.use((error:any,_req:Request,res:Response,next:NextFunction)=>{if(res.headersSent){console.error('Error after the response started:',error instanceof Error?error.message:error);return next(error);}if(error instanceof z.ZodError)return res.status(400).json({error:'Validation failed',details:error.issues.slice(0,10).map(i=>({path:i.path.join('.'),message:i.message}))});if(error.code==='P2002')return res.status(409).json({error:'This occurrence or record already exists.'});if(error.code==='P2025')return res.status(404).json({error:'Record not found.'});console.error(error instanceof HttpError?error.message:error);res.status(error.status||500).json({error:error instanceof HttpError?error.message:'The server could not complete this request.',...(error instanceof HttpError&&error.code?{code:error.code}:{})});});
{const w=whopStatus();if(w.state==='incomplete')console.warn(`Whop payments are OFF: WHOP_ENABLED=true but missing/invalid: ${w.missing.join(', ')}`);else console.log(`Whop payments: ${w.state}`);}
const server=app.listen(Number(process.env.PORT||4000),()=>console.log('Daily Ledger API listening'));
// Slow or stalled clients are cut off instead of holding sockets open.
server.requestTimeout=60000;server.headersTimeout=20000;
// Stop taking new connections, let in-flight requests finish, and force the exit if something hangs so a deploy is never stuck.
async function stop(){setTimeout(()=>process.exit(1),10000).unref();server.close();server.closeIdleConnections();await db.$disconnect();await pool.end();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);

