import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString();

test('a task due on a later day cannot be completed early, but today and overdue tasks can',{skip,timeout:120000},async()=>{
 const api=await startApi(4047);
 try{
  const u=await api.user({plan:'Pro'});
  const make=async(title:string,due:string)=>(await u.json('/api/records','POST',{kind:'task',data:{title,due,priority:'medium',done:false,description:'',recurrence:'none'}})) as any;
  const future=await make('Later',day(4)),overdue=await make('Earlier',day(-3));
  const tick=(r:any,done:boolean)=>u.request(`/api/records/${r.id}`,'PATCH',{kind:'task',version:r.version,data:{...r.data,done}});
  assert.equal((await tick(future,true)).status,400);
  assert.equal((await tick(overdue,true)).status,200);
 }finally{await api.stop();}
});
