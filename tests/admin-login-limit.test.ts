import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
import {attempt} from './support/login';
const skip=!process.env.TEST_DATABASE_URL;

test('the administrator sign-in has a per-network failure cap, and another network is unaffected',{skip,timeout:240000},async()=>{
 const api=await startApi(4092);
 try{
  const path='/auth/admin/login',statuses:number[]=[];
  for(let i=0;i<110;i++){const r=await attempt(api.base,{email:`probe-${i}-${Date.now()}@example.com`,password:'not-the-password-1!',ip:'203.0.113.50',path});statuses.push(r.status);await r.text();}
  const firstBlock=statuses.indexOf(429);
  assert.ok(firstBlock>=0&&firstBlock<=101,`a network that keeps failing is stopped (first 429 at ${firstBlock})`);
  const other=await attempt(api.base,{email:'someone@example.com',password:'not-the-password-1!',ip:'198.51.100.77',path});
  assert.equal(other.status,401,'a different network is not affected');
 }finally{await api.stop();}
});
