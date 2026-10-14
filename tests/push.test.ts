import {test} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {pushEndpoint,sendBrowser,habitReminderDate,zonedHour,recordReminder,notificationEmailAllowed,morningDigest} from '../apps/api/src/push.js';
test('Free notifications are browser-only and paid emails require opt-in',()=>{assert.equal(notificationEmailAllowed('Free',true),false);for(const plan of ['Pro','Lifetime'] as const){assert.equal(notificationEmailAllowed(plan,true),true);assert.equal(notificationEmailAllowed(plan,false),false);}});
test('scheduled browser reminders use the customer timezone and skip completed records',()=>{
 assert.equal(zonedHour('2026-10-06',8,'Asia/Karachi').toISOString(),'2026-10-06T03:00:00.000Z');assert.equal(zonedHour('2026-03-08',8,'America/New_York').toISOString(),'2026-03-08T12:00:00.000Z');
 const habit={title:'Reading',days:[2],active:true,startDate:'2026-10-01'};assert.equal(habitReminderDate(habit,'Asia/Karachi',new Date('2026-10-06T17:59:00Z')),null);assert.equal(habitReminderDate(habit,'Asia/Karachi',new Date('2026-10-06T18:00:00Z')),'2026-10-06');assert.equal(habitReminderDate({...habit,active:false},'Asia/Karachi',new Date('2026-10-06T18:00:00Z')),null);
 const workout={id:'workout',kind:'workout' as const,version:1,data:{title:'Training',date:'2026-10-06',type:'Strength',duration:20,notes:'',done:false}};assert.equal(recordReminder(workout)?.url,'/fitness');assert.equal(recordReminder({...workout,data:{...workout.data,done:true}}),null);
 const goal={id:'goal',kind:'goal' as const,version:1,data:{title:'Project',description:'',current:0,target:1,unit:'steps',deadline:'2026-10-06',active:true,tracking:'steps' as const}};assert.ok(recordReminder(goal));assert.equal(recordReminder(goal,[{id:'step',kind:'milestone',version:1,data:{title:'Finish',goalId:'goal',done:true}}]),null);
});
test('browser push rejects private endpoints and removes expired subscriptions',async()=>{
 for(const url of ['http://fcm.googleapis.com/send/x','https://localhost/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.example/x','https://user:pass@fcm.googleapis.com/x'])assert.equal(pushEndpoint.safeParse(url).success,false);
 for(const url of ['https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/wpush/v2/x','https://web.push.apple.com/x'])assert.equal(pushEndpoint.safeParse(url).success,true);
 const previous={public:process.env.VAPID_PUBLIC_KEY,private:process.env.VAPID_PRIVATE_KEY,subject:process.env.VAPID_SUBJECT},keys=webpush.generateVAPIDKeys(),original=webpush.sendNotification;process.env.VAPID_PUBLIC_KEY=keys.publicKey;process.env.VAPID_PRIVATE_KEY=keys.privateKey;process.env.VAPID_SUBJECT='mailto:fixture@example.com';let removed=false,query:any;
 const tx={pushSubscription:{findMany:async(args:any)=>{query=args;return [{id:'expired',endpoint:'https://fcm.googleapis.com/fcm/send/x',p256dh:'fixture',auth:'fixture'}];},deleteMany:async()=>{removed=true;}}};
 try{webpush.sendNotification=async()=>{throw Object.assign(new Error('Gone'),{statusCode:410});};assert.deepEqual(await sendBrowser(tx as any,'owner',{title:'Fixture',body:'Fixture body',url:'/tasks'},'job-key',true),{sent:0});assert.equal(removed,true);assert.deepEqual(query.where,{userId:'owner',reminders:true});webpush.sendNotification=async()=>{throw Object.assign(new Error('Temporary'),{statusCode:503});};await assert.rejects(sendBrowser(tx as any,'owner',{title:'Fixture',body:'Body',url:'/'},'job-key'),/503/);}
 finally{webpush.sendNotification=original;for(const [key,value] of [['VAPID_PUBLIC_KEY',previous.public],['VAPID_PRIVATE_KEY',previous.private],['VAPID_SUBJECT',previous.subject]])if(value===undefined)delete process.env[key!];else process.env[key!]=value;}
});

test('morning digest counts only the customer\'s own open work and uses their local calendar day',()=>{
 const task=(due:string,done=false)=>({kind:'task',data:{title:'T',description:'',due,priority:'low',done,reminder:true,recurrence:'none'}});
 const habit={kind:'habit',data:{title:'Read',days:[2],active:true,startDate:'2026-10-01'}};
 // 2026-10-06 is a Tuesday. 20:00Z on the 5th is already the 6th in Karachi (UTC+5) but still the 5th in New York.
 const now=new Date('2026-10-06T03:00:00Z');
 const rows=[task('2026-10-05T20:00:00Z'),task('2026-10-05T12:00:00Z'),task('2026-10-06T09:00:00Z',true),habit];
 const karachi=morningDigest(rows,'Asia/Karachi',now);assert.equal(karachi.body,'Today: 1 task due today, 1 overdue, 1 habit scheduled. Open Daily Ledger to plan your day.');assert.equal(morningDigest([task('2026-10-06T09:00:00Z',true)],'Asia/Karachi',now).body,'Nothing is scheduled yet. Open Daily Ledger to plan your day.');
});
