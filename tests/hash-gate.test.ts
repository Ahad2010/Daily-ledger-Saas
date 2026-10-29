import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHashGate,HashBusyError} from '../apps/api/src/hash-gate';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));

test('the hash gate runs a few at a time and turns the excess away quickly',async()=>{
 const gate=createHashGate({concurrency:2,queue:3,perSource:50});let running=0,peak=0;
 const job=async()=>{running++;peak=Math.max(peak,running);await sleep(30);running--;return 'ok';};
 const results=await Promise.allSettled(Array.from({length:10},()=>gate.run('ip',job)));
 const ok=results.filter(r=>r.status==='fulfilled').length,busy=results.filter(r=>r.status==='rejected'&&(r as PromiseRejectedResult).reason instanceof HashBusyError).length;
 assert.equal(peak,2,'never more than the allowed number at once');assert.equal(ok,5,'2 running + 3 queued');assert.equal(busy,5);
});

test('one noisy source cannot use the whole queue, so a normal person still gets through',async()=>{
 const gate=createHashGate({concurrency:2,queue:40,perSource:3});
 const job=async()=>{await sleep(40);return 'ok';};
 const flood=Array.from({length:30},()=>gate.run('attacker',job).then(()=>'ok',e=>e instanceof HashBusyError?'busy':'error'));
 await sleep(5);
 const normal=await gate.run('normal-user',job).then(()=>'ok',e=>e instanceof HashBusyError?'busy':'error');
 const floodResults=await Promise.all(flood);
 assert.equal(normal,'ok','a normal user is not turned away during a flood from another source');
 assert.ok(floodResults.filter(r=>r==='busy').length>=20,'the flooding source is mostly turned away');
 assert.equal(floodResults.filter(r=>r==='ok').length,3,'only its own small share is served at once');
});

test('capacity is released after success and after a failure',async()=>{
 const gate=createHashGate({concurrency:1,queue:0,perSource:1});
 await assert.rejects(()=>gate.run('a',async()=>{throw new Error('boom');}),/boom/);
 assert.equal(await gate.run('a',async()=>'again'),'again');
 const slow=gate.run('a',()=>sleep(30).then(()=>'slow'));
 await assert.rejects(()=>gate.run('a',async()=>'second'),HashBusyError);
 assert.equal(await slow,'slow');assert.equal(await gate.run('a',async()=>'free'),'free');
});
