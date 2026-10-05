import { scrypt,randomBytes,timingSafeEqual,createHash,createHmac } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
export async function hashPassword(password:string){const salt=randomBytes(24).toString('hex');const key=await derive(password,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,stored:string|undefined){const [,salt,key]=stored?.split(':')||['scrypt','0'.repeat(48),'0'.repeat(128)];const computed=await derive(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return !!stored&&expected.length===computed.length&&timingSafeEqual(expected,computed);}
export const resetToken=(id:string,userId:string)=>createHmac('sha256',process.env.SESSION_SECRET!).update(`password-reset:${id}:${userId}`).digest('hex');
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function matchesReset(token:string,hash:string){const actual=Buffer.from(tokenHash(token));const expected=Buffer.from(hash);return actual.length===expected.length&&timingSafeEqual(actual,expected);}
