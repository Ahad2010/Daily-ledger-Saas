'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
type Def={find?:()=>Element|null;title:string;text:string;tips?:string[];sheet?:boolean;drawer?:boolean};
const key='ledger-tour-v1';
const byHref=(href:string)=>()=>document.querySelector(`.sidebar a.nav-link[href="${href}"]`);
const narrowScreen=()=>typeof window!=='undefined'&&window.innerWidth<=640;
// Below 800px the sidebar is a slide-in drawer (same breakpoint as useDrawer). The tour opens it itself and spotlights the real links inside it.
const drawerMode=()=>typeof window!=='undefined'&&window.matchMedia('(max-width:800px)').matches;
const setDrawer=(open:boolean)=>window.dispatchEvent(new CustomEvent('ledger-drawer',{detail:{open}}));
const DRAWER_MS=420;
// Sidebar steps point at the real links. On phones and small tablets the tour opens the drawer for them, then closes it for the steps that live outside it.
const defs:Def[]=[
 {find:()=>document.querySelector('.mobile-menu'),title:'Your menu',text:'Tap here any time to move between Overview, Finance, Tasks, Fitness, Meals, Goals and Settings.'},
 {find:byHref('/'),sheet:true,title:'Overview',text:'Income, spending, savings and tasks in one calm view.',tips:['Change the month at the top to look back.','Tap any card to open the details.']},
 {find:byHref('/today'),sheet:true,title:'Today',text:'Everything due today in one list.',tips:['Tick tasks, habits and meals as you go.','Streaks update on their own.']},
 {find:byHref('/calendar'),sheet:true,title:'Calendar',text:'See tasks, bills, workouts and meals on the days they happen.',tips:['Tap a day to see its plan.']},
 {find:byHref('/finance'),sheet:true,title:'Financial Planner',text:'Income and transactions are free. Pro adds bills, budgets, savings goals and 13 calculators.',tips:['Import a bank CSV from Transactions.','Reports turns a month into a statement.']},
 {find:byHref('/tasks'),sheet:true,title:'Tasks & Habits',text:'Plan the day and build routines that stick.',tips:['Tick a task to finish it. You can undo it for a few seconds.','Habits repeat on the days you choose.']},
 {find:byHref('/fitness'),sheet:true,title:'Fitness',text:'Plan workouts, log sets and watch your records grow.'},
 {find:byHref('/meals'),sheet:true,title:'Meals & Grocery',text:'Log food and water, plan the week and get a grocery list that writes itself.'},
 {find:byHref('/goals'),sheet:true,title:'Life Goals',text:'Give something meaningful a target. Some goal types follow your finance, fitness and habits for you.'},
 {find:byHref('/assistant'),sheet:true,title:'Meet Ledger',text:'Ask in plain words to add a task, log an expense or plan your week. It is part of Pro.',tips:['Nothing changes until you confirm an action.']},
 {find:()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Quick add')||null,title:'Quick add',text:'Add a transaction, task, habit, workout or goal from anywhere.'},
 {find:byHref('/settings'),sheet:true,title:'Settings',text:'Profile, currency, units, notifications, your plan and billing live here.',tips:['The ? button in the top bar explains whichever page you are on.']}
];
// "How this page works" guides, opened from the ? button in the top bar. They are plain cards with no spotlight.
const guides:Record<string,Def[]>={
 '':[{title:'Overview',text:'Your money, routines and progress at a glance.',tips:['Pick the month at the top to look at any period.','Quick add logs a transaction, task, habit, workout or goal.','Suggestions near the bottom point to your next small step.']}],
 today:[{title:'Today',text:'What needs you today, in one place.',tips:['Tick tasks, habits and meals as you finish them.','Use + to add something just for today.']}],
 calendar:[{title:'Calendar',text:'Your plans laid out by day.',tips:['Tap a day to see everything planned.','The week starts on the day you chose in Settings.']}],
 finance:[{title:'Financial Planner',text:'Start with the free basics and grow from there.',tips:['Income and Transactions are free.','Pro adds bills, budgets, savings goals and 13 calculators.','Import a bank CSV from Transactions.']}],
 tasks:[{title:'Tasks & Habits',text:'Four tabs, one rhythm.',tips:['Focus shows what to do now. Tasks lists everything.','Habits repeat on the days you pick. Insights shows your trends.','Finished a task by mistake? Undo it from the notice.']}],
 fitness:[{title:'Fitness',text:'Plan, log and review your training.',tips:['Train plans the week and logs every set.','Progress shows records and body check-ins.','Exercises has guides and a muscle map.']}],
 meals:[{title:'Meals & Grocery',text:'Eat on purpose without the spreadsheet.',tips:['Today logs food and water against your targets.','Plan schedules the week and Groceries builds the list.','Insights compares what you ate with your targets.']}],
 goals:[{title:'Life Goals',text:'Targets that keep themselves honest.',tips:['Pick a goal type. Auto types follow your data and need Pro.','Tap the percentage to set progress by hand.','The weekly check-in shows whether you are on pace.']}],
 assistant:[{title:'Ledger assistant',text:'Ask in plain words.',tips:['Try “Log a $12 lunch today”.','It proposes an action and waits for your confirmation.','Attach a photo of a receipt or a meal to log it faster.']}],
 reports:[{title:'Reports',text:'A month, summarised.',tips:['Choose a month, then export a CSV.','PDF statements and full history are part of Pro.']}],
 plans:[{title:'Plans',text:'Compare before you choose.',tips:['Request Pro or Lifetime and our team activates it, usually within a business day.']}],
 help:[{title:'Help',text:'Answers first, people second.',tips:['Search the questions, or open a guide card.','Still stuck? Send a message from the support section.']}],
 settings:[{title:'Settings',text:'Make Daily Ledger yours.',tips:['General holds your profile, currency, units and theme.','Plan & billing shows what you are using.','Data lets you export everything.']}]
};
const seen=()=>{try{return localStorage.getItem(key)==='done';}catch{return true;}};
const remember=()=>{try{localStorage.setItem(key,'done');}catch{/* the tour simply shows again next time */}};
// Auto-starts once for an account that has just finished onboarding; Settings can replay it at any time.
export function ProductTour({ready,onboardedAt}:{ready:boolean;onboardedAt:string|null|undefined}){
 const [steps,setSteps]=useState<Def[]>([]);const [index,setIndex]=useState(-1);const [invite,setInvite]=useState(false);
 const layer=useRef<HTMLDivElement>(null),spot=useRef<HTMLDivElement>(null),card=useRef<HTMLDivElement>(null),first=useRef(true);
 const begin=useCallback((list:Def[])=>{if(list.length){first.current=true;setSteps(list);setIndex(0);}},[]);
 const start=useCallback((page?:string)=>{
  if(page!==undefined){begin(guides[page]||[]);return;}
  const visible=(d:Def)=>{const el=d.find?.();if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0;};
  if(drawerMode()){
   // Drawer steps first (the drawer opens by itself), then the controls that sit outside it, ending on the menu button that reopens it.
   const inDrawer=defs.filter(d=>d.sheet&&d.find?.()).map(d=>({...d,sheet:false,drawer:true}));
   const outside=defs.filter(d=>!d.sheet&&d.title!=='Your menu'&&visible(d));
   const menu=defs.filter(d=>d.title==='Your menu'&&visible(d));
   begin([...inDrawer,...outside,...menu]);return;
  }
  begin(defs.filter(visible));
 },[begin]);
 const drawerOpen=useRef(false),drawerReadyAt=useRef(0);
 const close=useCallback(()=>{remember();if(drawerOpen.current){drawerOpen.current=false;setDrawer(false);}setIndex(-1);setSteps([]);},[]);
 // A new account is first offered the tour (nothing starts by itself). The offer waits until any other dialog, such as a plan or trial pop-up, has been dealt with.
 useEffect(()=>{
  if(!ready)return;const recent=!!onboardedAt&&Date.now()-new Date(onboardedAt).getTime()<15*60*1000;
  let timer:ReturnType<typeof setTimeout>|undefined,waits=0;
  const offer=()=>{if(document.querySelector('[role="dialog"]:not(.tour-card),[role="alertdialog"]')&&waits++<75){timer=setTimeout(offer,800);return;}setInvite(true);};
  if(recent&&!seen())timer=setTimeout(offer,2400);
  const replay=(e:Event)=>{setInvite(false);start((e as CustomEvent<{page?:string}>).detail?.page);};window.addEventListener('ledger-tour',replay);
  return()=>{clearTimeout(timer);window.removeEventListener('ledger-tour',replay);};
 },[ready,onboardedAt,start]);
 const accept=useCallback(()=>{setInvite(false);start();},[start]);
 const decline=useCallback(()=>{remember();setInvite(false);},[]);
 useEffect(()=>{if(!invite)return;const keys=(e:KeyboardEvent)=>{if(e.key==='Escape')decline();};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[invite,decline]);
 const place=useCallback(()=>{
  const def=steps[index];const s=spot.current,c=card.current,l=layer.current;if(!def||!s||!c||!l)return;
  const narrow=window.innerWidth<=640,el=def.find?.()||null,sheet=!el||(!!def.sheet&&narrow),cw=Math.min(narrow?420:360,window.innerWidth-24);gsap.set(c,{width:cw});const ch=c.offsetHeight;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  l.classList.toggle('is-sheet',sheet);
  if(sheet){
   const left=(window.innerWidth-cw)/2,top=window.innerHeight-ch-(narrow?14:28);
   gsap.set(s,{autoAlpha:0});
   if(first.current||reduced){gsap.set(c,{left,top,width:cw});first.current=false;gsap.fromTo(c,{opacity:0,y:14},{opacity:1,y:0,duration:reduced?0:.35,ease:'power2.out'});}
   else gsap.to(c,{left,top,width:cw,duration:.4,ease:'power3.inOut'});
   return;
  }
  const r=el!.getBoundingClientRect(),pad=6;
  const box={left:r.left-pad,top:r.top-pad,width:r.width+pad*2,height:r.height+pad*2};
  let left:number,top:number;
  if(narrow){left=12;top=r.bottom+pad+14>window.innerHeight-ch-12?window.innerHeight-ch-16:r.bottom+pad+14;}
  else if(r.left<320){left=r.right+pad+16;top=Math.min(Math.max(r.top-8,12),window.innerHeight-ch-12);}
  else{left=Math.min(Math.max(r.right-cw,12),window.innerWidth-cw-12);top=Math.min(r.bottom+pad+14,window.innerHeight-ch-12);}
  gsap.set(s,{autoAlpha:1});
  if(first.current||reduced){gsap.set(s,box);gsap.set(c,{left,top,width:cw});first.current=false;gsap.fromTo(c,{opacity:0,y:10},{opacity:1,y:0,duration:reduced?0:.35,ease:'power2.out'});}
  else{gsap.to(s,{...box,duration:.5,ease:'power3.inOut'});gsap.to(c,{left,top,width:cw,duration:.5,ease:'power3.inOut'});}
 },[steps,index]);
 useLayoutEffect(()=>{
  if(index<0)return;
  // Open or close the drawer as the steps need it, and place the spotlight only once its slide animation has finished.
  // The ready time lives in a ref, so a repeated effect run (React StrictMode in dev) still waits for the animation.
  const mobile=drawerMode(),want=!!steps[index]?.drawer;
  if(mobile&&want!==drawerOpen.current){drawerOpen.current=want;setDrawer(want);drawerReadyAt.current=Date.now()+(window.matchMedia('(prefers-reduced-motion: reduce)').matches?60:DRAWER_MS);}
  const run=()=>{if(!(steps[index]?.sheet&&narrowScreen()))steps[index]?.find?.()?.scrollIntoView({block:'nearest'});place();};
  const wait=mobile?drawerReadyAt.current-Date.now():0;
  if(wait>0){const t=setTimeout(run,wait);return()=>clearTimeout(t);}
  run();
 },[index,steps,place]);
 useEffect(()=>{
  if(index<0)return;const resize=()=>place();const keys=(e:KeyboardEvent)=>{if(e.key==='Escape')close();else if(e.key==='ArrowRight')setIndex(i=>Math.min(i+1,steps.length-1));else if(e.key==='ArrowLeft')setIndex(i=>Math.max(i-1,0));};
  window.addEventListener('resize',resize);window.addEventListener('keydown',keys);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('keydown',keys);};
 },[index,steps.length,place,close]);
 if(invite&&index<0)return <div className="tour-offer"><div className="tour-card tour-invite" role="dialog" aria-label="Tour invitation" aria-live="polite"><button className="tour-close" aria-label="Not now" onClick={decline}><X size={15}/></button><span className="tour-count">Welcome</span><h3>Want a quick tour?</h3><p>A one-minute walkthrough of Daily Ledger: where everything lives and how to add your first task, expense or habit.</p><div className="tour-actions"><button className="tour-skip" onClick={decline}>Maybe later</button><button className="tour-next" onClick={accept}>Yes, show me<ArrowRight size={15}/></button></div></div></div>;
 if(index<0||!steps[index])return null;
 const step=steps[index],last=index===steps.length-1;
 return <div ref={layer} className="tour-layer"><div ref={spot} className="tour-spot" aria-hidden="true"/>
  <div ref={card} className="tour-card" role="dialog" aria-label="Product tour" aria-live="polite"><button className="tour-close" aria-label="Skip tour" onClick={close}><X size={15}/></button>
   <span className="tour-count">{steps.length>1?`Step ${index+1} of ${steps.length}`:'How this page works'}</span><h3>{step.title}</h3><p>{step.text}</p>{step.tips&&<ul className="tour-tips">{step.tips.map(t=><li key={t}>{t}</li>)}</ul>}
   {steps.length>1&&<div className="tour-dots" aria-hidden="true" data-many={steps.length>8?'true':undefined}>{steps.map((_,i)=><i key={i} className={i===index?'on':''}/>)}</div>}
   <div className="tour-actions"><button className="tour-skip" onClick={close}>Skip tour</button><span>{index>0&&<button className="tour-back" onClick={()=>setIndex(index-1)} aria-label="Previous step"><ArrowLeft size={15}/></button>}<button className="tour-next" onClick={()=>last?close():setIndex(index+1)}>{last?'Done':'Next'}{!last&&<ArrowRight size={14}/>}</button></span></div>
  </div></div>;
}
