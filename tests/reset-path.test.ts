import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
import {passwordUser,postFrom} from './support/login';
const skip=!process.env.TEST_DATABASE_URL;
const strong='Correct-horse-battery-9!';

test('an attacker cannot use up the owner\'s password-reset requests from other networks',{skip,timeout:180000},async()=>{
 const api=await startApi(4101);
 try{
  const email=`reset-owner-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  for(let i=0;i<25;i++){const r=await postFrom(api.base,'/auth/forgot-password',{email},'203.0.113.200');await r.text();}
  const owner=await postFrom(api.base,'/auth/forgot-password',{email},'198.51.100.31');
  assert.equal(owner.status,200,'the owner, from their own network, can still ask for a reset');
 }finally{await api.stop();}
});

test('asking for a new reset link does not cancel the one the owner already has',{skip,timeout:120000},async()=>{
 const api=await startApi(4102);
 try{
  process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;process.env.SESSION_SECRET||='feature-session-secret-at-least-32-characters';process.env.FRONTEND_ORIGIN||='http://localhost:3000';
  const {sendResetLink}=await import('../apps/api/src/reset-link');
  const email=`reset-links-${Date.now()}@example.com`,user=await passwordUser(api,email,strong);
  await sendResetLink(email);
  await api.pool.query(`UPDATE "PasswordReset" SET "createdAt"=NOW()-INTERVAL '2 minutes' WHERE "userId"=$1`,[user.id]);
  await sendResetLink(email);
  const rows=(await api.pool.query(`SELECT "usedAt" FROM "PasswordReset" WHERE "userId"=$1`,[user.id])).rows as {usedAt:Date|null}[];
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.usedAt===null),'both links stay valid until one is used');
 }finally{await api.stop();}
});
