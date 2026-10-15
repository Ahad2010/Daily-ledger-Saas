import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi,origin} from './support/api';
process.env.DATABASE_URL||=process.env.TEST_DATABASE_URL;
const skip=!process.env.TEST_DATABASE_URL;
test('network addresses and e-mail addresses are masked before they are stored',async()=>{
 const {maskIp,maskEmail}=await import('../apps/api/src/activity');
 assert.equal(maskIp('203.0.113.77'),'203.0.113.0');assert.equal(maskIp('::ffff:198.51.100.9'),'198.51.100.0');
 assert.equal(maskIp('2001:db8:85a3:8d3:1319:8a2e:370:7348'),'2001:db8:85a3::');assert.equal(maskIp('::1'),'::1');assert.equal(maskIp(undefined),null);assert.equal(maskIp('not an ip'),null);
 assert.equal(maskEmail('jane.doe@example.com'),'j***@example.com');
});
test('admins get a per-user activity timeline, filters and counts without any record contents',{skip,timeout:180000},async()=>{
 const api=await startApi(4061);
 try{
  const admin=await api.user({admin:true,name:'Activity admin'}),member=await api.user({name:'Timeline member'});
  assert.equal((await member.request('/api/records','POST',{kind:'task',data:{title:'Secret task title',description:'private notes',due:'2026-10-20T09:00:00.000Z',priority:'medium',done:false,reminder:true,recurrence:'none'}})).status,201);
  await member.request('/api/export');
  assert.equal((await admin.request('/api/admin/users/'+member.id+'/action','POST',{action:'suspend',reason:'Testing the audit trail'})).status,200);
  const deadline=Date.now()+8000;let types:string[]=[];
  while(Date.now()<deadline){const rows=await api.pool.query('SELECT type FROM "ActivityEvent" WHERE "userId"=$1',[member.id]);types=rows.rows.map(r=>r.type);if(['record.created','data.exported','admin.suspend'].every(t=>types.includes(t)))break;await new Promise(r=>setTimeout(r,150));}
  for(const t of ['record.created','data.exported','admin.suspend'])assert.ok(types.includes(t),`${t} missing from ${types}`);
  const detail=await admin.json('/api/admin/users/'+member.id);
  assert.ok(detail.activity.length>=3);assert.equal(detail.activityStats.records.task,1);assert.equal(detail.activityStats.failedLogins30d,0);
  assert.ok(!JSON.stringify(detail.activity).includes('Secret task title'),'record contents must never be logged');assert.ok(!JSON.stringify(detail.activity).includes('private notes'));
  const created=await admin.json('/api/admin/activity?type=record.created');assert.ok(created.records.every((r:any)=>r.type==='record.created'));
  const mine=created.records.find((r:any)=>r.userId===member.id);assert.equal(mine.user.name,'Timeline member');assert.equal(mine.meta.kind,'task');
  const bySearch=await admin.json('/api/admin/activity?search='+encodeURIComponent(member.id.slice(0,8)));assert.ok(bySearch.records.length>=3&&bySearch.records.every((r:any)=>r.userId===member.id));
  assert.equal((await member.request('/api/admin/activity')).status<500,true);const denied=await member.json('/api/admin/activity');assert.ok(!denied.records,'a non-administrator must not read the activity log');
 }finally{await api.stop();}
});
test('failed sign-ins are recorded against the account with a masked address, and old events are pruned',{skip,timeout:180000},async()=>{
 const api=await startApi(4062);
 try{
  const email=`login-${Date.now()}@example.com`;const user=await api.user();
  await api.pool.query('UPDATE "User" SET email=$1 WHERE id=$2',[email,user.id]);
  await api.pool.query('INSERT INTO "PasswordCredential" (id,"userId",email,"passwordHash","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,NOW())',[user.id,email,(await import('../apps/api/src/passwords')).hashPassword?await (await import('../apps/api/src/passwords')).hashPassword('Correct-horse-battery-9!'):'']);
  const csrfResponse=await fetch(api.base+'/auth/csrf');const cookie=(csrfResponse.headers.get('set-cookie')||'').split(';')[0];const {csrf}=await csrfResponse.json() as {csrf:string};
  const attempt=await fetch(api.base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-CSRF-Token':csrf,Cookie:cookie},body:JSON.stringify({email,password:'definitely-wrong-password'})});
  assert.equal(attempt.status,401);
  const deadline=Date.now()+8000;let event:any;
  while(Date.now()<deadline&&!event){event=(await api.pool.query(`SELECT * FROM "ActivityEvent" WHERE type='auth.login_failed' AND meta->>'email'=$1`,[email.slice(0,1)+'***@example.com'])).rows[0];if(!event)await new Promise(r=>setTimeout(r,150));}
  assert.ok(event,'failed login should be logged');assert.ok(!JSON.stringify(event).includes(email),'the full e-mail address must not be stored');
  await api.pool.query(`INSERT INTO "ActivityEvent" (id,type,"createdAt") VALUES ('old-event-1','auth.login',NOW()-INTERVAL '200 days'),('new-event-1','auth.login',NOW())`);
  const {pruneActivity}=await import('../apps/api/src/activity');const removed=await pruneActivity();assert.ok(removed>=1);
  assert.equal((await api.pool.query(`SELECT 1 FROM "ActivityEvent" WHERE id='old-event-1'`)).rowCount,0);assert.equal((await api.pool.query(`SELECT 1 FROM "ActivityEvent" WHERE id='new-event-1'`)).rowCount,1);
  await api.pool.query(`DELETE FROM "ActivityEvent" WHERE id='new-event-1' OR type='auth.login_failed'`);await api.pool.query('DELETE FROM "PasswordCredential" WHERE "userId"=$1',[user.id]);
 }finally{await api.stop();}
});
