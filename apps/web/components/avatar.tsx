'use client';
import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Camera,Trash2} from 'lucide-react';
import type {Snapshot} from '@ledger/shared';
import {Button} from './ui/button';
import {demoMode,request} from '../lib/data';

const MAX_BYTES=3*1024*1024,TYPES=['image/jpeg','image/png','image/webp'];
export const initialsOf=(name:string)=>name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('')||'DL';
// Shows the profile photo; any load failure falls back to initials so the shell never shows a broken image.
export function AvatarFace({url,name}:{url?:string|null;name:string}){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[url]);
 return url&&!failed?<img src={url} alt="" className="avatar-image" onError={()=>setFailed(true)}/>:<>{initialsOf(name)}</>;
}

interface Signed{apiKey:string;timestamp:number;signature:string;public_id:string;allowed_formats:string;transformation:string;uploadUrl:string}
export function AvatarUpload({s}:{s:Snapshot}){
 const client=useQueryClient(),input=useRef<HTMLInputElement>(null),[message,setMessage]=useState('');
 const config=useQuery({queryKey:['avatar-config'],queryFn:()=>request('/api/profile/avatar') as Promise<{configured:boolean}>,enabled:!demoMode,staleTime:300000});
 const upload=useMutation({
  mutationFn:async(file:File)=>{
   const sign=await request('/api/profile/avatar/sign',{method:'POST'}) as Signed;
   const form=new FormData();form.append('file',file);form.append('api_key',sign.apiKey);form.append('timestamp',String(sign.timestamp));form.append('signature',sign.signature);form.append('public_id',sign.public_id);form.append('allowed_formats',sign.allowed_formats);form.append('transformation',sign.transformation);
   const response=await fetch(sign.uploadUrl,{method:'POST',body:form});
   if(!response.ok)throw new Error('The photo could not be uploaded. Try a different image.');
   const result=await response.json() as {secure_url:string;public_id:string};
   await request('/api/profile/avatar',{method:'PUT',body:JSON.stringify({url:result.secure_url,publicId:result.public_id})});
  },
  onSuccess:async()=>{setMessage('Profile photo updated.');await client.invalidateQueries({queryKey:['snapshot']});},
  onError:(error:Error)=>setMessage(error.message)
 });
 const remove=useMutation({mutationFn:()=>request('/api/profile/avatar',{method:'DELETE'}),onSuccess:async()=>{setMessage('Profile photo removed.');await client.invalidateQueries({queryKey:['snapshot']});},onError:(error:Error)=>setMessage(error.message)});
 if(demoMode||!config.data?.configured)return null;
 const busy=upload.isPending||remove.isPending;
 function choose(file?:File){
  if(!file)return;setMessage('');
  if(!TYPES.includes(file.type)){setMessage('Choose a JPG, PNG or WebP image.');return;}
  if(file.size>MAX_BYTES){setMessage('Choose an image under 3 MB.');return;}
  upload.mutate(file);
 }
 return <div className="avatar-upload"><span className="avatar avatar-large"><AvatarFace url={s.profile.avatarUrl} name={s.profile.name}/></span>
  <div><strong>Profile photo</strong><small>JPG, PNG or WebP, up to 3 MB. It is cropped to a square.</small>
   <div className="inline-actions"><input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp" aria-label="Profile photo file" onChange={e=>{choose(e.target.files?.[0]);e.target.value='';}}/>
    <Button type="button" disabled={busy} onClick={()=>input.current?.click()}><Camera size={15}/>{upload.isPending?'Uploading…':s.profile.avatarUrl?'Change photo':'Upload photo'}</Button>
    {s.profile.avatarUrl&&<Button type="button" disabled={busy} onClick={()=>remove.mutate()}><Trash2 size={15}/>Remove</Button>}</div>
   {message&&<p role="status" className={upload.isError||remove.isError||/^Choose/.test(message)?'error':'mint'}>{message}</p>}</div></div>;
}
