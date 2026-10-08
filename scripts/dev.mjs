// Keep the local API and frontend in the same terminal lifecycle.
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {parse} from 'dotenv';
import {createConnection} from 'node:net';
const children=[];
const config=existsSync('apps/api/.env')?parse(readFileSync('apps/api/.env')):{};
const apiPort=Number(config.PORT||4000);
function listening(port,host='127.0.0.1'){return new Promise(resolve=>{const socket=createConnection({port,host});socket.setTimeout(500);socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>{socket.destroy();resolve(false);});socket.once('timeout',()=>{socket.destroy();resolve(false);});});}
function run(args){const child=spawn(process.execPath,args,{stdio:'inherit',windowsHide:true});children.push(child);child.on('error',error=>console.error(error.message));return child;}
const npm=process.env.npm_execpath;
if(!npm)throw new Error('Start this script with npm run dev.');
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)if(child.pid&&!child.killed&&child.exitCode===null&&child.signalCode===null){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');}process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
if(!(await listening(apiPort))){
 if(config.DATABASE_URL){const database=new URL(config.DATABASE_URL);if(['127.0.0.1','localhost'].includes(database.hostname)&&database.port==='5439'&&!(await listening(5439))&&existsSync('artifacts/pg-test/node_modules/@embedded-postgres/windows-x64/dist/index.js')){
  console.log('Starting the existing local PostgreSQL workspace…');run(['scripts/local-postgres.mjs']);
  for(let attempt=0;attempt<180&&!(await listening(5439));attempt++)await new Promise(resolve=>setTimeout(resolve,500));
 }}
 console.log('Starting Daily Ledger API…');run([npm,'run','dev','-w','@ledger/api']);
}else console.log('Using the existing local API.');
if(await listening(3000))console.log('Using the existing frontend on http://localhost:3000.');
else{const web=run([npm,'run','dev','-w','@ledger/web']);web.on('exit',()=>stop());}
if(await listening(3003))console.log('Using the existing administrator frontend on http://localhost:3003/admin.');
else run([npm,'run','dev','-w','@ledger/admin']);
run(['scripts/dev-worker.mjs']);
async function ready(url){const deadline=Date.now()+180000;while(Date.now()<deadline){try{const response=await fetch(url,{signal:AbortSignal.timeout(5000)});if(response.ok)return true;}catch{/* Startup/first route compilation can still be pending. */}await new Promise(resolve=>setTimeout(resolve,1000));}return false;}
const [apiReady,webReady,adminReady]=await Promise.all([ready(`http://127.0.0.1:${apiPort}/ready`),ready('http://127.0.0.1:3000/login'),ready('http://127.0.0.1:3003/admin/login')]);
console.log(apiReady&&webReady&&adminReady?'Daily Ledger is ready: app http://localhost:3000 · admin http://localhost:3003/admin':`Startup needs attention: API ${apiReady?'ready':'unavailable'}, frontend ${webReady?'ready':'unavailable'}, admin ${adminReady?'ready':'unavailable'}. Check the errors above.`);
