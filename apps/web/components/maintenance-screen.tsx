'use client';
import {useRef} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {RefreshCw,Wrench} from 'lucide-react';
import {BrandMark} from './brand-mark';
import {Button} from './ui/button';
export function MaintenanceScreen({message,until,checking,onRetry}:{message:string;until:string|null;checking:boolean;onRetry:()=>void}){
 const root=useRef<HTMLElement>(null);
 useGSAP(()=>{const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from('.mt-orb',{scale:.4,opacity:0,duration:.8,ease:'back.out(1.7)'});gsap.from('.mt-copy > *',{opacity:0,y:14,duration:.5,stagger:.08,delay:.25,ease:'power2.out'});gsap.to('.mt-orb',{y:-6,duration:2.4,ease:'sine.inOut',repeat:-1,yoyo:true,delay:.9});});return()=>mm.revert();},{scope:root});
 const back=until?new Date(until).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):null;
 return <main ref={root} className="maintenance-screen" role="status" aria-label="Daily Ledger is under maintenance">
  <BrandMark/><span className="mt-orb" aria-hidden="true"><Wrench size={30}/></span>
  <div className="mt-copy"><h1>We’ll be right back</h1><p>{message||'Daily Ledger is getting a quick tune-up. Please check back in a few minutes.'}</p>{back&&<p className="mt-eta">Expected back around <strong>{back}</strong></p>}<p className="mt-safe">Your data is safe. Nothing is lost while we work.</p><Button onClick={onRetry} disabled={checking}><RefreshCw size={15}/>{checking?'Checking…':'Check again'}</Button></div>
 </main>;
}
