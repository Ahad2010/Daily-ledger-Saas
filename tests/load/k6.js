// k6 load test for the Daily Ledger API. Run only against a DISPOSABLE local copy seeded by tests/load/seed.ts, never against the live service.
//   k6 run -e SCENARIO=browse|login|mixed|spike -e BASE=http://localhost:4200 -e USERS=/path/users.json tests/load/k6.js
import http from 'k6/http';
import {check,sleep} from 'k6';
import {SharedArray} from 'k6/data';
import {Counter,Trend} from 'k6/metrics';
const file=JSON.parse(open(__ENV.USERS||'/tmp/claude-0/load/users.json'));
const people=new SharedArray('people',()=>file.sessions);
const BASE=__ENV.BASE||'http://localhost:4200',ORIGIN='http://localhost:3000',SCENARIO=__ENV.SCENARIO||'browse';
const planLimit=new Counter('write_plan_limit_403'),busy=new Counter('login_busy_503'),limited=new Counter('http_429'),loginOk=new Counter('login_ok'),loginTime=new Trend('login_ms',true),snapTime=new Trend('snapshot_ms',true);
const ip=()=>`10.${Math.floor(Math.random()*250)}.${Math.floor(Math.random()*250)}.${1+Math.floor(Math.random()*250)}`;
const browseScenario={executor:'ramping-vus',startVUs:0,stages:[{duration:'30s',target:Number(__ENV.VUS||300)},{duration:__ENV.HOLD||'2m',target:Number(__ENV.VUS||300)},{duration:'15s',target:0}],exec:'browse'};
const loginScenario={executor:'ramping-arrival-rate',startRate:1,timeUnit:'1s',preAllocatedVUs:200,maxVUs:1500,stages:[{duration:'20s',target:Number(__ENV.LOGIN_RATE||10)},{duration:__ENV.HOLD||'1m',target:Number(__ENV.LOGIN_RATE||10)},{duration:'10s',target:0}],exec:'login'};
const spike={executor:'ramping-arrival-rate',startRate:10,timeUnit:'1s',preAllocatedVUs:300,maxVUs:3000,stages:[{duration:'20s',target:100},{duration:'30s',target:Number(__ENV.RPS||400)},{duration:'30s',target:Number(__ENV.RPS||400)},{duration:'10s',target:0}],exec:'browse'};
const tabsScenario={executor:'constant-arrival-rate',rate:Number(__ENV.TABS_RATE||133),timeUnit:'1s',duration:__ENV.HOLD||'2m',preAllocatedVUs:300,maxVUs:1500,exec:'tab'};
const quietLogin={...loginScenario,stages:[{duration:'20s',target:5},{duration:__ENV.HOLD||'2m',target:5},{duration:'10s',target:0}]};
export const options={scenarios:SCENARIO==='tabs'?{tabs:tabsScenario,login:quietLogin}:SCENARIO==='tabsonly'?{tabs:tabsScenario}:SCENARIO==='login'?{login:loginScenario}:SCENARIO==='mixed'?{browse:browseScenario,login:loginScenario}:SCENARIO==='spike'?{spike}:{browse:browseScenario},summaryTrendStats:['avg','med','p(90)','p(95)','p(99)','max'],
 thresholds:{'http_req_failed{kind:browse}':['rate<0.01'],'http_req_duration{kind:browse}':['p(95)<1500']}};
const jar=person=>({headers:{Cookie:person.cookie,Origin:ORIGIN,'X-CSRF-Token':file.csrf,'Content-Type':'application/json','X-Forwarded-For':ip()},tags:{kind:'browse'}});
export function browse(){
 const person=people[Math.floor(Math.random()*people.length)],p=jar(person);
 const me=http.get(BASE+'/auth/me',p);check(me,{'me 200':r=>r.status===200});
 const snap=http.get(BASE+'/api/snapshot',p);snapTime.add(snap.timings.duration);check(snap,{'snapshot 200':r=>r.status===200});if(snap.status===429)limited.add(1);
 if(Math.random()<0.25){const w=http.post(BASE+'/api/records',JSON.stringify({kind:'transaction',data:{title:'Load coffee',date:'2026-10-29',amount:450,currency:'PKR',type:'expense',category:'Food',account:'Cash',notes:''}}),{...p,responseCallback:http.expectedStatuses({min:200,max:299},403)});if(w.status===403)planLimit.add(1);check(w,{'write ok or plan limit (403)':r=>r.status<300||r.status===403});}
 sleep(3+Math.random()*5);
}
// One open browser tab refreshing: the web app asks for identity and the snapshot every 15 seconds (apps/web/components/ledger-app.tsx, refetchInterval:15000).
export function tab(){const p=jar(people[Math.floor(Math.random()*people.length)]);http.get(BASE+'/auth/me',p);const snap=http.get(BASE+'/api/snapshot',p);snapTime.add(snap.timings.duration);check(snap,{'snapshot 200':r=>r.status===200});}
export function login(){
 const person=people[Math.floor(Math.random()*people.length)],from=ip();
 const first=http.get(BASE+'/auth/csrf',{headers:{'X-Forwarded-For':from},tags:{kind:'login'}});
 const token=first.json('csrf'),cookie=first.cookies&&Object.keys(first.cookies).length?Object.entries(first.cookies).map(([k,v])=>k+'='+v[0].value).join('; '):'';
 const r=http.post(BASE+'/auth/login',JSON.stringify({email:person.email,password:file.password}),{headers:{'Content-Type':'application/json',Origin:ORIGIN,'X-CSRF-Token':token,Cookie:cookie,'X-Forwarded-For':from},tags:{kind:'login'},responseCallback:http.expectedStatuses(200,429,503)});
 loginTime.add(r.timings.duration);if(r.status===200)loginOk.add(1);if(r.status===503)busy.add(1);if(r.status===429)limited.add(1);
 check(r,{'login 200':x=>x.status===200});
}
