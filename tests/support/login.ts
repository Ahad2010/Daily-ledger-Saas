// Helpers for sign-in tests. The API trusts one proxy hop in tests, so the X-Forwarded-For header chooses which "network" a request comes from.
import {origin} from './api';
import {hashPassword} from '../../apps/api/src/passwords';
export async function passwordUser(api:{user:(f?:any)=>Promise<{id:string}>;pool:{query:(sql:string,args?:unknown[])=>Promise<unknown>}},email:string,password:string){
 const user=await api.user();
 await api.pool.query('UPDATE "User" SET email=$1 WHERE id=$2',[email,user.id]);
 await api.pool.query('INSERT INTO "PasswordCredential" (id,"userId",email,"passwordHash","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,NOW())',[user.id,email,await hashPassword(password)]);
 return user;
}
export async function attempt(base:string,input:{email:string;password:string;ip:string;extraHeaders?:Record<string,string>}){
 const first=await fetch(base+'/auth/csrf',{headers:{'X-Forwarded-For':input.ip}});
 const cookie=(first.headers.get('set-cookie')||'').split(';')[0];const {csrf}=await first.json() as {csrf:string};
 return fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'X-CSRF-Token':csrf,Cookie:cookie,'X-Forwarded-For':input.ip,...(input.extraHeaders||{})},body:JSON.stringify({email:input.email,password:input.password})});
}
