'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {Check,ChevronDown} from 'lucide-react';
// A text box with a drop-down that always lists every choice. The browser's own list narrows to whatever is already typed,
// so once a field held "Essentials" the other choices vanished. Here the full list stays, the typed text only highlights.
export function ComboInput({label,value,options,onChange,placeholder}:{label:string;value:string;options:string[];onChange:(value:string)=>void;placeholder?:string}){
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[fit,setFit]=useState({up:false,max:260}),box=useRef<HTMLDivElement>(null),id=useId();
 // Opens upwards when there is room, so it never drops over the buttons below; falls back to downwards.
 useLayoutEffect(()=>{if(!open||!box.current)return;const field=box.current.getBoundingClientRect(),area=(box.current.closest('.dialog-body')||document.documentElement).getBoundingClientRect();const below=Math.min(area.bottom,window.innerHeight)-field.bottom-14,above=field.top-Math.max(area.top,0)-14;const up=above>=Math.min(200,options.length*42+12)||above>below;setFit({up,max:Math.max(140,Math.min(260,up?above:below))});},[open,options.length]);
 useEffect(()=>{if(!open)return;const away=(e:MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',away);return()=>document.removeEventListener('mousedown',away);},[open]);
 const pick=(name:string)=>{onChange(name);setOpen(false);setActive(-1);};
 return <div className="combo" ref={box}>
  <input aria-label={label} role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="none" autoComplete="off" placeholder={placeholder} value={value}
   onChange={e=>onChange(e.target.value)} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)}
   onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setActive(i=>Math.min(options.length-1,i+1));}else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,i-1));}else if(e.key==='Enter'&&open&&active>=0){e.preventDefault();pick(options[active]);}else if(e.key==='Escape'&&open){e.stopPropagation();setOpen(false);}}}/>
  <button type="button" className="combo-toggle" tabIndex={-1} aria-label="Open the list of choices" onMouseDown={e=>e.preventDefault()} onClick={()=>setOpen(o=>!o)}><ChevronDown size={16}/></button>
  {open&&<ul id={id} className={`combo-list${fit.up?' up':''}`} style={{maxHeight:fit.max}} role="listbox" aria-label={label}>{options.map((name,i)=><li key={name} role="option" aria-selected={name===value} className={`${name===value?'on':''}${i===active?' hot':''}`} onMouseDown={e=>{e.preventDefault();pick(name);}}><span>{name}</span>{name===value&&<Check size={14}/>}</li>)}</ul>}
 </div>;
}
