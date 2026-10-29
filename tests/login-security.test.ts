import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
import {passwordUser,attempt} from './support/login';
const skip=!process.env.TEST_DATABASE_URL;
const strong='Correct-horse-battery-9!';

test('a flood of sign-ins from one network never stops a normal person from signing in',{skip,timeout:180000},async()=>{
 const api=await startApi(4091,{HASH_CONCURRENCY:'2',HASH_PER_SOURCE:'2',HASH_QUEUE:'10'});
 try{
  const email=`flood-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  const flood=Array.from({length:40},(_,i)=>attempt(api.base,{email:`nobody-${i}-${Date.now()}@example.com`,password:'wrong-password-here',ip:'203.0.113.9'}).then(r=>r.status));
  await new Promise(r=>setTimeout(r,150));
  const normal=await attempt(api.base,{email,password:strong,ip:'198.51.100.7'});
  const statuses=await Promise.all(flood);
  assert.equal(normal.status,200,'the normal person signs in while the flood is running');
  assert.ok(statuses.some(s=>s===503),'the flooding network is turned away with "busy" (503)');
  assert.ok(statuses.every(s=>s===401||s===503||s===429),'and nothing else goes wrong: '+JSON.stringify([...new Set(statuses)]));
  const busy=await attempt(api.base,{email:'x@example.com',password:'x',ip:'203.0.113.9'});await busy.text();
 }finally{await api.stop();}
});
