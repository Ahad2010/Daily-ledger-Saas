import 'dotenv/config';
import { demoSnapshot } from '@ledger/shared';
import { db,pool } from './db.js';
import { metadata } from './service.js';
import type { Prisma } from '@prisma/client';
if(process.env.NODE_ENV==='production')throw new Error('Demo seeding is disabled in production.');
const googleId=process.env.DEMO_GOOGLE_ID;if(!googleId)throw new Error('Set DEMO_GOOGLE_ID to a local test identity; never seed automatically.');
try {
 const user=await db.user.findUnique({where:{googleId}});
 if(!user)throw new Error('Sign in first, then supply that local account’s stable Google provider ID.');
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id} FOR UPDATE`;
  for(const r of demoSnapshot().records.filter(r=>r.kind!=='announcement')){
   const data=r.kind==='completion'?{...r.data,habitId:`${user.id}-${r.data.habitId}`} :r.kind==='milestone'?{...r.data,goalId:`${user.id}-${r.data.goalId}`} :r.data;
   const meta=metadata(r.kind,data);
   const uniqueKey=meta.uniqueKey||`seed:${r.id}`;
   await tx.record.upsert({where:{userId_uniqueKey:{userId:user.id,uniqueKey}},create:{id:`${user.id}-${r.id}`,userId:user.id,kind:r.kind,data:data as Prisma.InputJsonValue,...meta,uniqueKey},update:{}});
  }
 });
 console.log('Local demo records inserted idempotently.');
}finally{await db.$disconnect();await pool.end();}
