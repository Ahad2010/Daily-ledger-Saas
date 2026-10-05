'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { money, type metrics } from '@ledger/shared';
import {CountUp,useReducedMotion} from './animation';
const palette=['#80e4bd','#83c8ff','#a894ff','#f3b08f','#f09ac2','#bddf85'];
const percent=(v:number)=>v>0&&v<.1?'<0.1%':`${v<10?v.toFixed(1):Math.round(v)}%`;
type Metrics=ReturnType<typeof metrics>;
export function SpendingChart({m,onCategory}:{m:Metrics;onCategory:(name:string)=>void}){
 const reduced=useReducedMotion();const [hovered,setHovered]=useState<string|null>(null);
 const active=m.categories.find(c=>c.name===hovered);
 return <>
  <div className="donut-wrap refined-donut" role="img" aria-label={`Spending ${money(m.expenses,m.currency)} across ${m.categories.length} categories. Use the legend to view transactions.`}>
   <ResponsiveContainer width="100%" height="100%"><PieChart>
    <Pie data={m.categories} dataKey="amount" nameKey="name" innerRadius="64%" outerRadius="94%" paddingAngle={m.categories.some(c=>c.percentage>90)?.6:2} cornerRadius={4} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={!reduced} animationDuration={450} animationEasing="ease-out" onMouseEnter={entry=>setHovered(String(entry.name))} onMouseLeave={()=>setHovered(null)} onClick={entry=>onCategory(String(entry.name))}>
     {m.categories.map((c,i)=><Cell key={c.name} fill={palette[i%palette.length]} opacity={hovered&&hovered!==c.name?0.5:1} style={{cursor:'pointer'}}/>) }
    </Pie>
   </PieChart></ResponsiveContainer>
   <div className="donut-center"><span>Total spent</span><span className="donut-value" style={{fontSize:money(m.expenses,m.currency).length>12?16:22}}><CountUp value={m.expenses} format={value=>money(value,m.currency)}/></span><small>{m.categories.length} categories</small></div>
  </div>
  <div className="donut-hover-details" role={active?'tooltip':undefined}>{active?<><span>{active.name}</span><strong>{money(active.amount,m.currency)}</strong><small>{percent(active.percentage)} of spending</small></>:<small>Hover a segment or select a category below</small>}</div>
  <div className="spending-legend refined-legend" aria-label="Spending categories">
   {m.categories.map((c,i)=><button key={c.name} onMouseEnter={()=>setHovered(c.name)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(c.name)} onBlur={()=>setHovered(null)} onClick={()=>onCategory(c.name)} aria-label={`View ${c.name} transactions: ${money(c.amount,m.currency)}, ${percent(c.percentage)}`}><i style={{background:palette[i%palette.length]}}/><span>{c.name}</span><strong>{money(c.amount,m.currency)}</strong><small>{percent(c.percentage)}</small></button>)}
  </div>
 </>;
}

