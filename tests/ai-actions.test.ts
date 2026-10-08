import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {parseAssistantReply,sanitizeActions,assistantLinks} from '../apps/api/src/ai-actions';
import {startApi} from './support/api';
const ctx={currency:'USD',today:'2026-10-08'};

test('assistant proposals are validated against the record schemas and labelled by the server',()=>{
 const reply=parseAssistantReply('```json\n'+JSON.stringify({answer:'Done — confirm below.',actions:[
  {type:'create',kind:'task',data:{title:'Call the bank',due:'2026-10-09T17:00:00+05:00',priority:'high'}},
  {type:'create',kind:'transaction',data:{title:'Lunch',date:'2026-10-08',amount:1250,type:'expense',category:'Food'}},
  {type:'create',kind:'habit',data:{title:'Read',days:[1,3,5]}},
  {type:'link',path:'/finance/transactions'},
  {type:'create',kind:'announcement',data:{title:'x'}},
  {type:'link',path:'https://evil.example/phish'},
  {type:'create',kind:'transaction',data:{title:'Bad',date:'2026-10-08',amount:-5,type:'expense',category:'Food'}},
  {type:'create',kind:'task',data:{title:'No due date'}},
  {type:'delete',kind:'task',data:{}},
  'not an object'
 ]})+'\n```',ctx);
 assert.equal(reply.answer,'Done — confirm below.');assert.equal(reply.actions.length,4);
 assert.deepEqual(reply.actions.map(a=>a.label),['Add task "Call the bank" · due 2026-10-09 · high priority','Record expense of $12.50 · Lunch (Food) on 2026-10-08','Add habit "Read" on Mon, Wed, Fri','Open Transactions']);
 const transaction=reply.actions[1] as {data:Record<string,unknown>};assert.equal(transaction.data.currency,'USD');assert.equal(transaction.data.account,'Cash');
 const habit=reply.actions[2] as {data:Record<string,unknown>};assert.equal(habit.data.startDate,'2026-10-08');
});
test('plain-text, malformed and oversized replies degrade safely',()=>{
 assert.deepEqual(parseAssistantReply('Your spending is mostly food.',ctx),{answer:'Your spending is mostly food.',actions:[]});
 assert.deepEqual(parseAssistantReply('{"answer": broken',ctx).actions,[]);
 assert.deepEqual(parseAssistantReply('{"answer":"","actions":[]}',ctx).answer,'{"answer":"","actions":[]}');
 const many=Array.from({length:12},(_,i)=>({type:'create',kind:'grocery',data:{title:'Item '+i}}));assert.equal(sanitizeActions(many,ctx).length,5);
 assert.equal(sanitizeActions([many[0],many[0]],ctx).length,1,'duplicates collapse');
 assert.ok(Object.keys(assistantLinks).every(path=>path.startsWith('/')));
});

const skip=!process.env.TEST_DATABASE_URL;
test('AI chat: capabilities reach the model; only validated, confirmable actions come back and persist with the history',{skip,timeout:120000},async()=>{
 const requests:any[]=[];let reply='';
 const provider=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;requests.push(JSON.parse(body));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:reply}}],usage:{prompt_tokens:200,completion_tokens:40}}));});
 await new Promise<void>(resolve=>provider.listen(0,'127.0.0.1',resolve));const port=(provider.address() as {port:number}).port;
 const api=await startApi(4053,{AI_PROVIDER:'openai-compatible',AI_BASE_URL:`http://127.0.0.1:${port}`,AI_MODEL:'fixture-model',AI_API_KEY:'fixture-key'});
 const settings={productName:'Daily Ledger',supportContact:'',timezone:'UTC',currency:'USD',optionalEmailsDefault:false,publicAnnouncements:true,aiEnabled:true,assistantInstructions:'',aiAllowances:{Free:{requests:10,tokens:20000},Pro:{requests:100,tokens:100000},Lifetime:{requests:60,tokens:60000}}};
 const previous=(await api.pool.query('SELECT * FROM "PlatformConfig" WHERE id=1')).rows[0];
 await api.pool.query('INSERT INTO "PlatformConfig" (id,data,version,"updatedAt") VALUES (1,$1,1,NOW()) ON CONFLICT (id) DO UPDATE SET data=$1',[JSON.stringify(settings)]);
 try{
  const u=await api.user({plan:'Pro',currency:'USD',timezone:'Asia/Karachi'}),month=new Date().toISOString().slice(0,7);
  const ask=(question:string)=>u.json('/api/ai/chat','POST',{requestId:crypto.randomUUID(),month,intent:'general',question});
  reply=JSON.stringify({answer:'I can add that for you.',actions:[{type:'create',kind:'task',data:{title:'Pay rent',due:'2026-10-10T09:00:00+05:00'}},{type:'create',kind:'announcement',data:{title:'spoof'}},{type:'link',path:'/tasks'}]});
  const first=await ask('Add a task to pay rent on Saturday morning');
  assert.equal(first.message.answer,'I can add that for you.');assert.equal(first.message.actions.length,2);assert.deepEqual(first.message.actions.map((a:any)=>a.type),['create','link']);assert.equal(first.message.actions[0].label,'Add task "Pay rent" · due 2026-10-10');
  const sent=JSON.stringify(requests[0].messages);assert.ok(sent.includes('Reply ONLY as compact JSON'));assert.ok(sent.includes('Daily Ledger guide'));assert.ok(sent.includes('Asia/Karachi'),'the user timezone is provided for date resolution');
  reply='Plain text answer without actions.';
  const second=await ask('How do I import my bank statement?');assert.equal(second.message.answer,'Plain text answer without actions.');assert.equal(second.message.actions,null);
  const history=await u.json('/api/ai/history');assert.equal(history.messages.length,2);assert.equal(history.messages[0].actions.length,2);
  // Nothing was created by the assistant itself.
  assert.equal((await u.json('/api/snapshot')).records.filter((r:any)=>r.kind==='task').length,0);
 }finally{const restore=previous?JSON.stringify(previous.data):null;await api.pool.query(restore?'UPDATE "PlatformConfig" SET data=$1 WHERE id=1':'DELETE FROM "PlatformConfig" WHERE id=1',restore?[restore]:[]);await api.stop();provider.close();}
});
