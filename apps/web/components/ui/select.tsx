'use client';
import {useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';

export interface SelectOption<T extends string>{value:T;label:string;hint?:string;icon?:ReactNode}

// A themed dropdown that replaces the browser's native list: keyboard friendly, opens upward when the bottom is tight.
export function Select<T extends string>({value,options,onChange,label,className='',compact=false}:{value:T;options:SelectOption<T>[];onChange:(v:T)=>void;label:string;className?:string;compact?:boolean}){
 const id=useId(),button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(0),[pos,setPos]=useState<{left:number;width:number;top?:number;bottom?:number}|null>(null);
 const current=options.find(o=>o.value===value)||options[0];
 const place=()=>{const r=button.current?.getBoundingClientRect();if(!r)return;const width=Math.max(r.width,compact?170:r.width),left=Math.min(Math.max(8,r.left),window.innerWidth-width-8),height=Math.min(options.length*44+12,320);setPos(window.innerHeight-r.bottom<height+16&&r.top>height?{left,width,bottom:window.innerHeight-r.top+6}:{left,width,top:r.bottom+6});};
 useLayoutEffect(()=>{if(open)place();},[open]);
 useEffect(()=>{if(!open)return;const close=(e:Event)=>{if(!menu.current?.contains(e.target as Node)&&!button.current?.contains(e.target as Node))setOpen(false);};const move=()=>place();document.addEventListener('pointerdown',close);window.addEventListener('resize',move);window.addEventListener('scroll',move,true);return()=>{document.removeEventListener('pointerdown',close);window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true);};},[open]);
 const openMenu=()=>{setActive(Math.max(0,options.findIndex(o=>o.value===value)));setOpen(true);};
 const pick=(v:T)=>{onChange(v);setOpen(false);button.current?.focus();};
 const key=(e:React.KeyboardEvent)=>{
  if(!open){if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();openMenu();}return;}
  if(e.key==='Escape'){e.preventDefault();setOpen(false);}
  else if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>(a+1)%options.length);}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>(a-1+options.length)%options.length);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(options[active].value);}
  else if(e.key==='Tab')setOpen(false);
 };
 return <>
  <button ref={button} type="button" className={`ui-select ${compact?'compact':''} ${open?'open':''} ${className}`} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={()=>open?setOpen(false):openMenu()} onKeyDown={key}>
   {current.icon&&<span className="ui-select-icon">{current.icon}</span>}<span className="ui-select-value">{current.label}</span><ChevronDown size={15} className="ui-select-caret"/>
  </button>
  {open&&pos&&createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="ui-select-menu" style={{left:pos.left,width:pos.width,top:pos.top,bottom:pos.bottom}}>
   {options.map((o,i)=><div key={o.value} role="option" aria-selected={o.value===value} className={`ui-select-option ${i===active?'active':''} ${o.value===value?'selected':''}`} onPointerEnter={()=>setActive(i)} onPointerDown={e=>{e.preventDefault();pick(o.value);}}>
    {o.icon&&<span className="ui-select-icon">{o.icon}</span>}<span className="ui-select-text"><strong>{o.label}</strong>{o.hint&&<small>{o.hint}</small>}</span>{o.value===value&&<Check size={15}/>}
   </div>)}
  </div>,document.body)}
 </>;
}
