'use client';
import {useEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {useQueryClient} from '@tanstack/react-query';
import {ArrowUp,Trash2,RefreshCw,LockKeyhole,Check,ArrowRight} from 'lucide-react';
import Link from 'next/link';
import {ApiError,adapter,demoMode} from '../lib/data';
import {localAnswer} from '../lib/local-assistant';
import type {Snapshot} from '@ledger/shared';
import {bootUser,platformRequest} from '../lib/platform-api';
import {Entrance,useReducedMotion} from './animation';
import type {DailyBrief} from '../lib/daily-brief';
import {TableSkeleton} from './skeleton';
import {Button} from './ui/button';
import HoldButton from './hold-button';
import {Dialog} from './ui/dialog';
type Action={type:'create';kind:'task'|'transaction'|'habit'|'workout'|'goal'|'meal'|'grocery';data:Record<string,unknown>;label:string}|{type:'link';path:string;label:string};
type Message={id:string;question:string;answer:string;createdAt:string;month:string;actions?:Action[]|null;fresh?:boolean};
const suggestions=[{intent:'general',text:'Add a task: call the bank tomorrow at 5pm'},{intent:'general',text:'Log a $12 lunch expense today'},{intent:'general',text:'How do I import my bank statement?'},{intent:'summary',text:'Summarize my month'},{intent:'spending',text:'Where did my money go?'},{intent:'tasks',text:'What needs my attention?'},{intent:'weekly',text:'Help me plan my week'},{intent:'goals',text:'How are my goals doing?'}];
const intents=['general','summary','spending','tasks','weekly','goals'];
const intentLabel=(intent:string)=>intent==='general'?'General':intent==='weekly'?'Weekly plan':intent[0].toUpperCase()+intent.slice(1);
// The assistant only proposes. Each create action runs through the normal validated save when the user confirms it.
function ActionList({message}:{message:Message}){
 const client=useQueryClient();const [done,setDone]=useState<Record<number,boolean>>({}),[errors,setErrors]=useState<Record<number,string>>({}),[busy,setBusy]=useState<number|null>(null);
 const storeKey='ai-actions:'+message.id;
 useEffect(()=>{try{setDone(JSON.parse(localStorage.getItem(storeKey)||'{}'));}catch{/* progress marks are a convenience only */}},[storeKey]);
 async function run(index:number,action:Extract<Action,{type:'create'}>){setBusy(index);setErrors(e=>({...e,[index]:''}));try{await adapter.save({kind:action.kind,data:action.data});const next={...done,[index]:true};setDone(next);try{localStorage.setItem(storeKey,JSON.stringify(next));}catch{/* ignore */}await client.invalidateQueries({queryKey:['snapshot']});}catch(e){setErrors(prev=>({...prev,[index]:(e as Error).message}));}finally{setBusy(null);}}
 if(!message.actions?.length)return null;
 return <div className="ai-actions" aria-label="Suggested actions">{message.actions.map((action,index)=>action.type==='link'?<Link key={index} className="button" href={action.path}>{action.label}<ArrowRight size={14}/></Link>:<div className="ai-action" key={index}><span>{action.label}</span><Button variant="primary" disabled={!!done[index]||busy!==null} onClick={()=>void run(index,action)}>{done[index]?<><Check size={14}/>Added</>:busy===index?'Adding…':'Confirm'}</Button>{errors[index]&&<small role="alert" className="error">{errors[index]}</small>}</div>)}</div>;
}
function Orb({small=false}:{small?:boolean}){
 const ref=useRef<HTMLSpanElement>(null);
 useGSAP(()=>{if(small||!ref.current)return;const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion: no-preference)',()=>{gsap.fromTo(ref.current,{scale:.4,opacity:0},{scale:1,opacity:1,duration:.9,ease:'back.out(1.6)'});gsap.to(ref.current,{y:-7,duration:2.6,ease:'sine.inOut',repeat:-1,yoyo:true,delay:.9});});return ()=>mm.revert();},{scope:ref});
 return <span ref={ref} className={`ledger-orb${small?' is-small':''}`} aria-hidden="true"/>;
}
// New replies fade in word by word. The full text is always in the DOM, so screen readers and copy are unaffected.
function AnswerText({text,animate}:{text:string;animate:boolean}){
 const ref=useRef<HTMLParagraphElement>(null);const reduced=useReducedMotion();const words=text.split(/\s+/).filter(Boolean);const run=animate&&!reduced;
 useGSAP(()=>{if(!run||!ref.current)return;const targets=ref.current.querySelectorAll('.ai-word');gsap.fromTo(targets,{opacity:0,y:4},{opacity:1,y:0,duration:.28,ease:'power2.out',stagger:Math.min(.035,1.4/Math.max(words.length,1))});},{scope:ref,dependencies:[text,run]});
 if(!run)return <p>{text}</p>;
 return <p ref={ref}>{words.map((word,i)=><span key={i} className="ai-word" style={{opacity:0}}>{word}{' '}</span>)}</p>;
}
export function AiAssistant({month,brief,snapshot,asOf}:{month:string;brief?:DailyBrief;snapshot?:Snapshot;asOf?:Date}){const client=useQueryClient();const [status,setStatus]=useState<any>(null);const [messages,setMessages]=useState<Message[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [question,setQuestion]=useState('');const [intent,setIntent]=useState('general');const [pending,setPending]=useState(false);const [clear,setClear]=useState(false);const [retry,setRetry]=useState('');
 const thread=useRef<HTMLDivElement>(null),box=useRef<HTMLTextAreaElement>(null);
 async function load(){setLoading(true);setError('');if(demoMode&&snapshot){setStatus({enabled:true,configured:true,usage:null,demo:true});setMessages([]);setLoading(false);return;}try{await bootUser();const [s,h]=await Promise.all([platformRequest('/api/ai/status'),platformRequest('/api/ai/history')]);setStatus(s);setMessages(h.messages);}catch(e){if(e instanceof ApiError&&e.status===401){setStatus({enabled:false,configured:false,signIn:true,usage:null});}else setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{const el=box.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,160)+'px';}},[question]);
 useEffect(()=>{thread.current?.lastElementChild?.scrollIntoView?.({behavior:'smooth',block:'end'});},[messages.length,pending]);
 async function send(text=question,scope=intent){if(!text.trim()||pending||!status?.enabled||!status?.configured)return;setPending(true);setError('');setRetry('');if(status.demo&&snapshot){await new Promise(r=>setTimeout(r,450));const reply=localAnswer(snapshot,text.trim(),month,asOf||new Date(),scope);setMessages(prev=>[...prev,{id:crypto.randomUUID(),question:text.trim(),answer:reply.answer,createdAt:new Date().toISOString(),month,actions:reply.actions||null,fresh:true}]);setQuestion('');setPending(false);return;}try{const result=await platformRequest('/api/ai/chat',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),month,intent:scope,question:text.trim()})});setMessages(prev=>[...prev,{...result.message,fresh:true}]);setQuestion('');setStatus(await platformRequest('/api/ai/status'));await client.invalidateQueries({queryKey:['snapshot']});}catch(e){setError((e as Error).message);setRetry(text);}finally{setPending(false);}}
 if(loading)return <TableSkeleton/>;
 if(!status)return <Entrance className="panel ai-panel"><p className="error" role="alert">{error}</p><Button onClick={load}><RefreshCw size={15}/>Retry connection</Button></Entrance>;
 const ready=status.enabled&&status.configured;const timed=brief?[{intent:'tasks',text:brief.period==='morning'?'Plan my day':'What is left for today?'}]:[];
 const chips=[...timed,...suggestions];
 const composer=<form className="ai-composer ledger-composer" onSubmit={e=>{e.preventDefault();void send();}}><textarea ref={box} rows={1} aria-label="Ask the AI Assistant" placeholder="Ask Ledger anything…" maxLength={1000} value={question} disabled={!ready||pending} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}}/><div className="ledger-composer-row"><label><span className="sr-only">Assistant context</span><select aria-label="Assistant context" value={intent} onChange={e=>setIntent(e.target.value)}>{intents.map(i=><option key={i} value={i}>{intentLabel(i)}</option>)}</select></label><button type="submit" className="ledger-send" aria-label="Send" disabled={!ready||pending||!question.trim()}>{pending?<span className="ledger-spinner"/>:<ArrowUp size={18}/>}</button></div></form>;
 return <Entrance className={`panel ai-panel ledger-panel${ready&&!messages.length?' is-empty':''}`}><div className="panel-heading"><div><h2><Orb small/>Ledger</h2><p>Your money, tasks and goals · {month}</p></div>{messages.length>0&&<Button disabled={pending} onClick={()=>setClear(true)}><Trash2 size={14}/>Clear history</Button>}</div>{!ready&&<div className="ai-unconfigured" role="status"><LockKeyhole size={22}/><div><strong>{status.signIn?'Sign in to start a conversation':'Ledger is getting ready'}</strong><p>{status.signIn?'Ask about your own money, tasks and goals.':'AI replies are currently unavailable. You can keep using your workspace.'}</p></div>{status.signIn?<Link className="button" href="/login?returnTo=%2Fassistant">Sign in</Link>:<Button onClick={load}><RefreshCw size={14}/>Check again</Button>}</div>}
 {ready&&<>{!messages.length?<div className="ai-chat ledger-stage" aria-label="Your AI conversation"><div className="ai-intro ledger-hero"><Orb/><h2>{brief?.greeting||'Hello'}</h2><p className="ledger-line">{brief?.line||'What can I help with?'}</p><p className="ledger-sub">What can I help with?</p></div>{composer}<div className="ai-suggestions ledger-chips">{chips.map(c=><button disabled={pending} key={c.text} onClick={()=>{setIntent(c.intent);setQuestion(c.text);box.current?.focus();}}>{c.text}</button>)}</div></div>
  :<><div className="ai-chat ledger-thread" aria-label="Your AI conversation"><div ref={thread} className="ledger-thread-inner">{messages.map(m=><div className="ai-exchange" key={m.id}><div className="ai-user-message"><span>You · {m.month}</span><p>{m.question}</p></div><div className="ai-answer"><span className="ledger-who"><Orb small/>Ledger</span><AnswerText text={m.answer} animate={!!m.fresh}/><ActionList message={m}/></div></div>)}{pending&&<div className="ai-answer ledger-typing" role="status"><span className="ledger-who"><Orb small/>Ledger is thinking</span><div className="ledger-dots" aria-hidden="true"><i/><i/><i/></div></div>}</div></div>{error&&<div className="error-banner" role="alert"><span>{error}</span>{retry&&<Button disabled={pending} onClick={()=>send(retry)}><RefreshCw size={14}/>Retry response</Button>}</div>}{composer}</>}
 {!messages.length&&error&&<div className="error-banner" role="alert"><span>{error}</span>{retry&&<Button disabled={pending} onClick={()=>send(retry)}><RefreshCw size={14}/>Retry response</Button>}</div>}
 <p className="ai-footnote">{status.demo&&'Demo replies are built from your own sample data. Open-ended answers turn on when an AI provider is connected. · '}{status.usage&&`${status.usage.requests} / ${status.usage.allowance.requests} monthly requests · `} Nothing changes until you confirm an action. Check important figures.</p></>}
 <Dialog open={clear} onOpenChange={setClear} title="Clear your AI history?" description="This deletes your saved questions and replies. Usage counters remain for your allowance."><div className="dialog-actions"><Button onClick={()=>setClear(false)}>Keep history</Button><HoldButton size="md" radius={10} holdTime={1300} releaseTime={180} backgroundColor="#1d1411" fillColor="#e5533d" textColor="#ffb4a8" fillTextColor="#ffffff" waveAmplitude={5} resetAfter={0} icon={<Trash2 size={15}/>} doneLabel="Deleting…" onHold={async()=>{try{if(!status?.demo)await platformRequest('/api/ai/history',{method:'DELETE'});setMessages([]);setClear(false);}catch(e){setError((e as Error).message);}}}>Hold to delete</HoldButton></div></Dialog></Entrance>;
}
