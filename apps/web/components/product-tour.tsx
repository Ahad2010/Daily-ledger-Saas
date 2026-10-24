'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {ArrowLeft,ArrowRight,X} from 'lucide-react';
type Def={find?:()=>Element|null;before?:()=>void;title:string;text:string;tips?:string[];sheet?:boolean;drawer?:boolean};
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
const q=(sel:string)=>()=>document.querySelector(sel);
const tab=(label:string)=>()=>{const b=Array.from(document.querySelectorAll<HTMLElement>('.meals-tabs button,[role=tab]')).find(x=>x.textContent?.trim().startsWith(label)&&x.getAttribute('aria-selected')!=='true');b?.click();};
const after=(sel:string)=>()=>document.querySelector(sel);
const guides:Record<string,Def[]>={
 '':[{find:q('.page-heading'),title:'Your overview',text:'The whole month in one calm view.',tips:['Pick the month at the top to look back.']},{find:q('.page-controls .button.primary'),title:'Quick add',text:'One button logs a transaction, task, habit, workout or goal.'},{find:q('.sidebar'),sheet:true,title:'Move around',text:'Finance, Tasks, Fitness, Meals and Goals each have their own page. Open any of them from the menu.'},{title:'Suggestions',text:'Near the bottom you will see a gentle next step. Tap it to do it, or dismiss it.'}],
 today:[{find:q('.today-hero'),title:'Your day at a glance',text:'The ring shows how much of today is done. It fills as you tick things off.'},{find:q('.today-list'),title:'Tick as you go',text:'Tasks, habits, meals and workouts due today are in one list.',tips:['A finished workout stays finished, so your XP is safe.']},{find:q('.add-fab'),title:'Add something',text:'Use + to add something just for today.'},{find:q('.today-review'),title:'Weekly review',text:'See what went well and what to watch next week.'}],
 calendar:[{find:q('.cal-controls'),title:'Switch the view',text:'Look at a month or a single week.'},{find:q('.calendar-panel'),title:'Everything on its day',text:'Tasks, bills, workouts and meals sit on the day they happen.',tips:['Tap a day to open its plan.']},{find:q('.cal-tray'),title:'The tray',text:'Pick an unscheduled item, then tap a day to place it there.'},{find:q('.page-controls .button.primary'),title:'Quick add',text:'Add anything straight onto the calendar.'}],
 finance:[{find:q('.fin-tabs'),before:tab('Overview'),title:'Three tabs',text:'Overview shows the month, Spending shows where it went, Plan holds bills and budgets.'},{find:q('.fin-quick2'),title:'Add money in or out',text:'Tap Add income or Add expense. It takes a few seconds and the totals update at once.'},{find:q('.fin-kpis'),title:'Your key numbers',text:'Budget, actual spending and savings rate, with a small chart each.'},{find:q('.finance-hero'),title:'Your month, at a glance',text:'Net cash flow, what you received and spent, and what is safe to spend each day.'},{find:q('.fin-tabs ~ *'),before:tab('Spending'),title:'Spending tab',text:'Budget against actual, your top categories and tips to spend less.',tips:['Tap a category to see its transactions.']},{find:q('.fin-tabs ~ *'),before:tab('Plan'),title:'Plan tab',text:'Bills, income you expect and savings goals live here, so nothing surprises you.'},{find:q('.finance-options'),before:tab('Overview'),title:'Go deeper',text:'Income sources, bills, budgets, savings goals and calculators open from these cards.'}],
 tasks:[{find:q('.meals-tabs'),before:tab('Focus'),title:'Four tabs, one rhythm',text:'Focus shows what to do now. Tasks lists everything. Habits repeat on your days. Insights shows trends.'},{find:q('.tf-hero'),title:'Today score',text:'How much of your plan you have done today.'},{find:q('.tf-pills'),before:tab('Tasks'),title:'Filter your list',text:'Today, Upcoming, Overdue or Done. The number on each pill is how many are inside.'},{find:q('.tf-search'),title:'Find anything',text:'Search by name to jump to a task.'},{find:q('.meals-tabs ~ *'),before:tab('Habits'),title:'Habits',text:'Repeat on the days you pick. You can only tick today, so streaks stay honest.'},{find:q('.meals-tabs ~ *'),before:tab('Insights'),title:'Insights',text:'Charts of how consistent you have been. Green bars are strong days.'},{find:q('.page-controls .button.primary'),title:'Add a task',text:'Quick add opens a short guided form with a clock for the time.'}],
 fitness:[{find:q('.fit-tabs'),before:tab('Train'),title:'Train, Progress, Exercises',text:'Train is where you plan and finish workouts. Progress shows records and your body check-ins. Exercises is the library with a muscle map.'},{find:q('.lv-hero'),title:'Your level',text:'Every finished workout adds XP. The bar shows how far to the next level. Tap XP history to see every point you earned.',tips:['A finished workout stays finished, so your points are safe.','There are daily limits, so only real training counts.']},{find:q('.lv-ladder'),title:'Rank ladder',text:'Six ranks from Rookie to Legend. You can see exactly how much XP each rank needs.'},{find:q('.lv-badges'),title:'Badges',text:'Unlock them by training. Locked ones tell you exactly what to do.'},{find:q('.fitness-session-panel'),title:'Your workout checklist',text:'Plan a session, then tick it off after you train. The XP chip shows what it is worth.'},{find:q('.fitness-planner'),title:'Start a plan in one tap',text:'Pick a program and its sessions are added to your checklist, with rest days between.'},{find:q('.fit-tabs ~ *'),before:tab('Progress'),title:'Progress tab',text:'Your best lifts, body weight check-ins, and charts of minutes and sessions.'},{find:q('.fit-tabs ~ *'),before:tab('Exercises'),title:'Exercises tab',text:'Tap a body part, read how the move is done, and add it to a session. Templates start a workout in one tap.'}],
 meals:[{find:q('.meals-tabs'),before:tab('Today'),title:'Today, Plan, Groceries, Insights',text:'Log food today, plan the week, get a shopping list, then see how you did.'},{find:q('.meals-today'),title:'Log what you eat',text:'Search a food, set the quantity, done. Water too.'},{find:q('.cal-ring'),title:'Your daily target',text:'The ring shows calories against your target. You can change the target any time.'},{find:q('.meals-tabs ~ *'),before:tab('Plan'),title:'Plan tab',text:'Put meals on the days you will eat them. Tick them as you eat.'},{find:q('.meals-tabs ~ *'),before:tab('Groceries'),title:'Groceries tab',text:'The shopping list writes itself from your plan. Tick items as you buy them.'},{find:q('.meals-tabs ~ *'),before:tab('Insights'),title:'Insights tab',text:'What you ate compared with your targets.'}],
 goals:[{find:q('.g-hero'),title:'Your overall progress',text:'The ring is the average of all your active goals. The chips show how many are reached and what is late.'},{find:q('.goal-types'),title:'Pick a goal type',text:'Each type has its own colour. Auto types follow your data (Pro), so you never update them by hand.'},{find:q('.goal-block'),title:'A goal card',text:'The ring on the left is that goal. The big box shows how much is done, and Update lets you change it.',tips:['Add small steps. Ticking a step moves the bar.']},{find:q('.section-toolbar'),title:'Active, Completed, All',text:'Filter your goals, or start a new one.'}],
 assistant:[{title:'Ledger assistant',text:'Ask in plain words.',tips:['Try “Log a $12 lunch today”.','It proposes an action and waits for your confirmation.','Attach a photo of a receipt or a meal to log it faster.']}],
 reports:[{find:q('.report-hero'),title:'Your month, summarised',text:'Pick any month at the top.'},{find:q('.report-kpis'),title:'Key numbers',text:'Income, spending, savings and how they compare.'},{find:q('.report-page .page-controls .button, .page-controls .button'),title:'Export',text:'Download the month as a CSV. PDF statements are part of Pro.'}],
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
  else if(r.left<320&&r.width<400){left=r.right+pad+16;top=Math.min(Math.max(r.top-8,12),window.innerHeight-ch-12);}
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
  const pre=steps[index]?.before;if(pre)pre();const wait=Math.max(mobile?drawerReadyAt.current-Date.now():0,0)+(pre?420:0);
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
