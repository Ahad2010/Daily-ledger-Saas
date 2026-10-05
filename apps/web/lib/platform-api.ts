import {apiBase,ApiError} from './data';
let token='';
export async function platformRequest(path:string,options:RequestInit={}){const response=await fetch(apiBase+path,{...options,credentials:'include',headers:{'Content-Type':'application/json',...(token?{'X-CSRF-Token':token}:{}),...options.headers}});if(!response.ok){const data=await response.json().catch(()=>({}));throw new ApiError(data.error||'Connection unavailable. Try again.',response.status);}return response.status===204?null:response.json();}
export async function bootAdmin(){const me=await platformRequest('/api/admin/me');token=me.csrf;return me;}
export async function bootUser(){const me=await platformRequest('/auth/me');token=me.csrf;return me;}
export async function adminSignIn(email:string,password:string){const csrf=await platformRequest('/auth/csrf');token=csrf.csrf;return platformRequest('/auth/admin/login',{method:'POST',body:JSON.stringify({email,password})});}
