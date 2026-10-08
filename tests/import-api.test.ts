import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'UTC'}).format(new Date());
const row=(title:string,amount:number,type='expense',occurrence=0,category='Food')=>({occurrence,data:{title,date:today(),amount,currency:'USD',type,category,account:'Bank',notes:''}});

test('CSV import API: idempotent, plan-limited, ownership-safe, edit-stable and budget-aware',{skip,timeout:180000},async()=>{
 const api=await startApi(4047);
 try{
  const u=await api.user({plan:'Free'}),other=await api.user({plan:'Free'}),month=today().slice(0,7);
  const first=await u.json('/api/import/transactions','POST',{rows:[row('Coffee',450),row('Coffee',450,'expense',1),row('Salary',300000,'income')]});
  assert.deepEqual([first.imported,first.duplicates,first.limited,first.rejectedCount],[3,0,0,0]);
  const again=await u.json('/api/import/transactions','POST',{rows:[row('Coffee',450),row('Coffee',450,'expense',1),row('Salary',300000,'income')]});assert.deepEqual([again.imported,again.duplicates],[0,3],'the same file twice does not duplicate');
  assert.equal((await other.json('/api/snapshot')).records.length,0,'another account sees nothing');
  // An edited imported row keeps its import key, so re-importing the original line is still a duplicate.
  const snapshot=await u.json('/api/snapshot');const salary=snapshot.records.find((r:any)=>r.kind==='transaction'&&r.data.title==='Salary');
  assert.equal((await u.request('/api/records/'+salary.id,'PATCH',{kind:'transaction',version:salary.version,data:{...salary.data,amount:310000}})).status,200);
  assert.equal((await u.json('/api/import/transactions','POST',{rows:[row('Salary',300000,'income')]})).duplicates,1);
  // Validation: bad rows are reported, not silently dropped.
  const mixed=await u.json('/api/import/transactions','POST',{rows:[{occurrence:0,data:{title:'x',date:'2026-02-31',amount:100,currency:'USD',type:'expense',category:'A',account:'B',notes:''}},{occurrence:0,data:{title:'neg',date:today(),amount:-5,currency:'USD',type:'expense',category:'A',account:'B',notes:''}},row('Valid one',100)]});
  assert.deepEqual([mixed.imported,mixed.rejectedCount],[1,2]);assert.ok(mixed.rejected.every((r:any)=>typeof r.message==='string'));
  // Free plan: 100 transactions per month. 4 exist now (3 + Valid one); the rest of 120 distinct rows are limited.
  const bulk=await u.json('/api/import/transactions','POST',{rows:Array.from({length:120},(_,i)=>row('Bulk '+i,100+i))});
  assert.equal(bulk.imported,96);assert.equal(bulk.limited,24);
  const count=(await api.pool.query('SELECT COUNT(*)::int AS n FROM "Record" WHERE "userId"=$1 AND kind=\'transaction\'',[u.id])).rows[0].n;assert.equal(count,100);
  assert.equal((await u.request('/api/import/transactions','POST',{rows:Array.from({length:251},(_,i)=>row('X'+i,1))})).status,400);
  assert.equal((await u.request('/api/import/transactions','POST',{rows:[]})).status,400);
  // Budget alert from imported spending.
  const pro=await api.user({plan:'Pro'});await pro.json('/api/records','POST',{kind:'budget',data:{title:'Food',month,amount:10000,currency:'USD',category:'Food'}});
  await pro.json('/api/import/transactions','POST',{rows:[row('Groceries',9000)]});
  assert.ok((await pro.json('/api/snapshot')).records.some((r:any)=>r.kind==='notification'&&/80% of budget used/.test(r.data.title)));
 }finally{await api.stop();}
});

test('a suspended account cannot import',{skip,timeout:60000},async()=>{
 const api=await startApi(4046);
 try{const banned=await api.user({status:'suspended'});assert.equal((await banned.request('/api/import/transactions','POST',{rows:[row('x',1)]})).status,403);}finally{await api.stop();}
});
