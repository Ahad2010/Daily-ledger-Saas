import type {Prisma} from '@prisma/client';
import {preferenceSchema} from '@ledger/shared';
import {db} from './db.js';
// Both preferences and first-login setup write the same profile fields.
// A new display currency re-labels the member's amounts (no conversion) so nothing disappears from their totals.
export async function savePreferences(userId:string,input:unknown,client:Prisma.TransactionClient|typeof db=db){
 const data=preferenceSchema.partial().parse(input);
 const run=async(tx:Prisma.TransactionClient)=>{
  if(data.currency){
   const user=await tx.user.findUnique({where:{id:userId},select:{currency:true}});
   if(user&&user.currency!==data.currency){
    await tx.$executeRaw`UPDATE "Record" SET data=jsonb_set(data,'{currency}',to_jsonb(${data.currency}::text)), version=version+1, "updatedAt"=now() WHERE "userId"=${userId} AND kind IN ('transaction','budget','cashPlan','recurring','grocery')`;
    await tx.$executeRaw`UPDATE "Record" SET data=jsonb_set(data,'{unit}',to_jsonb(${data.currency}::text)), version=version+1, "updatedAt"=now() WHERE "userId"=${userId} AND kind='goal' AND data->>'unit'=${user.currency}`;
   }
  }
  return tx.user.update({where:{id:userId},data});
 };
 return 'user' in client&&'$transaction' in client?(client as typeof db).$transaction(run):run(client as Prisma.TransactionClient);
}
