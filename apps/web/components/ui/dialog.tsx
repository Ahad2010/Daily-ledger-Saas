'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
function DialogBody({title,description,children}:{title:string;description:string;children:ReactNode}){const ref=useRef<HTMLDivElement>(null);useGSAP(()=>{const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.from(ref.current,{opacity:0,y:8,scale:.985,duration:.2,ease:'power2.out'});});return ()=>mm.revert();},{scope:ref});return <DialogPrimitive.Content ref={ref} className="dialog-content"><div className="dialog-heading"><DialogPrimitive.Title className="dialog-title">{title}</DialogPrimitive.Title><DialogPrimitive.Description className="dialog-description">{description}</DialogPrimitive.Description></div><DialogPrimitive.Close className="icon-button dialog-close" aria-label="Close dialog"><X size={20}/></DialogPrimitive.Close><div className="dialog-body">{children}</div></DialogPrimitive.Content>;}
export function Dialog({open,onOpenChange,title,description,children}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description:string;children:ReactNode}){return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay"/><DialogBody title={title} description={description}>{children}</DialogBody></DialogPrimitive.Portal></DialogPrimitive.Root>;}
