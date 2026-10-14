'use client';
import {useMemo,useRef,useState} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {money,type metrics} from '@ledger/shared';
import {CountUp,useReducedMotion} from './animation';
// Vivid, high-contrast category colours that stay distinct on the dark surface.
export const donutPalette=['#b6f26b','#2dd4a3','#4cc3ff','#9b8cff','#ffb072','#ff7eb6'];
const percent=(v:number)=>v>0&&v<.1?'<0.1%':`${v<10?v.toFixed(1):Math.round(v)}%`;
type Metrics=ReturnType<typeof metrics>;
const R=74,C=2*Math.PI*R,TICKS=60,SWEEP=1.6;
export function SpendingChart({m,onCategory}:{m:Metrics;onCategory:(name:string)=>void}){
 const reduced=useReducedMotion();const [hovered,setHovered]=useState<string|null>(null);
 const root=useRef<SVGSVGElement>(null);
 const active=m.categories.find(c=>c.name===hovered);
 const total=m.categories.reduce((n,c)=>n+c.amount,0)||1;
 // Each arc starts where the previous one ends; a small gap keeps neighbouring segments readable.
 const arcs=useMemo(()=>{let start=0;const gap=m.categories.length>1?3:0;return m.categories.map(c=>{const length=c.amount/total*C;const arc={name:c.name,start,length:Math.max(length-gap,.5)};start+=length;return arc;});},[m.categories,total]);
 const signature=m.categories.map(c=>`${c.name}:${c.amount}`).join('|');
 // A speedometer-style sweep: one shared 0→1 progress value reveals ticks and arcs together, clockwise from the top.
 useGSAP(()=>{
  const svg=root.current;if(!svg)return;const segments=Array.from(svg.querySelectorAll<SVGCircleElement>('[data-donut-segment]'));const ticks=Array.from(svg.querySelectorAll<SVGLineElement>('[data-donut-tick]'));
  const paint=(p:number)=>{segments.forEach((el,i)=>{const arc=arcs[i];if(!arc)return;const visible=Math.min(Math.max(p*C-arc.start,0),arc.length);el.setAttribute('stroke-dasharray',`${visible} ${C}`);});ticks.forEach((el,i)=>{el.style.opacity=String(i/TICKS<=p?1:.18);});};
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',context=>{const state={p:0};paint(0);let tween:gsap.core.Tween;context.ignore(()=>{tween=gsap.to(state,{p:1,duration:SWEEP,ease:'power3.out',onUpdate:()=>paint(state.p),onComplete:()=>paint(1)});});return ()=>tween.kill();});
  mm.add('(prefers-reduced-motion: reduce)',()=>paint(1));
  return ()=>mm.revert();
 },{scope:root,dependencies:[signature],revertOnUpdate:true});
 return <>
  <div className="donut-wrap refined-donut gauge-donut" role="img" aria-label={`Spending ${money(m.expenses,m.currency)} across ${m.categories.length} categories. Use the legend to view transactions.`}>
   <svg ref={root} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
    {Array.from({length:TICKS},(_,i)=>{const a=i/TICKS*2*Math.PI-Math.PI/2;return <line key={i} data-donut-tick x1={100+Math.cos(a)*91} y1={100+Math.sin(a)*91} x2={100+Math.cos(a)*(i%5===0?98:95)} y2={100+Math.sin(a)*(i%5===0?98:95)} stroke="#6f7c78" strokeWidth={i%5===0?1.6:1} strokeLinecap="round" style={{opacity:reduced?1:.18}}/>;})}
    <circle cx="100" cy="100" r={R} fill="none" stroke="#1b201e" strokeWidth="22"/>
    <g transform="rotate(-90 100 100)">
     {arcs.map((arc,i)=><circle key={arc.name} data-donut-segment className="gauge-segment" cx="100" cy="100" r={R} fill="none" stroke={donutPalette[i%donutPalette.length]} strokeWidth="22" strokeDasharray={reduced?`${arc.length} ${C}`:`0 ${C}`} strokeDashoffset={-arc.start} style={{cursor:'pointer',opacity:hovered&&hovered!==arc.name?.45:1,filter:`drop-shadow(0 0 5px ${donutPalette[i%donutPalette.length]}55)`}} onMouseEnter={()=>setHovered(arc.name)} onMouseLeave={()=>setHovered(null)} onClick={()=>onCategory(arc.name)}/>)}
    </g>
   </svg>
   <div className="donut-center"><span>Total spent</span><span className="donut-value" style={{fontSize:money(m.expenses,m.currency).length>12?16:22}}><CountUp key={signature} value={m.expenses} from={0} duration={SWEEP} ease="power3.out" format={value=>money(value,m.currency)}/></span><small>{m.categories.length} categories</small></div>
  </div>
  <div className="donut-hover-details" role={active?'tooltip':undefined}>{active?<><span>{active.name}</span><strong>{money(active.amount,m.currency)}</strong><small>{percent(active.percentage)} of spending</small></>:<small>Hover a segment or select a category below</small>}</div>
  <div className="spending-legend refined-legend" aria-label="Spending categories">
   {m.categories.map((c,i)=><button key={c.name} onMouseEnter={()=>setHovered(c.name)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(c.name)} onBlur={()=>setHovered(null)} onClick={()=>onCategory(c.name)} aria-label={`View ${c.name} transactions: ${money(c.amount,m.currency)}, ${percent(c.percentage)}`}><i style={{background:donutPalette[i%donutPalette.length]}}/><span>{c.name}</span><strong>{money(c.amount,m.currency)}</strong><small>{percent(c.percentage)}</small></button>)}
  </div>
 </>;
}
