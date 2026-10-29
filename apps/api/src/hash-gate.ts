// Password hashing is deliberately expensive (about 64 MB and tens of milliseconds each). A flood of sign-in attempts must not
// starve everyone else, so only a few hashes run at once, each source (IP address) may hold only a small share of the line,
// and whatever does not fit is turned away at once instead of piling up in memory.
export class HashBusyError extends Error{
 status=503;expose=true;retryAfter=3;
 constructor(){super('Signing in is busy right now. Please try again in a few seconds.');}
}
export function createHashGate(options:{concurrency:number;queue:number;perSource:number}){
 let running=0;const waiting:Array<()=>void>=[],held=new Map<string,number>();
 const acquire=()=>running<options.concurrency?(running++,Promise.resolve()):new Promise<void>(resolve=>waiting.push(resolve));
 // The next in line takes over the slot directly, so the running count never dips between jobs.
 const release=()=>{const next=waiting.shift();if(next)next();else running--;};
 return {
  async run<T>(source:string|undefined,work:()=>Promise<T>):Promise<T>{
   const key=source||'';
   if(key&&(held.get(key)||0)>=options.perSource)throw new HashBusyError();
   if(running>=options.concurrency&&waiting.length>=options.queue)throw new HashBusyError();
   if(key)held.set(key,(held.get(key)||0)+1);
   try{await acquire();try{return await work();}finally{release();}}
   finally{if(key){const left=(held.get(key)||1)-1;if(left>0)held.set(key,left);else held.delete(key);}}
  },
  stats:()=>({running,waiting:waiting.length,sources:held.size})
 };
}
const num=(name:string,fallback:number)=>{const n=Number(process.env[name]);return Number.isInteger(n)&&n>=0&&process.env[name]?.trim()?n:fallback;};
// 4 matches Node's default thread pool, which is what scrypt runs on. All three can be tuned with variables; the defaults suit a small API.
export const hashGate=createHashGate({concurrency:Math.max(1,num('HASH_CONCURRENCY',4)),queue:num('HASH_QUEUE',40),perSource:Math.max(1,num('HASH_PER_SOURCE',6))});
