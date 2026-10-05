// Optional Windows verification helper; normal local setup uses Docker Compose.
import { initdb, pg_ctl } from '../artifacts/pg-test/node_modules/@embedded-postgres/windows-x64/dist/index.js';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('artifacts/postgres-test-data');
const run=(exe,args)=>{const p=spawnSync(exe,args,{stdio:'inherit',windowsHide:true});if(p.status!==0)throw new Error('PostgreSQL command failed. Check artifacts/postgres-test.log.');};
if(process.argv[2]==='stop'){run(pg_ctl,['-D',dir,'-m','fast','stop']);}else{if(!fs.existsSync(path.join(dir,'PG_VERSION')))run(initdb,['-D',dir,'-U','ledger','-A','trust','--encoding=UTF8','--locale=C']);run(pg_ctl,['-D',dir,'-l',path.resolve('artifacts/postgres-test.log'),'-o','-p 5439 -h 127.0.0.1','-w','start']);}
