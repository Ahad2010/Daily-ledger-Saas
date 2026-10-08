import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
test('billing details list only the owner\'s provider-verified payments',{skip,timeout:90000},async()=>{
 const api=await startApi(4049);
 try{
  const a=await api.user({plan:'Lifetime'}),b=await api.user({plan:'Free'});
  const insert=(userId:string,reference:string,verified:boolean,amount:number,receipt:string|null)=>api.pool.query('INSERT INTO "BillingRecord" (id,"userId",provider,reference,kind,currency,amount,status,verified,"receiptUrl",description) VALUES ($1,$2,\'whop\',$3,\'lifetime\',\'USD\',$4,\'paid\',$5,$6,\'Lifetime membership\')',[randomUUID(),userId,reference,amount,verified,receipt]);
  await insert(a.id,'pay_a_verified',true,10000,'https://example.com/receipt/1');await insert(a.id,'pay_a_unverified',false,10000,null);await insert(b.id,'pay_b_verified',true,2000,null);
  const mine=await a.json('/api/billing');assert.equal(mine.payments.length,1);assert.equal(mine.payments[0].amount,10000);assert.equal(mine.payments[0].receiptUrl,'https://example.com/receipt/1');assert.equal(mine.paymentsConfigured,false);
  assert.equal((await b.json('/api/billing')).payments.length,1);assert.notEqual((await b.json('/api/billing')).payments[0].reference,mine.payments[0].reference);
  await api.pool.query('DELETE FROM "BillingRecord" WHERE "userId"=ANY($1)',[[a.id,b.id]]);
 }finally{await api.stop();}
});
