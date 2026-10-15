'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import gsap from 'gsap';
import {money} from '@ledger/shared';
import {donutPalette} from './spending-chart';
// Like a car dashboard at ignition: gauges rev to full and fall back to zero. Cosmetic only; it plays once per page load
// on an empty account and always settles on the real (zero) values.
const IgnitionContext=createContext({active:false,p:0});
let played=false;
export const ignitionSamples={income:4000,expenses:2500,saved:1500,tasks:24};
export function useIgnition(){return useContext(IgnitionContext);}
export function IgnitionProvider({enabled,children}:{enabled:boolean;children:ReactNode}){
 const [state,setState]=useState({active:false,p:0});
 useEffect(()=>{
  if(!enabled||played||typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  played=true;const value={p:0};setState({active:true,p:0});
  const timeline=gsap.timeline({onComplete:()=>setState({active:false,p:0})});
  timeline.to(value,{p:1,duration:.48,ease:'power2.out',onUpdate:()=>setState({active:true,p:value.p})}).to(value,{p:0,duration:.6,delay:.08,ease:'power2.inOut',onUpdate:()=>setState({active:true,p:value.p})});
  return ()=>{timeline.kill();setState({active:false,p:0});};
 },[enabled]);
 return <IgnitionContext.Provider value={state}>{children}</IgnitionContext.Provider>;
}
const R=74,C=2*Math.PI*R,TICKS=60,shares=[.5,.25,.15,.1];
export function IgnitionGauge({currency}:{currency:string}){
 const {p}=useIgnition();let start=0;
 return <div className="ignition-gauge donut-wrap" role="img" aria-label="Your spending gauge is starting up">
  <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
   {Array.from({length:TICKS},(_,i)=>{const a=i/TICKS*2*Math.PI-Math.PI/2;return <line key={i} x1={100+Math.cos(a)*91} y1={100+Math.sin(a)*91} x2={100+Math.cos(a)*(i%5===0?98:95)} y2={100+Math.sin(a)*(i%5===0?98:95)} stroke="#6f7c78" strokeWidth={i%5===0?1.6:1} strokeLinecap="round" style={{opacity:i/TICKS<=p?1:.18}}/>;})}
   <circle cx="100" cy="100" r={R} fill="none" stroke="#1b201e" strokeWidth="22"/>
   <g transform="rotate(-90 100 100)">{shares.map((share,i)=>{const length=share*C,from=start;start+=length;const visible=Math.min(Math.max(p*C-from,0),Math.max(length-3,.5));return <circle key={i} cx="100" cy="100" r={R} fill="none" stroke={donutPalette[i]} strokeWidth="22" strokeDasharray={`${visible} ${C}`} strokeDashoffset={-from}/>;})}</g>
  </svg>
  <div className="donut-center"><span>Total spent</span><span className="donut-value"><strong>{money(Math.round(ignitionSamples.expenses*p)*100,currency)}</strong></span></div>
 </div>;
}
