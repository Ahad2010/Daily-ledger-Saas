'use client';
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {XCircle} from 'lucide-react';
import {request} from '../lib/data';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';
import HoldButton from './hold-button';

// Cancelling moves the account to Free right away. Records stay; Free limits apply to new items only.
export function CancelSubscription({trial,onDone}:{trial:boolean;onDone:()=>void}){
 const [open,setOpen]=useState(false);const client=useQueryClient();
 const cancel=useMutation({mutationFn:()=>request('/api/billing/cancel',{method:'POST'}),onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:['snapshot']}),client.invalidateQueries({queryKey:['billing']})]);setOpen(false);onDone();}});
 const noun=trial?'trial':'Pro subscription';
 return <div className="cancel-subscription"><div><strong>{trial?'End your trial':'Cancel subscription'}</strong><p>Move back to the Free plan. You will not be charged again, and you can upgrade whenever you like.</p></div>
  <Button onClick={()=>{cancel.reset();setOpen(true);}}><XCircle size={15}/>{trial?'End trial':'Cancel plan'}</Button>
  <Dialog open={open} onOpenChange={v=>{if(!cancel.isPending)setOpen(v);}} title={`Cancel your ${noun}?`} description="Press and hold the button to confirm.">
   <ul className="cancel-list"><li>You return to the Free plan immediately.</li><li>No further charges are made once you cancel.</li><li>Your tasks, goals, meals and finance records stay. Free limits apply to new items only.</li><li>Paid tools such as guides, PDF reports and history lock until you upgrade again.</li></ul>
   {cancel.isError&&<p className="error" role="alert">{cancel.error.message}</p>}
   <div className="dialog-actions"><Button onClick={()=>setOpen(false)} disabled={cancel.isPending}>Keep my plan</Button>
    <HoldButton key={cancel.isError?`failed-${cancel.failureCount}`:'ready'} size="md" radius={10} holdTime={1300} releaseTime={180} backgroundColor="#1d1411" fillColor="#e5533d" textColor="#ffb4a8" fillTextColor="#ffffff" waveAmplitude={5} resetAfter={0} disabled={cancel.isPending} icon={<XCircle size={15}/>} doneLabel="Cancelling…" onHold={()=>cancel.mutate()}>Hold to cancel plan</HoldButton></div>
  </Dialog></div>;
}
