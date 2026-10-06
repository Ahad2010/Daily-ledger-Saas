import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
const lock=createServer();let child;
lock.on('error',error=>{if(error.code==='EADDRINUSE'){console.log('Using the existing local reminder worker.');process.exit(0);}throw error;});
lock.listen(4013,'127.0.0.1',async()=>{console.log('Local notification worker ready (checks every minute).');while(true){await new Promise(resolve=>{child=spawn(process.execPath,['--import','tsx','src/worker.ts'],{stdio:'inherit',windowsHide:true,cwd:'apps/api'});child.once('exit',resolve);child.once('error',error=>{console.error(error.message);resolve();});});await new Promise(resolve=>setTimeout(resolve,60000));}});
function stop(){child?.kill();lock.close();process.exit();}process.on('SIGINT',stop);process.on('SIGTERM',stop);
