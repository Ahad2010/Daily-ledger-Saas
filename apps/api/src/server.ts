import {googleAccount} from './google-account.js';
import {referralRoutes,recordReferral,referralCodeSchema} from './referrals.js';
import {billingRoutes} from './billing.js';
import {pushRoutes} from './push.js';
import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { kindSchema, preferenceSchema, onboardingSchema, schemas, reportRows, csv, metrics, plans, safeReturnTo, localDate } from '@ledger/shared';
import { db,pool } from './db.js';
import { snapshot,saveRecord,deleteRecord,markNotification,settlePlan,HttpError,dto } from './service.js';
import {otpConfigured} from './auth-otp.js';
import { passwordAuth } from './password-auth.js';
import {adminAuthentication,adminRoutes} from './admin.js';
import {supportRoutes} from './support.js';
import {aiRoutes} from './ai.js';
import {policy} from './platform.js';
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
// Proxy hops in front of the API: 1 = Railway only; 2 = Vercel /backend rewrite -> Railway (so rate limits key on the real client IP).
const proxyHops=Number(process.env.TRUST_PROXY_HOPS??1);if(!Number.isInteger(proxyHops)||proxyHops<0||proxyHops>3)throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 3.');
export const app=express();app.set('trust proxy',proxyHops);app.use(helmet());app.use(cors({origin:origins,credentials:true}));app.use(express.json({limit:'128kb'}));app.use((req,_res,next)=>{req.body??={};next();});app.use(rateLimit({windowMs:60000,limit:180,message:{error:"Too many requests. Please try again shortly."},standardHeaders:true,legacyHeaders:false}));
const cookie={httpOnly:true,secure:production,sameSite:'lax' as const,maxAge:7*86400000,path:'/'};
app.use(session({name:'ledger.sid',secret,resave:false,saveUninitialized:false,cookie,store:new (connectPg(session))({pool,tableName:'session',createTableIfMissing:false})}));app.use(passport.initialize());app.use(passport.session());
passport.serializeUser((user,done)=>done(null,user.id));passport.deserializeUser(async(id:string,done)=>{try{const user=await db.user.findUnique({where:{id}});done(null,user||false);}catch(e){done(e);}});
const googleReady=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&process.env.GOOGLE_CALLBACK_URL);
if(googleReady)passport.use(new GoogleStrategy({clientID:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!,callbackURL:process.env.GOOGLE_CALLBACK_URL!,state:true},async(_access,_refresh,profile,done)=>{try{done(null,await googleAccount(profile));}catch(e){done(e as Error);}}));
app.get('/health',(_req,res)=>res.json({status:'ok',googleConfigured:googleReady,passwordConfigured:true,signupConfigured:otpConfigured(),resetConfigured:!!(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),billing:!production&&process.env.BILLING_STUB_ENABLED==='true'?'development-stub':'not-configured'}));
app.get('/ready',async(_req,res)=>{try{await db.$queryRaw`SELECT 1`;res.json({status:'ready'});}catch{res.status(503).json({status:'unavailable',message:'Database connection is not ready.'});}});
app.get('/auth/google',rateLimit({windowMs:60000,limit:20,message:{error:"Too many Google sign-in attempts. Please try again shortly."}}), (req,res,next)=>{if(!googleReady)return res.status(503).json({error:'Google sign-in is not configured. Set the backend OAuth environment variables.'});req.session.returnTo=safeReturnTo(req.query.returnTo);req.session.referralCode=req.query.ref?referralCodeSchema.parse(req.query.ref):undefined;passport.authenticate('google',{scope:['profile','email']})(req,res,next);});
app.get('/auth/google/callback',(req,res,next)=>{if(!googleReady)return res.status(503).json({error:'Google sign-in is not configured.'});const returnTo=safeReturnTo(req.session.returnTo),referralCode=req.session.referralCode;passport.authenticate('google',async(error:Error,user:(Express.User&{email?:string;referralNew?:boolean})|false)=>{if(error||!user)return res.redirect(`${origin}/login?auth=failed&returnTo=${encodeURIComponent(returnTo)}`);try{if(user.referralNew&&user.email)await recordReferral(db,{id:user.id,email:user.email},referralCode);}catch(e){return next(e);}req.session.regenerate(err=>{if(err)return next(err);req.logIn(user,e=>{if(e)return next(e);req.session.csrf=randomBytes(32).toString('hex');req.session.save(saveError=>saveError?next(saveError):res.redirect(origin+returnTo));});});})(req,res,next);});
function identity(req:Request,res:Response,next:NextFunction){if(!req.isAuthenticated())return res.status(401).json({error:'Sign in to access your workspace.'});next();}
async function auth(req:Request,res:Response,next:NextFunction){if(!req.isAuthenticated())return res.status(401).json({error:'Sign in to access your workspace.'});const u=req.user as User;if(u.status!=='active')return res.status(403).json({error:'This account is suspended. Contact support.'});if(!u.lastActiveAt||u.lastActiveAt.getTime()<Date.now()-300000)await db.user.update({where:{id:u.id},data:{lastActiveAt:new Date()}});next();}
function csrf(req:Request,res:Response,next:NextFunction){const supplied=req.get('X-CSRF-Token')||'';const expected=req.session.csrf||'';const requestOrigin=req.get('Origin');if(!requestOrigin||!origins.includes(requestOrigin)||!expected||Buffer.byteLength(supplied)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return res.status(403).json({error:'Invalid request origin or CSRF token. Reload and try again.'});next();}
app.use('/auth',passwordAuth(csrf));
app.use('/auth/admin',adminAuthentication(csrf));
app.get('/auth/me',identity,(req,res)=>{req.session.csrf ||= randomBytes(32).toString('hex');const u=req.user as User;res.json({user:{name:u.name,email:u.email,status:u.status},csrf:req.session.csrf});});
app.post('/auth/logout',identity,csrf,(req,res,next)=>req.logout(e=>{if(e)return next(e);req.session.destroy(err=>{if(err)return next(err);res.clearCookie('ledger.sid',{httpOnly:true,secure:production,sameSite:'lax',path:'/'}).status(204).end();});}));
app.use('/api/support',identity,(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():csrf(req,res,next),supportRoutes());
app.use('/api',auth);app.use('/api',(req,res,next)=>['GET','HEAD','OPTIONS'].includes(req.method)?next():csrf(req,res,next));
app.use('/api/admin',adminRoutes());
app.use('/api/ai',aiRoutes());
app.use('/api/push',pushRoutes());
app.use('/api/referrals',referralRoutes());
app.use('/api/billing',billingRoutes());
app.get('/api/snapshot',async(req,res)=>{res.json(await snapshot(req.user as User));});
app.get('/api/records',async(req,res)=>{const page=z.coerce.number().int().min(1).default(1).parse(req.query.page);const limit=z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);const kind=req.query.kind?kindSchema.parse(req.query.kind):undefined;const q=z.string().max(160).default('').parse(req.query.q);const where={userId:req.user!.id,...(kind?{kind}:{}),...(typeof req.query.from==='string'?{recordDate:{gte:req.query.from,...(typeof req.query.to==='string'?{lt:req.query.to}:{})}}:{})};const rows=await db.record.findMany({where,orderBy:{recordDate:'desc'}});const filtered=q?rows.filter(r=>JSON.stringify(r.data).toLowerCase().includes(q.toLowerCase())):rows;res.json({records:filtered.slice((page-1)*limit,page*limit).map(dto),page,limit,total:filtered.length});});
const mutationSchema=z.object({kind:kindSchema,data:z.unknown(),version:z.number().int().positive().optional()});
app.post('/api/records',async(req,res)=>res.status(201).json(await saveRecord(req.user!.id,mutationSchema.parse(req.body))));
app.post('/api/finance/plans/:id/settle',async(req,res)=>{const {month,date,version}=z.object({month:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),date:schemas.transaction.shape.date,version:z.number().int().positive()}).parse(req.body);res.json(await settlePlan(req.user!.id,String(req.params.id),month,date,version));});
app.patch('/api/records/:id',async(req,res)=>{const input=mutationSchema.parse(req.body);const id=String(req.params.id);if(input.kind==='notification'){await markNotification(req.user!.id,id,input.version!,schemas.notification.parse(input.data).read);return res.json({ok:true});}res.json(await saveRecord(req.user!.id,{...input,id}));});
app.delete('/api/records/:id',async(req,res)=>{const {version}=z.object({version:z.number().int().positive()}).parse(req.body);await deleteRecord(req.user!.id,String(req.params.id),version);res.status(204).end();});
app.post('/api/onboarding',async(req,res)=>{const data=onboardingSchema.parse(req.body);const user=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id=${req.user!.id} FOR UPDATE`;const current=await tx.user.findUniqueOrThrow({where:{id:req.user!.id}});if(current.status!=='active')throw new HttpError(403,'This account is suspended.');if(current.onboardingCompletedAt)return current;await savePreferences(current.id,data,tx);return tx.user.update({where:{id:current.id},data:{persona:data.persona,focusAreas:data.focusAreas,referralSource:data.referralSource||null,onboardingCompletedAt:new Date()}});});res.json({completedAt:user.onboardingCompletedAt,persona:user.persona});});
app.patch('/api/preferences',async(req,res)=>{const data=preferenceSchema.parse(req.body);await savePreferences(req.user!.id,data);res.json({ok:true});});
app.get('/api/summary',async(req,res)=>{const s=await snapshot(req.user as User);const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).parse(req.query.month);res.json(metrics(s.records,month,s.profile.currency,s.profile.timezone));});
app.get('/api/export',async(req,res)=>res.json(await snapshot(req.user as User)));
app.get('/api/reports/:file',async(req,res)=>{const file=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])\.(csv|pdf)$/).parse(req.params.file);const month=file.slice(0,7);const s=await snapshot(req.user as User);const plan=plans[s.profile.plan];if(!plan.history&&month!==localDate(new Date(),s.profile.timezone).slice(0,7))throw new HttpError(403,'Historical monthly reports require Pro or Lifetime. Your records and full export remain available.','UPGRADE_REQUIRED');if(file.endsWith('.pdf')&&!plan.pdf)throw new HttpError(403,'PDF export requires Pro or Lifetime.','UPGRADE_REQUIRED');const rows=reportRows(s,month);res.setHeader('Content-Disposition',`attachment; filename="daily-ledger-${file}"`);if(file.endsWith('.csv'))return res.type('text/csv').send(csv(rows));res.type('application/pdf');const pdf=new PDFDocument({size:'A4',margin:50});pdf.pipe(res);pdf.fontSize(24).text('Daily Ledger');pdf.fontSize(14).text(`Monthly report · ${month}`).moveDown();rows.slice(1).forEach(([label,value])=>pdf.fontSize(11).text(`${label}: ${value}`).moveDown(.4));pdf.end();});
app.post('/api/announcements/:id/dismiss',async(req,res)=>{const {version}=z.object({version:z.number().int().positive()}).parse(req.body);const user=req.user as User;const effective=await policy(user);const a=await db.announcement.findFirst({where:{id:String(req.params.id),version,status:'published',audience:{in:['Everyone',effective.plan]},publishAt:{lte:new Date()},expiresAt:{gt:new Date()}}});if(!a)throw new HttpError(404,'Announcement not found.');await db.announcementDismissal.upsert({where:{userId_announcementId_version:{userId:user.id,announcementId:a.id,version}},create:{userId:user.id,announcementId:a.id,version},update:{}});res.json({ok:true});});
app.post('/api/announcements/:id/read',async(req,res)=>{const id=String(req.params.id);const version=z.number().int().positive().parse(req.body.version);const a=await db.announcement.findUnique({where:{id}});const s=await snapshot(req.user as User);if(!a||a.status!=='published'||a.version!==version||a.publishAt>new Date()||a.expiresAt<=new Date()||(a.audience!=='Everyone'&&a.audience!==s.profile.plan))throw new HttpError(404,'Announcement not available.');await db.announcementRead.upsert({where:{userId_announcementId_version:{userId:req.user!.id,announcementId:id,version}},create:{userId:req.user!.id,announcementId:id,version},update:{}});res.json({ok:true});});
app.post('/api/billing/checkout',(req,res)=>{z.enum(['Pro','Lifetime']).parse(req.body.plan);if(production||process.env.BILLING_STUB_ENABLED!=='true')return res.status(503).json({error:'Payments are not configured. No charge or plan activation occurred.'});res.json({mode:'development-stub',message:'Development stub only. No payment was collected and no entitlement was activated.'});});
app.use((error:any,_req:Request,res:Response,_next:NextFunction)=>{if(error instanceof z.ZodError)return res.status(400).json({error:'Validation failed',details:error.issues});if(error.code==='P2002')return res.status(409).json({error:'This occurrence or record already exists.'});if(error.code==='P2025')return res.status(404).json({error:'Record not found.'});console.error(error instanceof HttpError?error.message:error);res.status(error.status||500).json({error:error instanceof HttpError?error.message:'The server could not complete this request.',...(error instanceof HttpError&&error.code?{code:error.code}:{})});});
const server=app.listen(Number(process.env.PORT||4000),()=>console.log('Daily Ledger API listening'));
async function stop(){server.close();await db.$disconnect();await pool.end();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);

