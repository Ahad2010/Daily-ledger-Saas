import {Router} from 'express';
import type {User} from '@prisma/client';
import {TRIAL_DAYS} from '@ledger/shared';
import {db} from './db.js';
import {policy,internalTrialEnabled} from './platform.js';
import {HttpError} from './service.js';

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
  const now=new Date(),endsAt=new Date(now.getTime()+TRIAL_DAYS*86400000);
  const data={plan:'Pro',reason:`${TRIAL_DAYS}-day Pro trial`,expiresAt:endsAt,grantedBy:'trial'};
  await tx.entitlementOverride.upsert({where:{userId},create:{userId,...data},update:data});
  await tx.user.update({where:{id:userId},data:{trialStartedAt:now}});
  return {endsAt:endsAt.toISOString()};
 });
}

export function billingRoutes(){
 const router=Router();
 router.post('/trial',async(req,res)=>res.status(201).json(await startTrial(req.user!.id)));
 // Only provider-verified payments appear here; nothing is invented while no payment provider is connected.
 router.get('/',async(req,res)=>{
  const user=req.user as User,effective=await policy(user);
  const rows=await db.billingRecord.findMany({where:{userId:user.id,verified:true},orderBy:{createdAt:'desc'},take:100});
  res.json({
   plan:effective.plan,source:effective.source,
   trial:{available:internalTrialEnabled()&&effective.plan==='Free'&&!user.trialStartedAt&&user.entitlementSource!=='provider',used:!!user.trialStartedAt,endsAt:effective.override?.grantedBy==='trial'?effective.override.expiresAt.toISOString():null},
   accessUntil:effective.override?.grantedBy==='trial'?null:effective.override?.expiresAt.toISOString()||null,
   paymentsConfigured:false,
   payments:rows.map(r=>({id:r.id,provider:r.provider,reference:r.reference,kind:r.kind,description:r.description,currency:r.currency,amount:Number(r.amount),status:r.status,receiptUrl:r.receiptUrl,createdAt:r.createdAt.toISOString()}))
  });
 });
 return router;
}
