'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Lightbulb,TriangleAlert,Sparkles,X} from 'lucide-react';
import type {Kind,Snapshot} from '@ledger/shared';
import {pageSuggestions} from '../lib/suggestions';
const icons={tip:Lightbulb,nudge:TriangleAlert,upgrade:Sparkles} as const;
// Dismissals last for the local day and live only in this browser; they never affect the account.
const key=(today:string)=>`ledger-suggestions-dismissed:${today}`;
export function PageSuggestions({page,s,today,onAdd}:{page:string;s:Snapshot;today:string;onAdd:(kind:Kind,initial?:Record<string,unknown>)=>void}){
 const [hidden,setHidden]=useState<string[]>([]);
 useEffect(()=>{try{setHidden(JSON.parse(localStorage.getItem(key(today))||'[]'));}catch{/* dismissals are a convenience */}},[today]);
 const items=pageSuggestions(page,s,today).filter(item=>!hidden.includes(`${page}:${item.id}`));
 if(!items.length)return null;
 const dismiss=(id:string)=>{const next=[...hidden,`${page}:${id}`];setHidden(next);try{localStorage.setItem(key(today),JSON.stringify(next));}catch{/* ignore */}};
 return <section className="page-suggestions" aria-label="Suggestions for you">{items.map(item=>{const Icon=icons[item.tone];return <div className="suggestion-card" data-tone={item.tone} key={item.id}><span className="suggestion-icon"><Icon size={16}/></span><p>{item.text}</p>{item.action&&(item.action.href?<Link className="suggestion-action" href={item.action.href}>{item.action.label}<ArrowRight size={13}/></Link>:<button className="suggestion-action" onClick={()=>onAdd(item.action!.kind!,item.action!.initial)}>{item.action.label}<ArrowRight size={13}/></button>)}<button className="suggestion-dismiss" aria-label="Dismiss suggestion" onClick={()=>dismiss(item.id)}><X size={14}/></button></div>;})}</section>;
}
