import {test} from 'node:test';
import assert from 'node:assert/strict';
import {startApi} from './support/api';
const skip=!process.env.TEST_DATABASE_URL;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'UTC'}).format(new Date());
test('monthly report exports: CSV carries the weekly and category sections; PDF is generated on demand and paid-only',{skip,timeout:120000},async()=>{
 const api=await startApi(4050);
 try{
  const pro=await api.user({plan:'Pro'}),free=await api.user({plan:'Free'}),month=today().slice(0,7);
  for(const u of [pro,free])await u.json('/api/records','POST',{kind:'transaction',data:{title:'Lunch',date:today(),amount:1250,currency:'USD',type:'expense',category:'Food',account:'Cash',notes:''}});
  const csv=await (await pro.request(`/api/reports/${month}.csv`)).text();
  assert.match(csv,/Week by week/);assert.match(csv,/Spending by category/);assert.match(csv,/"Food","12.5"/);assert.match(csv,/"Expenses","12.5"/);
  const pdf=await pro.request(`/api/reports/${month}.pdf`);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type')||'',/application\/pdf/);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1500);
  assert.equal((await free.request(`/api/reports/${month}.pdf`)).status,403,'PDF stays a paid feature');assert.equal((await free.request(`/api/reports/${month}.csv`)).status,200,'the current-month CSV stays free');
 }finally{await api.stop();}
});
