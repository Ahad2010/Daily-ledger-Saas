import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
test('verified Google signup reuses an existing account and preserves onboarding and restrictions',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
 const {db,pool}=await import('../apps/api/src/db.js'),{googleAccount}=await import('../apps/api/src/google-account.js');
 const email=`google-${randomUUID()}@example.com`,id=randomUUID(),googleId=randomUUID();
 try{
  const completed=new Date();await db.user.create({data:{id,email,name:'Original name',plan:'Pro',status:'suspended',onboardingCompletedAt:completed}});
  await assert.rejects(()=>googleAccount({id:googleId,displayName:'Ignored',emails:[{value:email,verified:false}]}));
  const linked=await googleAccount({id:googleId,displayName:'Ignored',emails:[{value:email.toUpperCase(),verified:true}]});
  assert.equal(linked.id,id);assert.equal(linked.referralNew,false);assert.equal(linked.plan,'Pro');assert.equal(linked.status,'suspended');assert.equal(linked.onboardingCompletedAt?.getTime(),completed.getTime());
  const repeat=await googleAccount({id:googleId,displayName:'Ignored',emails:[{value:email,verified:true}]});assert.equal(repeat.id,id);assert.equal(await db.user.count({where:{email}}),1);
  const fresh=await googleAccount({id:randomUUID(),displayName:'New Google user',emails:[{value:email.replace('google-','new-google-'),verified:true}]});assert.equal(fresh.referralNew,true);assert.equal(fresh.onboardingCompletedAt,null);await db.user.delete({where:{id:fresh.id}});
 }finally{await db.user.deleteMany({where:{id}});await db.$disconnect();await pool.end();}
});
