'use client';
import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ShieldAlert,LogOut,RefreshCw} from 'lucide-react';
import {adapter,request} from '../lib/data';
import {BrandMark} from './brand-mark';
import {SupportDesk} from './support-center';
import {Button} from './ui/button';
export function BannedAccount(){
 const client=useQueryClient();const [notice,setNotice]=useState('');
 const access=useQuery({queryKey:['banned-access'],queryFn:async()=>{const me=await request('/auth/me');if(me.user.status==='active'){await client.invalidateQueries({queryKey:['account-access']});await client.invalidateQueries({queryKey:['snapshot']});}return me;},refetchInterval:15000});
 return <main className="banned-account"><header><BrandMark/><Button onClick={async()=>{try{await adapter.logout();client.clear();window.location.assign('/login');}catch(e){setNotice((e as Error).message);}}}><LogOut size={15}/>Log out</Button></header><section className="panel banned-notice"><ShieldAlert size={32}/><span className="eyebrow">ACCOUNT ACCESS</span><h1>Your account is banned</h1><p>Your workspace is unavailable. Contact customer support below to ask for a review. You can send messages and read the administrator’s replies here.</p><a className="button primary" href="#support-tickets">Contact customer support</a><Button disabled={access.isFetching} onClick={()=>void access.refetch()}><RefreshCw size={15}/>Check account access</Button>{(notice||access.isError)&&<p role="alert" className="error">{notice||access.error?.message}</p>}</section><SupportDesk account={access.data?.user.email||'restricted-account'}/></main>;
}
