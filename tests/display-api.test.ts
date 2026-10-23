import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
test('units, week start and formats are saved with preferences and come back in the profile',{skip,timeout:90000},async()=>{
 const api=await startApi(4061);
 try{
  const u=await api.user({plan:'Free'});
  const before=await u.json('/api/snapshot');assert.deepEqual(before.profile.display??{},{});
  const body={name:before.profile.name,currency:'EUR',timezone:before.profile.timezone,optionalEmails:false,productUpdates:false,display:{units:'imperial',weekStart:0,dateFormat:'dmy',numberFormat:'eu'}};
  assert.equal((await u.request('/api/preferences','PATCH',body)).status,200);
  const after=await u.json('/api/snapshot');assert.equal(after.profile.currency,'EUR');assert.deepEqual(after.profile.display,body.display);
  const bad=await u.request('/api/preferences','PATCH',{...body,display:{units:'furlongs',weekStart:3,dateFormat:'x',numberFormat:'y'}});assert.equal(bad.status,400);
 }finally{await api.stop();}
});

test('switching currency keeps every saved amount and only changes the code',{skip,timeout:90000},async()=>{
 const api=await startApi(4062);
 try{
  const u=await api.user({plan:'Pro'});const me=await u.json('/api/snapshot');
  const tx=await u.request('/api/records','POST',{kind:'transaction',data:{title:'Rent',date:'2026-09-02',amount:120000,currency:me.profile.currency,type:'expense',category:'Essentials',account:'Main',notes:''}});assert.ok(tx.status<300,String(tx.status));
  const pref={name:me.profile.name,currency:'AED',timezone:me.profile.timezone,optionalEmails:false,productUpdates:false};
  assert.equal((await u.request('/api/preferences','PATCH',pref)).status,200);
  const after=await u.json('/api/snapshot');const rent=after.records.find((r:any)=>r.kind==='transaction'&&r.data.title==='Rent');
  assert.equal(rent.data.currency,'AED');assert.equal(rent.data.amount,120000);assert.equal(after.profile.currency,'AED');
 }finally{await api.stop();}
});

test('a member who never set units and formats (display = {}) can still save any setting', {skip,timeout:90000},async()=>{
 const api=await startApi(4063);
 try{
  const u=await api.user({plan:'Free'});const me=await u.json('/api/snapshot');
  const base={name:me.profile.name,currency:me.profile.currency,timezone:me.profile.timezone,optionalEmails:false,productUpdates:false};
  // exactly what the Settings screen sends for a brand-new account
  assert.equal((await u.request('/api/preferences','PATCH',{...base,name:'Renamed Member',display:{}})).status,200);
  assert.equal((await u.json('/api/snapshot')).profile.name,'Renamed Member');
  // partial display keeps the keys that were not sent
  assert.equal((await u.request('/api/preferences','PATCH',{...base,display:{units:'imperial'}})).status,200);
  assert.equal((await u.request('/api/preferences','PATCH',{...base,display:{weekStart:0}})).status,200);
  const after=await u.json('/api/snapshot');assert.equal(after.profile.display.units,'imperial');assert.equal(after.profile.display.weekStart,0);
  // invalid values are still rejected
  assert.equal((await u.request('/api/preferences','PATCH',{...base,display:{units:'furlongs'}})).status,400);
 }finally{await api.stop();}
});
