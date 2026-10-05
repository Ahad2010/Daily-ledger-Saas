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
function stop(){if(stopping)return;stopping=true;for(const child of children)if(child.pid&&!child.killed){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(child.pid),'/t','/f'],{stdio:'ignore',windowsHide:true});else child.kill('SIGTERM');}process.exit();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
if(!(await listening(apiPort))){
 if(config.DATABASE_URL){const database=new URL(config.DATABASE_URL);if(['127.0.0.1','localhost'].includes(database.hostname)&&database.port==='5439'&&!(await listening(5439))&&existsSync('artifacts/pg-test/node_modules/@embedded-postgres/windows-x64/dist/index.js')){
  console.log('Starting the existing local PostgreSQL workspace…');run(['scripts/local-postgres.mjs']);
  for(let attempt=0;attempt<180&&!(await listening(5439));attempt++)await new Promise(resolve=>setTimeout(resolve,500));
 }}
 console.log('Starting Daily Ledger API…');run([npm,'run','dev','-w','@ledger/api']);
 for(let attempt=0;attempt<120&&!(await listening(apiPort));attempt++)await new Promise(resolve=>setTimeout(resolve,500));
 if(!(await listening(apiPort)))console.warn('API is not ready. Check apps/api/.env and PostgreSQL; login needs the API.');
}else console.log('Using the existing local API.');
const web=run([npm,'run','dev','-w','@ledger/web']);web.on('exit',()=>stop());
