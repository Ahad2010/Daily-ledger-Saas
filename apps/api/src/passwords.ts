import { scrypt,randomBytes,timingSafeEqual,createHash,createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt) as (password:string,salt:string,keylen:number,options?:{N?:number;r?:number;p?:number;maxmem?:number})=>Promise<Buffer>;
// New hashes record their own cost, so the cost can be raised later without locking anyone out. Older "scrypt:" hashes (Node defaults)
// still verify and are upgraded the next time that person signs in. 2^16 / r=8 / p=2 is one of OWASP's equivalent scrypt settings (about 64 MB).
const COST={log2n:16,r:8,p:2},MAXMEM=256*1024*1024;
type Cost=typeof COST;
const run=(password:string,salt:string,cost:Cost)=>derive(password,salt,64,{N:2**cost.log2n,r:cost.r,p:cost.p,maxmem:MAXMEM});
export async function hashPassword(password:string){const salt=randomBytes(24).toString('hex');const key=await run(password,salt,COST);return `scrypt2:${COST.log2n}:${COST.r}:${COST.p}:${salt}:${key.toString('hex')}`;}
function parse(stored:string|undefined){
 const part=stored?.split(':')||[];
 if(part[0]==='scrypt2'&&part.length===6){const cost={log2n:Number(part[1]),r:Number(part[2]),p:Number(part[3])};if(Number.isInteger(cost.log2n)&&cost.log2n>=14&&cost.log2n<=18&&cost.r===8&&cost.p>=1&&cost.p<=4)return {cost,salt:part[4],key:part[5]};}
 if(part[0]==='scrypt'&&part.length===3)return {cost:null,salt:part[1],key:part[2]};
 return null;
}
export async function verifyPassword(password:string,stored:string|undefined){
 const parsed=parse(stored);
 // An unknown account is checked against a dummy hash at the current cost, so the response time does not reveal whether it exists.
 const {cost,salt,key}=parsed||{cost:COST,salt:'0'.repeat(48),key:'0'.repeat(128)};
 const computed=cost?await run(password,salt,cost):await derive(password,salt,64);
 const expected=Buffer.from(key,'hex');
 return !!parsed&&expected.length===computed.length&&timingSafeEqual(expected,computed);
}
export const needsRehash=(stored:string|undefined)=>{const parsed=parse(stored);return !!parsed&&(!parsed.cost||parsed.cost.log2n<COST.log2n||parsed.cost.p<COST.p);};
export const resetToken=(id:string,userId:string)=>createHmac('sha256',process.env.SESSION_SECRET!).update(`password-reset:${id}:${userId}`).digest('hex');
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function matchesReset(token:string,hash:string){const actual=Buffer.from(tokenHash(token));const expected=Buffer.from(hash);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
