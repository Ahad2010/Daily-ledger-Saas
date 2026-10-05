'use client';
import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { money, type metrics } from '@ledger/shared';
const palette=['#86dfbb','#abcfe2','#657b83','#c8ced2','#96a99c','#b2bcb8'];
type Metrics=ReturnType<typeof metrics>;
export function SpendingChart({m,onCategory}:{m:Metrics;onCategory:(name:string)=>void}){
 const [hovered,setHovered]=useState<string|null>(null);
 const active=m.categories.find(c=>c.name===hovered);
 return <>
  <div className="donut-wrap refined-donut" role="img" aria-label={`Spending ${money(m.expenses,m.currency)} across ${m.categories.length} categories. Use the legend to view transactions.`}>
   <ResponsiveContainer width="100%" height="100%"><PieChart>
    <Pie data={m.categories} dataKey="amount" nameKey="name" innerRadius="73%" outerRadius="87%" paddingAngle={3} cornerRadius={7} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false} onMouseEnter={entry=>setHovered(String(entry.name))} onMouseLeave={()=>setHovered(null)} onClick={entry=>onCategory(String(entry.name))}>
     {m.categories.map((c,i)=><Cell key={c.name} fill={palette[i%palette.length]} opacity={hovered&&hovered!==c.name?0.32:1} style={{cursor:'pointer',transition:'opacity 140ms ease'}}/>) }
    </Pie>
    <Tooltip content={({active,payload})=>active&&payload?.length?<div className="dark-tooltip"><strong>{String(payload[0].name)}</strong><div><span>Spent</span><b>{money(Number(payload[0].value),m.currency)}</b></div></div>:null}/>
   </PieChart></ResponsiveContainer>
   <div className="donut-center"><span>{active?.name||'Total spent'}</span><strong>{money(active?.amount??m.expenses,m.currency)}</strong><small>{active?`${Math.round(active.percentage)}% of spending`:`${m.categories.length} categories`}</small></div>
  </div>
  <div className="spending-legend refined-legend" aria-label="Spending categories">
   {m.categories.map((c,i)=><button key={c.name} onMouseEnter={()=>setHovered(c.name)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(c.name)} onBlur={()=>setHovered(null)} onClick={()=>onCategory(c.name)} aria-label={`View ${c.name} transactions: ${money(c.amount,m.currency)}, ${Math.round(c.percentage)} percent`}><i style={{background:palette[i%palette.length]}}/><span>{c.name}</span><strong>{money(c.amount,m.currency)}</strong><small>{Math.round(c.percentage)}%</small></button>)}
  </div>
 </>;
}
