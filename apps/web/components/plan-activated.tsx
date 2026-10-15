'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowRight,Check} from 'lucide-react';
import {plans,type Snapshot} from '@ledger/shared';
import {LedgerLoader} from './skeleton';
const POLL_MS=3000,MAX_POLLS=30;
const confetti=Array.from({length:28},(_,i)=>({angle:i/28*360,distance:120+(i*37)%90,size:6+(i*5)%7,color:['#b6f26b','#2dd4a3','#4cc3ff','#9b8cff','#ffb072'][i%5],delay:(i%7)*.03}));
function benefits(plan:'Pro'|'Lifetime'){
 const p=plans[plan];
 return ['Unlimited tasks, habits, goals and transactions',`${p.automations} email automation rules`,`${p.emails} reminder emails every month`,'PDF reports and your full monthly history','Recurring entries, premium exercise and meal guides','Your place in the referral ranking'];
}
// The plan shown here always comes from the server snapshot. A redirect or query string can never activate a plan by itself.
export function PlanActivated({s}:{s:Snapshot}){
 const client=useQueryClient();const root=useRef<HTMLDivElement>(null);const [polls,setPolls]=useState(0);
 const plan=s.profile.plan;const trial=s.planDetails?.source==='trial';const active=plan!=='Free';
 useEffect(()=>{if(active||polls>=MAX_POLLS)return;const timer=setTimeout(async()=>{await client.invalidateQueries({queryKey:['snapshot']});setPolls(n=>n+1);},POLL_MS);return()=>clearTimeout(timer);},[active,polls,client]);
 useGSAP(()=>{
  if(!active||!root.current)return;const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const tl=gsap.timeline({defaults:{ease:'power3.out'}});
   tl.from('.pa-ring',{scale:.3,opacity:0,duration:.7,ease:'back.out(1.8)'}).from('.pa-check path',{strokeDashoffset:30,duration:.5,ease:'power2.inOut'},'-=.2')
    .from('.pa-halo',{scale:.6,opacity:0,duration:.9},'-=.5').from('.pa-copy > *',{opacity:0,y:16,duration:.5,stagger:.09},'-=.5').from('.pa-benefits li',{opacity:0,x:-14,duration:.4,stagger:.07},'-=.2').from('.pa-actions > *',{opacity:0,y:10,duration:.4,stagger:.08},'-=.2');
   gsap.fromTo('.pa-confetti i',{x:0,y:0,opacity:1,scale:0},{x:(i)=>Math.cos(confetti[i].angle*Math.PI/180)*confetti[i].distance,y:(i)=>Math.sin(confetti[i].angle*Math.PI/180)*confetti[i].distance+30,rotation:(i)=>confetti[i].angle*2,scale:1,opacity:0,duration:1.5,ease:'power2.out',delay:.35,stagger:{each:.012}});
  });
  return()=>mm.revert();
 },{scope:root,dependencies:[active,plan]});
 if(!active){
  const waited=polls>=MAX_POLLS;
  return <section className="plan-activated is-pending" aria-live="polite">{waited?<><h2>This is taking longer than usual</h2><p>We have not received the payment confirmation yet. Your plan activates automatically the moment your payment provider confirms it. You can keep using Daily Ledger in the meantime.</p><div className="pa-actions"><Link className="button primary" href="/">Go to dashboard<ArrowRight size={15}/></Link><Link className="button" href="/help">Contact support</Link></div></>:<><LedgerLoader label="Confirming your payment…"/><p className="pa-note">This usually takes a few seconds. Your plan activates only after the payment provider confirms the payment.</p></>}</section>;
 }
 const lifetime=plan==='Lifetime';const days=trial&&s.planDetails?.trial?.endsAt?Math.max(Math.ceil((new Date(s.planDetails.trial.endsAt).getTime()-Date.now())/86400000),0):null;
 const title=trial?'Your 7-day Pro trial is active':lifetime?'Lifetime access is yours':'Your Pro plan is active';
 const sub=trial?`${days??7} ${days===1?'day':'days'} left. Everything in Pro is unlocked, no card needed.`:lifetime?'Pay once, plan forever. Every Daily Ledger feature is unlocked for good.':'Thank you. Every Pro feature is unlocked and ready to use.';
 return <section ref={root} className="plan-activated" aria-live="polite"><div className="pa-stage"><span className="pa-halo" aria-hidden="true"/><span className="pa-confetti" aria-hidden="true">{confetti.map((c,i)=><i key={i} style={{width:c.size,height:c.size,background:c.color}}/>)}</span><span className="pa-ring"><svg className="pa-check" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5L10 17.5L19 7" stroke="#06140d" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30"/></svg></span></div>
  <div className="pa-copy"><span className="pa-badge">{trial?'PRO TRIAL':plan.toUpperCase()}</span><h2>{title}</h2><p>{sub}</p></div>
  <ul className="pa-benefits">{benefits(plan as 'Pro'|'Lifetime').map(text=><li key={text}><span><Check size={14}/></span>{text}</li>)}</ul>
  <div className="pa-actions"><Link className="button primary" href="/">Go to your dashboard<ArrowRight size={15}/></Link><Link className="button" href="/settings?tab=billing">Billing & invoices</Link></div></section>;
}
