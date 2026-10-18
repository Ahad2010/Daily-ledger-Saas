import {logActivity} from './activity.js';
import {Router} from 'express';
import {z} from 'zod';
import type {User} from '@prisma/client';
import {TRIAL_DAYS} from '@ledger/shared';
import {db} from './db.js';
import {policy,internalTrialEnabled} from './platform.js';
import {HttpError} from './service.js';
import {whopConfigured,createCheckout,cancelMembership,activeMembership} from './whop.js';

// The same mailbox written differently (name+tag@, n.a.m.e@gmail.com) must not earn a second trial.
export function trialKey(email:string){
 const [rawLocal='',rawDomain='']=email.trim().toLowerCase().split('@');
 const domain=rawDomain==='googlemail.com'?'gmail.com':rawDomain;
 let local=rawLocal.split('+')[0];
 if(domain==='gmail.com')local=local.replace(/\./g,'');
 return `${local}@${domain}`;
}

// One no-card Pro trial per account. It is an expiring entitlement override, so access ends by itself
// and every downgrade rule (records kept, new above-limit actions restricted) applies unchanged.
export async function startTrial(userId:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
  if(user.status!=='active')throw new HttpError(403,'This account is suspended.');
  if(!internalTrialEnabled())throw new HttpError(403,'The free trial is not offered right now.');
  if(user.trialStartedAt)throw new HttpError(409,'Your free trial has already been used.');
  const effective=await policy(user,tx);
  if(effective.plan!=='Free'||user.entitlementSource==='provider')throw new HttpError(409,'The free trial is available on the Free plan only.');
  if(effective.override&&effective.override.grantedBy!=='trial')throw new HttpError(409,'The free trial is not available on this account. Contact support.');
  const key=trialKey(user.email);
  if(await tx.user.findFirst({where:{trialKey:key,id:{not:userId}},select:{id:true}}))throw new HttpError(409,'A free trial has already been used with this email address.');
  const now=new Date(),endsAt=new Date(now.getTime()+TRIAL_DAYS*86400000);
  const data={plan:'Pro',reason:`${TRIAL_DAYS}-day Pro trial`,expiresAt:endsAt,grantedBy:'trial'};
  await tx.entitlementOverride.upsert({where:{userId},create:{userId,...data},update:data});
  await tx.user.update({where:{id:userId},data:{trialStartedAt:now,trialKey:key}});
  return {endsAt:endsAt.toISOString()};
 });
}

// Cancelling returns the account to Free straight away and records the date, so a later provider webhook must not renew
// a cancelled subscription; only a new purchase can. Data is kept and the normal downgrade rules apply.
export async function cancelSubscription(userId:string){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
  const effective=await policy(user,tx);
  if(effective.plan==='Free')throw new HttpError(409,'You are already on the Free plan.');
  if(effective.plan==='Lifetime'||user.plan==='Lifetime')throw new HttpError(409,'Lifetime is a one-time purchase with nothing to cancel. Contact support for a refund request.');
  if(effective.override&&effective.override.grantedBy!=='trial')throw new HttpError(409,'This plan was granted by Daily Ledger support. Contact support to change it.');
  // A paid Whop subscription is cancelled at the provider and runs to the end of the paid period; Whop's membership.deactivated then ends access.
  if(whopConfigured()&&user.entitlementSource==='provider'){
   const membership=await activeMembership(userId,tx);
   if(!membership)throw new HttpError(409,'No active subscription was found. Contact support.');
   if(user.subscriptionCancelledAt)throw new HttpError(409,'Your subscription is already set to end.');
   await cancelMembership(membership);
   const at=new Date();
   await tx.user.update({where:{id:userId},data:{subscriptionCancelledAt:at}});
   return {plan:'Pro' as const,cancelledAt:at.toISOString(),endsAtPeriodEnd:true};
  }
  if(effective.override)await tx.entitlementOverride.delete({where:{userId}});
  const cancelledAt=new Date();
  await tx.user.update({where:{id:userId},data:{plan:'Free',entitlementSource:'free',subscriptionCancelledAt:cancelledAt}});
  return {plan:'Free' as const,cancelledAt:cancelledAt.toISOString(),endsAtPeriodEnd:false};
 },{timeout:25000});
}

const production=process.env.NODE_ENV==='production';
export function billingRoutes(){
 const router=Router();
 router.post('/trial',async(req,res)=>{const started=await startTrial(req.user!.id);void logActivity(req,{userId:req.user!.id,type:'trial.started'});res.status(201).json(started);});
 router.post('/checkout',async(req,res)=>{const plan=z.enum(['Pro','Lifetime']).parse(req.body.plan);const user=req.user as User,effective=await policy(user);if(user.status!=='active')throw new HttpError(403,'This account is suspended.');if(whopConfigured()&&effective.plan==='Lifetime')throw new HttpError(409,'You already have Lifetime.');if(whopConfigured()&&plan==='Pro'&&user.entitlementSource==='provider'&&user.plan==='Pro'&&!user.subscriptionCancelledAt)throw new HttpError(409,'You already have an active Pro subscription.');if(!whopConfigured()){if(production||process.env.BILLING_STUB_ENABLED!=='true')return res.status(503).json({error:'Payments are not configured. No charge or plan activation occurred.'});return res.json({mode:'development-stub',message:'Development stub only. No payment was collected and no entitlement was activated.'});}void logActivity(req,{userId:user.id,type:'billing.checkout_started',meta:{plan}});res.json({mode:'whop',...await createCheckout(user,plan)});});
 router.post('/cancel',async(req,res)=>{const result=await cancelSubscription(req.user!.id);void logActivity(req,{userId:req.user!.id,type:'billing.cancelled'});res.json(result);});
 // Only provider-verified payments appear here; nothing is invented while no payment provider is connected.
 router.get('/',async(req,res)=>{
  const user=req.user as User,effective=await policy(user);
  const rows=await db.billingRecord.findMany({where:{userId:user.id,verified:true},orderBy:{createdAt:'desc'},take:100});
  res.json({
   plan:effective.plan,source:effective.source,
   trial:{available:internalTrialEnabled()&&effective.plan==='Free'&&!user.trialStartedAt&&user.entitlementSource!=='provider',used:!!user.trialStartedAt,endsAt:effective.override?.grantedBy==='trial'?effective.override.expiresAt.toISOString():null},
   accessUntil:effective.override?.grantedBy==='trial'?null:effective.override?.expiresAt.toISOString()||null,
   cancelledAt:user.subscriptionCancelledAt?.toISOString()||null,
   canCancel:effective.plan==='Pro'&&(!effective.override||effective.override.grantedBy==='trial')&&!(whopConfigured()&&user.entitlementSource==='provider'&&user.subscriptionCancelledAt),
   endsAtPeriodEnd:effective.plan==='Pro'&&user.entitlementSource==='provider'&&!!user.subscriptionCancelledAt,
   paymentsConfigured:whopConfigured(),
   payments:rows.map(r=>({id:r.id,provider:r.provider,reference:r.reference,kind:r.kind,description:r.description,currency:r.currency,amount:Number(r.amount),status:r.status,receiptUrl:r.receiptUrl,createdAt:r.createdAt.toISOString()}))
  });
 });
 return router;
}
