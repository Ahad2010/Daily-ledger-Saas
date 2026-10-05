'use client';
import {useRef,useState} from 'react';
import {Check,ChevronDown,Search} from 'lucide-react';
import {currencyOptions,currencyLabel} from '@ledger/shared';
import {Dialog} from './ui/dialog';
export function CurrencyPicker({value,onChange,disabled=false}:{value:string;onChange:(code:string)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false);const [search,setSearch]=useState('');const trigger=useRef<HTMLButtonElement>(null);
 const options=currencyOptions.filter(code=>(code+' '+currencyLabel(code)).toLowerCase().includes(search.trim().toLowerCase()));
 return <><button ref={trigger} type="button" className="currency-trigger" aria-label="Currency" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} onClick={()=>{setSearch('');setOpen(true);}}><span><strong>{value}</strong><small>{currencyLabel(value)}</small></span><ChevronDown size={16}/></button><Dialog open={open} onOpenChange={next=>{setOpen(next);if(!next)requestAnimationFrame(()=>trigger.current?.focus());}} title="Choose your currency" description="Search worldwide currencies by name or code. Historical amounts are never converted."><div className="currency-search"><Search size={17}/><input aria-label="Search currencies" placeholder="Search currency or country…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="currency-list" aria-label="Available currencies">{options.length?options.map(code=><button type="button" key={code} aria-pressed={code===value} onClick={()=>{onChange(code);setOpen(false);requestAnimationFrame(()=>trigger.current?.focus());}}><strong>{code}</strong><span>{currencyLabel(code)}</span>{code===value&&<Check size={16}/>}</button>):<p role="status">No matching currencies. Try a name or code.</p>}</div><small className="muted">{currencyOptions.length} supported currencies · amounts support up to two decimal places</small></Dialog></>;
}
