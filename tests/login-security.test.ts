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

test('shared network: other people typing wrong passwords does not stop a normal person on the same network',{skip,timeout:180000},async()=>{
 const api=await startApi(4093);
 try{
  const email=`shared-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  for(let i=0;i<30;i++){const r=await attempt(api.base,{email:`typo-${i}-${Date.now()}@example.com`,password:'wrong-password-1!',ip:'192.0.2.44'});assert.equal(r.status,401);await r.text();}
  assert.equal((await attempt(api.base,{email,password:strong,ip:'192.0.2.44'})).status,200,'the 31st person on that network still signs in');
 }finally{await api.stop();}
});

test('five wrong tries stop only that network and account pair',{skip,timeout:180000},async()=>{
 const api=await startApi(4094);
 try{
  const mine=`pair-${Date.now()}@example.com`,other=`pair2-${Date.now()}@example.com`;await passwordUser(api,mine,strong);await passwordUser(api,other,strong);
  for(let i=0;i<5;i++){const r=await attempt(api.base,{email:mine,password:'wrong-password-1!',ip:'192.0.2.60'});assert.equal(r.status,401);await r.text();}
  const sixth=await attempt(api.base,{email:mine,password:'wrong-password-1!',ip:'192.0.2.60'});assert.equal(sixth.status,429);assert.ok(Number(sixth.headers.get('retry-after'))>0,'says how long to wait');await sixth.text();
  assert.equal((await attempt(api.base,{email:other,password:strong,ip:'192.0.2.60'})).status,200,'another account from the same network is fine');
  assert.equal((await attempt(api.base,{email:mine,password:strong,ip:'192.0.2.61'})).status,200,'the same account from another network is fine');
 }finally{await api.stop();}
});

test('three API replicas share one set of counters',{skip,timeout:240000},async()=>{
 const replicas=[await startApi(4095),await startApi(4096),await startApi(4097)];
 try{
  const email=`replicas-${Date.now()}@example.com`;await passwordUser(replicas[0],email,strong);
  const statuses:number[]=[];
  for(let i=0;i<6;i++){const r=await attempt(replicas[i%3].base,{email,password:'wrong-password-1!',ip:'192.0.2.70'});statuses.push(r.status);await r.text();}
  assert.deepEqual(statuses,[401,401,401,401,401,429],'the sixth wrong try is stopped no matter which replica receives it');
 }finally{for(const r of replicas)await r.stop();}
});

// Known gap, fixed by the trusted-device work: anyone can fill another person's account counter from several networks,
// and then the real owner is stopped too. Marked todo so it documents the gap without failing the suite.
test('an attacker spreading wrong tries over many networks cannot stop the real owner',{skip,todo:'account lockout is fixed in a later commit',timeout:240000},async()=>{
 const api=await startApi(4098);
 try{
  const email=`victim-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  for(let n=0;n<5;n++)for(let i=0;i<4;i++){const r=await attempt(api.base,{email,password:'wrong-password-1!',ip:`203.0.113.${100+n}`});await r.text();}
  assert.equal((await attempt(api.base,{email,password:strong,ip:'198.51.100.200'})).status,200,'the owner, from a new network with the right password, still signs in');
 }finally{await api.stop();}
});

test('a successful sign-in clears that network and account pair, so one earlier typo is not held against the person',{skip,timeout:180000},async()=>{
 const api=await startApi(4099);
 try{
  const email=`reset-count-${Date.now()}@example.com`;await passwordUser(api,email,strong);
  for(let i=0;i<4;i++){const r=await attempt(api.base,{email,password:'wrong-password-1!',ip:'192.0.2.80'});assert.equal(r.status,401);await r.text();}
  assert.equal((await attempt(api.base,{email,password:strong,ip:'192.0.2.80'})).status,200);
  for(let i=0;i<5;i++){const r=await attempt(api.base,{email,password:'wrong-password-1!',ip:'192.0.2.80'});assert.equal(r.status,401,`wrong try ${i+1} after a success is a fresh count`);await r.text();}
  assert.equal((await attempt(api.base,{email,password:'wrong-password-1!',ip:'192.0.2.80'})).status,429,'and the pair is still limited after five fresh wrong tries');
 }finally{await api.stop();}
});

test('a success on one account does not clear the network-wide failure count',{skip,timeout:240000},async()=>{
 const api=await startApi(4100);
 try{
  const mine=`own-${Date.now()}@example.com`;await passwordUser(api,mine,strong);
  const statuses:number[]=[];
  for(let i=0;i<150;i++){
   const r=await attempt(api.base,{email:`spray-${i}-${Date.now()}@example.com`,password:'wrong-password-1!',ip:'192.0.2.90'});statuses.push(r.status);await r.text();
   if(i%20===19){const ok=await attempt(api.base,{email:mine,password:strong,ip:'192.0.2.90'});await ok.text();}
  }
  assert.ok(statuses.includes(429),'interleaving a success with an account the attacker owns does not reset the network cap');
 }finally{await api.stop();}
});

test('a busy shared network with many real sign-ins is not stopped by its own typos, but a pure spray is',{skip,timeout:420000},async()=>{
 const api=await startApi(4103);
 try{
  const ip='192.0.2.120',people:{email:string}[]=[];
  for(let i=0;i<40;i++){const email=`busy-${i}-${Date.now()}@example.com`;await passwordUser(api,email,strong);people.push({email});}
  for(const p of people){const r=await attempt(api.base,{email:p.email,password:strong,ip});assert.equal(r.status,200);await r.text();}
  let blocked=0;
  for(let i=0;i<130;i++){const r=await attempt(api.base,{email:`typo-${i}-${Date.now()}@example.com`,password:'wrong-password-1!',ip});if(r.status===429)blocked++;await r.text();}
  assert.equal(blocked,0,'40 different people signed in, so 130 typos from that network are normal');
  const spray:number[]=[];
  for(let i=0;i<110;i++){const r=await attempt(api.base,{email:`spray2-${i}-${Date.now()}@example.com`,password:'wrong-password-1!',ip:'192.0.2.121'});spray.push(r.status);await r.text();}
  assert.ok(spray.includes(429),'a network with only failures and no sign-ins is stopped');
 }finally{await api.stop();}
});
