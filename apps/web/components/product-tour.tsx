'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
type Def={find:()=>Element|null;title:string;text:string};
const key='ledger-tour-v1';
const byHref=(href:string)=>()=>document.querySelector(`.sidebar a[href="${href}"]`);
const defs:Def[]=[
 {find:byHref('/'),title:'Your overview',text:'Income, spending, tasks and goals in one calm view.'},
 {find:byHref('/finance'),title:'Financial Planner',text:'Budgets, bills and savings, with a live pace line against your plan.'},
 {find:byHref('/tasks'),title:'Tasks & habits',text:'Plan the day and build routines that stick.'},
 {find:byHref('/assistant'),title:'Meet Ledger',text:'Chat to add a task, log an expense or plan your week.'},
 {find:()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Quick add')||null,title:'Quick add',text:'Add a transaction, task, habit, workout or goal from anywhere.'},
 {find:byHref('/settings'),title:'Settings',text:'Profile, notifications, your plan and billing live here.'}
];
const seen=()=>{try{return localStorage.getItem(key)==='done';}catch{return true;}};
const remember=()=>{try{localStorage.setItem(key,'done');}catch{/* the tour simply shows again next time */}};
// Auto-starts once for an account that has just finished onboarding; Settings can replay it at any time.
export function ProductTour({ready,onboardedAt}:{ready:boolean;onboardedAt:string|null|undefined}){
 const [steps,setSteps]=useState<Def[]>([]);const [index,setIndex]=useState(-1);
 const spot=useRef<HTMLDivElement>(null),card=useRef<HTMLDivElement>(null),first=useRef(true);
 const start=useCallback(()=>{const usable=defs.filter(d=>{const el=d.find();if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;});if(usable.length){first.current=true;setSteps(usable);setIndex(0);}},[]);
 const close=useCallback(()=>{remember();setIndex(-1);setSteps([]);},[]);
 useEffect(()=>{
  if(!ready)return;const recent=!!onboardedAt&&Date.now()-new Date(onboardedAt).getTime()<15*60*1000;
  const timer=recent&&!seen()?setTimeout(start,2400):undefined;const replay=()=>start();window.addEventListener('ledger-tour',replay);
  return()=>{clearTimeout(timer);window.removeEventListener('ledger-tour',replay);};
 },[ready,onboardedAt,start]);
 const place=useCallback(()=>{
  const el=steps[index]?.find();const s=spot.current,c=card.current;if(!el||!s||!c)return;
  const r=el.getBoundingClientRect(),pad=6,narrow=window.innerWidth<=640,cw=Math.min(340,window.innerWidth-24),ch=c.offsetHeight;
  const box={left:r.left-pad,top:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};
  let left:number,top:number;
  if(narrow){left=12;top=window.innerHeight-ch-16;}
  else if(r.left<320){left=r.right+pad+16;top=Math.min(Math.max(r.top-8,12),window.innerHeight-ch-12);}
  else{left=Math.min(Math.max(r.right-cw,12),window.innerWidth-cw-12);top=Math.min(r.bottom+pad+14,window.innerHeight-ch-12);}
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(first.current||reduced){gsap.set(s,box);gsap.set(c,{left,top,width:cw});first.current=false;gsap.fromTo(c,{opacity:0,y:10},{opacity:1,y:0,duration:reduced?0:.35,ease:'power2.out'});}
  else{gsap.to(s,{...box,duration:.5,ease:'power3.inOut'});gsap.to(c,{left,top,width:cw,duration:.5,ease:'power3.inOut'});}
 },[steps,index]);
 useLayoutEffect(()=>{if(index<0)return;steps[index]?.find()?.scrollIntoView({block:'nearest'});place();},[index,steps,place]);
 useEffect(()=>{
  if(index<0)return;const resize=()=>place();const keys=(e:KeyboardEvent)=>{if(e.key==='Escape')close();else if(e.key==='ArrowRight')setIndex(i=>Math.min(i+1,steps.length-1));else if(e.key==='ArrowLeft')setIndex(i=>Math.max(i-1,0));};
  window.addEventListener('resize',resize);window.addEventListener('keydown',keys);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('keydown',keys);};
 },[index,steps.length,place,close]);
 if(index<0||!steps[index])return null;
 const step=steps[index],last=index===steps.length-1;
 return <div className="tour-layer"><div ref={spot} className="tour-spot" aria-hidden="true"/>
  <div ref={card} className="tour-card" role="dialog" aria-label="Product tour" aria-live="polite"><button className="tour-close" aria-label="Skip tour" onClick={close}><X size={15}/></button>
   <span className="tour-count">Step {index+1} of {steps.length}</span><h3>{step.title}</h3><p>{step.text}</p>
   <div className="tour-dots" aria-hidden="true">{steps.map((_,i)=><i key={i} className={i===index?'on':''}/>)}</div>
   <div className="tour-actions"><button className="tour-skip" onClick={close}>Skip tour</button><span>{index>0&&<button className="tour-back" onClick={()=>setIndex(index-1)} aria-label="Previous step"><ArrowLeft size={15}/></button>}<button className="tour-next" onClick={()=>last?close():setIndex(index+1)}>{last?'Done':'Next'}{!last&&<ArrowRight size={14}/>}</button></span></div>
  </div></div>;
}
