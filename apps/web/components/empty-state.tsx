'use client';
import {useRef} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {ChartNoAxesCombined,Wallet,SquareCheck,Target,Dumbbell,Utensils,ShoppingBasket,Repeat2,Folder,Plus} from 'lucide-react';
import {Button} from './ui/button';
const icons={chart:ChartNoAxesCombined,money:Wallet,task:SquareCheck,goal:Target,fitness:Dumbbell,meal:Utensils,grocery:ShoppingBasket,recurring:Repeat2,generic:Folder};
export type EmptyVariant=keyof typeof icons;
export function EmptyState({title,description,variant='generic',onAdd,label='Get started',compact=false}:{title:string;description?:string;variant?:EmptyVariant;onAdd?:()=>void;label?:string;compact?:boolean}){
 const root=useRef<HTMLDivElement>(null);const Icon=icons[variant];
 useGSAP(()=>{const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{
  gsap.from('.empty-art',{opacity:0,scale:.94,y:5,duration:.55,ease:'power2.out'});
  const ring=gsap.to('.empty-metal',{rotation:'+=360',duration:18,repeat:-1,ease:'none',paused:true});
  let visible=false;
  const update=()=>{if(visible&&!document.hidden)ring.play();else ring.pause();};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;update();});
  if(root.current)observer.observe(root.current);
  document.addEventListener('visibilitychange',update);
  return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',update);ring.kill();};
 });return ()=>mm.revert();},{scope:root});
 return <div ref={root} className={`premium-empty ${compact?'compact':''}`}><div className="empty-art" aria-hidden="true"><div className="empty-glow"/><div className="empty-tile"><div className={`empty-metal empty-metal-${variant}`}><i/><i/><i/></div><div className="empty-symbol"><Icon strokeWidth={2.2}/></div></div></div><h3>{title}</h3>{description&&<p>{description}</p>}{onAdd&&<Button variant="primary" onClick={onAdd}><Plus size={15}/>{label}</Button>}</div>;
}
