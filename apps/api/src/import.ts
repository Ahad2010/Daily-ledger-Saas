import {Router} from 'express';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {schemas,quotaAllowed,importKey,type LedgerRecord} from '@ledger/shared';
import {db} from './db.js';
import {policy} from './platform.js';
import {HttpError,dto,metadata,applyBudgetAlerts} from './service.js';

const bodySchema=z.object({rows:z.array(z.object({data:z.unknown(),occurrence:z.number().int().min(0).max(9999)})).min(1).max(250)});

// Bulk transaction import: one transaction under the owner row lock, plan allowance enforced cumulatively,
// duplicates (same file imported again) skipped through the unique key, partial success reported honestly.
export async function importTransactions(userId:string,input:z.infer<typeof bodySchema>){
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const user=await tx.user.findUniqueOrThrow({where:{id:userId}});if(user.status!=='active')throw new HttpError(403,'This account is suspended.');
  const effective=await policy(user,tx);
  const rows=await tx.record.findMany({where:{userId},select:{id:true,kind:true,data:true,version:true,uniqueKey:true}});
  const keys=new Set(rows.map(r=>r.uniqueKey).filter((k):k is string=>!!k&&k.startsWith('import:')));
  const records:LedgerRecord[]=rows.filter(r=>r.kind==='transaction').map(r=>dto(r as never));
  const rejected:{index:number;message:string}[]=[];const created:Prisma.RecordCreateManyInput[]=[];let duplicates=0,limited=0;const touched=new Map<string,{month:string;currency:string}>();
  input.rows.forEach((row,index)=>{
   const parsed=schemas.transaction.safeParse(row.data);
   if(!parsed.success){rejected.push({index,message:parsed.error.issues[0]?.message||'This row is not valid.'});return;}
   const data=parsed.data;if(data.sourceId||data.sourceMonth){rejected.push({index,message:'Linked plan transactions cannot be imported.'});return;}
   const uniqueKey=importKey(data,row.occurrence);
   if(keys.has(uniqueKey)){duplicates++;return;}
   if(!quotaAllowed(effective.plan,'transaction',data,records,user.timezone,effective.limits)){limited++;return;}
   keys.add(uniqueKey);records.push({id:'pending-'+index,kind:'transaction',data,version:1} as LedgerRecord);
   created.push({userId,kind:'transaction',data:data as Prisma.InputJsonValue,...metadata('transaction',data),uniqueKey});
   if(data.type==='expense')touched.set(data.date.slice(0,7)+data.currency,{month:data.date.slice(0,7),currency:data.currency});
  });
  if(created.length)await tx.record.createMany({data:created});
  if(touched.size)await applyBudgetAlerts(tx,user,[...touched.values()]);
  return {imported:created.length,duplicates,limited,rejected:rejected.slice(0,50),rejectedCount:rejected.length};
 },{maxWait:30000,timeout:60000});
}

export function importRoutes(){
 const router=Router();
 router.post('/transactions',async(req,res)=>res.json(await importTransactions(req.user!.id,bodySchema.parse(req.body))));
 return router;
}
