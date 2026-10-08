import {Router} from 'express';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import type {Prisma,User} from '@prisma/client';
import {db} from './db.js';
import {policy} from './platform.js';
import {HttpError} from './service.js';

export const referralCodeSchema=z.string().trim().toLowerCase().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export async function recordReferral(client:Prisma.TransactionClient|typeof db,user:{id:string;email:string},code:string|null|undefined){
 if(!code)return;
 const referrer=await client.user.findUnique({where:{referralCode:code}});
 if(!referrer||referrer.status!=='active'||referrer.id===user.id||referrer.email.toLowerCase()===user.email.toLowerCase())return;
 if(await client.user.findFirst({where:{email:{equals:user.email,mode:'insensitive'},id:{not:user.id}}}))return;
 await client.referral.upsert({where:{inviteeId:user.id},create:{referrerId:referrer.id,inviteeId:user.id},update:{}});
}

async function summary(user:User,rankingPage=false){
 const owner=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
  const current=await tx.user.findUniqueOrThrow({where:{id:user.id}});
  if(current.status!=='active')throw new HttpError(403,'This account is suspended.');
  if(current.referralCode)return current;
  const name=current.name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24).replace(/-$/,'')||'member';
  return tx.user.update({where:{id:user.id},data:{referralCode:`${name}-${randomBytes(6).toString('hex')}`}});
 });
 const total=await db.referral.count({where:{referrerId:owner.id,invitee:{status:'active'}}});
 const paid=(await policy(owner)).plan!=='Free',rankingActive=paid&&total>0;
 if(rankingPage&&!rankingActive)throw new HttpError(403,paid?'Your ranking opens after your first verified referral.':'Referral ranking requires Pro or Lifetime.',paid?undefined:'UPGRADE_REQUIRED');
 let leaders:{name:string;total:number;rank:number;you:boolean}[]=[];
 if(rankingActive){
  const rows=await db.$queryRaw<{id:string;name:string;total:bigint;rank:bigint}[]>`
   WITH counts AS (
    SELECT u.id,u.name,u."createdAt",COUNT(r.id) AS total
    FROM "User" u JOIN "Referral" r ON r."referrerId"=u.id
    JOIN "User" invited ON invited.id=r."inviteeId" AND invited.status='active'
    LEFT JOIN "EntitlementOverride" o ON o."userId"=u.id
    WHERE u.status='active' AND (CASE WHEN o."expiresAt">(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN o.plan ELSE u.plan END) IN ('Pro','Lifetime')
    GROUP BY u.id
   ), ranked AS (
    SELECT id,name,total,ROW_NUMBER() OVER (ORDER BY total DESC,"createdAt" ASC,id ASC) AS rank FROM counts
   ) SELECT * FROM ranked WHERE rank<=50 OR id=${owner.id} ORDER BY rank`;
  leaders=rows.map(row=>({name:row.name,total:Number(row.total),rank:Number(row.rank),you:row.id===owner.id}));
 }
 return {code:owner.referralCode,link:`${process.env.FRONTEND_ORIGIN||'http://localhost:3000'}/signup?ref=${encodeURIComponent(owner.referralCode!)}`,total,paid,rankingActive,rank:leaders.find(row=>row.you)?.rank??null,leaders};
}
export function referralRoutes(){const router=Router();router.get('/',async(req,res)=>res.json(await summary(req.user as User)));router.get('/ranking',async(req,res)=>res.json(await summary(req.user as User,true)));return router;}
