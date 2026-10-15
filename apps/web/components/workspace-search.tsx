'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Search,X,CornerDownLeft} from 'lucide-react';
import {type LedgerRecord} from '@ledger/shared';

export type SearchPage={slug:string;label:string};
const kindLabel:Record<string,string>={transaction:'Transaction',budget:'Budget',cashPlan:'Bill or income plan',recurring:'Recurring',task:'Task',habit:'Habit',workout:'Workout',meal:'Meal',grocery:'Grocery item',goal:'Goal',milestone:'Goal step',financeCategory:'Category'};
const fields=['title','description','notes','category','account','ingredients','quantity','unit'];
const textOf=(r:LedgerRecord)=>fields.map(k=>String((r.data as Record<string,unknown>)[k]??'')).join(' ').toLowerCase();
// Matches page names and the readable text of records (not ids or raw JSON), every typed word must appear.
export function searchWorkspace(query:string,records:LedgerRecord[],pages:SearchPage[]){
 const words=query.toLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return {pages:[],records:[]};
 return {pages:pages.filter(p=>words.every(w=>p.label.toLowerCase().includes(w))).slice(0,4),records:records.filter(r=>kindLabel[r.kind]&&words.every(w=>textOf(r).includes(w))).slice(0,10)};
}
export function WorkspaceSearch({records,pages,onOpen}:{records:LedgerRecord[];pages:SearchPage[];onOpen:(r:LedgerRecord)=>void}){
 const router=useRouter();const [query,setQuery]=useState(''),[debounced,setDebounced]=useState(''),[open,setOpen]=useState(false);const wantFocus=useRef(false);const input=useRef<HTMLInputElement>(null),box=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(open&&wantFocus.current){wantFocus.current=false;input.current?.focus();}},[open]);
 useEffect(()=>{const t=setTimeout(()=>setDebounced(query),150);return ()=>clearTimeout(t);},[query]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!/input|textarea|select/i.test((e.target as HTMLElement).tagName))){e.preventDefault();wantFocus.current=true;setOpen(true);}if(e.key==='Escape'){setOpen(false);setQuery('');}};const away=(e:MouseEvent)=>{if(box.current&&!box.current.contains(e.target as Node))setOpen(false);};document.addEventListener('keydown',key);document.addEventListener('mousedown',away);return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('mousedown',away);};},[]);
 const found=useMemo(()=>searchWorkspace(debounced,records,pages),[debounced,records,pages]);
 const close=()=>{setQuery('');setDebounced('');setOpen(false);};
 const go=(slug:string)=>{router.push(slug?`/${slug}`:'/');close();};
 const first=found.pages[0]?()=>go(found.pages[0].slug):found.records[0]?()=>{onOpen(found.records[0]);close();}:undefined;
 return <div ref={box} className={'search-wrap'+(open?' open':'')}>
  <button type="button" className="search-trigger" aria-label="Open search" onClick={()=>{if(open)input.current?.focus();else{wantFocus.current=true;setOpen(true);}}}><Search size={19}/></button>
  <input ref={input} aria-label="Search your records" placeholder="Search pages and records…" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onKeyDown={e=>{if(e.key==='Enter'&&first){e.preventDefault();first();}}}/>
  {open&&<button type="button" className="search-close" aria-label="Close search" onClick={close}><X size={16}/></button>}
  {open&&debounced&&<div className="search-results" role="listbox">
   {found.pages.length>0&&<><div className="eyebrow">Pages</div>{found.pages.map(p=><button key={p.slug||'home'} onClick={()=>go(p.slug)}><span>{p.label}</span><small>Go to page</small></button>)}</>}
   {found.records.length>0&&<><div className="eyebrow">Your records</div>{found.records.map(r=><button key={r.id} onClick={()=>{onOpen(r);close();}}><span>{String((r.data as Record<string,unknown>).title||kindLabel[r.kind])}</span><small>{kindLabel[r.kind]}</small></button>)}</>}
   {!found.pages.length&&!found.records.length&&<p>No results for “{debounced}”. Try a task, merchant, meal or goal name.</p>}
   <small className="search-hint"><CornerDownLeft size={12}/> Enter opens the first result · Esc closes</small>
  </div>}
 </div>;
}
