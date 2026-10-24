'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {Award,Check,Dumbbell,Flame,Lock,Sparkles,Target,Timer,Trophy,Zap,History,ArrowRight} from 'lucide-react';
import type {Snapshot} from '@ledger/shared';
import {fitnessStats,TIERS,tierAt,xpHistory,xpToReach} from '../lib/fitness-xp';
import {Entrance,CountUp} from './animation';
import {clockTick} from './record-extras';

const questIcon={sessions:Dumbbell,minutes:Timer,sets:Target} as const;
const badgeIcon:Record<string,typeof Award>={first:Sparkles,five:Dumbbell,ten:Trophy,streak3:Flame,hour:Timer,sets:Target,lvl5:Zap};

function Hex({level,color}:{level:number;color:string}){
 return <div className="lv-hex" style={{'--lv':color} as React.CSSProperties} aria-hidden="true"><svg viewBox="0 0 120 130"><defs><linearGradient id="lvg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color}/><stop offset="1" stopColor={color} stopOpacity=".35"/></linearGradient></defs><path d="M60 4 112 34v62L60 126 8 96V34z" fill="#0c0f0e" stroke="url(#lvg)" strokeWidth="5" strokeLinejoin="round"/><path d="M60 16 100 40v50L60 114 20 90V40z" fill={color} fillOpacity=".12"/></svg><span><small>LEVEL</small><CountUp intro value={level} duration={1.2} format={v=>String(v)}/></span></div>;
}

// A level, a rank, weekly goals and badges: every finished workout visibly moves the player forward.
export function FitnessLevel({s,today}:{s:Snapshot;today:string}){
 const st=fitnessStats(s,today),next=TIERS.find(t=>t.min>st.level);
 const [up,setUp]=useState<number|null>(null),[gain,setGain]=useState(0),prevXp=useRef<number|null>(null);
 // Points fly up the moment a workout is finished.
 useEffect(()=>{if(prevXp.current!==null&&st.xp>prevXp.current){setGain(st.xp-prevXp.current);clockTick();const id=setTimeout(()=>setGain(0),2600);prevXp.current=st.xp;return()=>clearTimeout(id);}prevXp.current=st.xp;},[st.xp]);
 useEffect(()=>{
  try{const seen=Number(localStorage.getItem('dl-fit-level')||0);if(seen&&st.level>seen){setUp(st.level);clockTick();setTimeout(clockTick,140);setTimeout(clockTick,280);}localStorage.setItem('dl-fit-level',String(Math.max(seen,st.level)));}catch{/* private mode */}
 },[st.level]);
 useEffect(()=>{if(up===null)return;const id=setTimeout(()=>setUp(null),6000);return()=>clearTimeout(id);},[up]);
 const tier=tierAt(up||st.level);
 return <>
  <Entrance className="panel lv-hero" style={{'--lv':st.tier.color} as React.CSSProperties}>
   <div className="lv-main"><Hex level={st.level} color={st.tier.color}/>
    <div className="lv-info">
     {gain>0&&<span className="xp-gain" role="status">+{gain} XP</span>}<span className="eyebrow">YOUR RANK</span><h2><b style={{color:st.tier.color}}>{st.tier.name}</b></h2>
     <div className="lv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.span} aria-valuenow={st.into} aria-label={`${st.into} of ${st.span} XP to level ${st.level+1}`}><i style={{width:`${st.span?Math.min(100,st.into/st.span*100):0}%`}}/></div>
     <p><strong><CountUp intro value={st.into} format={v=>`${v}`}/></strong> / {st.span} XP · <span>{st.span-st.into} XP to level {st.level+1}</span></p>
     <div className="lv-chips"><span className="streak"><Flame size={15}/>{st.streak} day streak</span><span><Zap size={15}/>{st.weekXp} XP this week</span>{next&&<span>Next rank: {next.name} at level {next.min}</span>}<Link className="lv-hist-link" href="/fitness/history"><History size={15}/>XP history<ArrowRight size={14}/></Link></div>
    </div>
   </div>
   <div className="lv-quests"><h3>This week's goals</h3>{st.quests.map(q=>{const Icon=questIcon[q.id as keyof typeof questIcon],pct=Math.min(100,q.value/q.target*100),done=q.value>=q.target;return <div key={q.id} className={`lv-quest${done?' done':''}`}><span className="lv-q-icon">{done?<Check size={16} strokeWidth={3}/>:<Icon size={16}/>}</span><div><strong>{q.label}</strong><i><b style={{width:`${pct}%`}}/></i></div><small>{Math.min(q.value,q.target)}/{q.target}</small></div>;})}</div>
  </Entrance>
  <Entrance className="panel lv-ladder"><div className="panel-heading"><div><span className="eyebrow">RANK LADDER</span><h2>Your road to Legend</h2><p>Six ranks. Each one takes more real training than the last, and no shortcut skips a step.</p></div><Trophy size={22}/></div>
   <ol>{TIERS.map((t,i)=>{const reached=st.level>=t.min,current=st.tier.name===t.name,need=xpToReach(t.min);const after=TIERS[i+1];const into=current&&after?Math.max(0,Math.min(100,(st.xp-need)/(xpToReach(after.min)-need)*100)):reached?100:0;
    return <li key={t.name} className={`${reached?'reached':''}${current?' current':''}`} style={{'--t':t.color} as React.CSSProperties}><span className="lv-node">{reached?<Check size={16} strokeWidth={3}/>:<Lock size={14}/>}</span><strong>{t.name}</strong><small>Level {t.min}</small><small className="need">{need.toLocaleString()} XP</small>{i<TIERS.length-1&&<i className="lv-link"><b style={{width:`${into}%`}}/></i>}</li>;})}</ol></Entrance>
  <Entrance className="panel lv-badges"><div className="panel-heading"><div><h2>Badges</h2><p>{st.badges.filter(b=>b.done).length} of {st.badges.length} unlocked. Each one is earned by training.</p></div><Award size={22}/></div>
   <ul>{st.badges.map(b=>{const Icon=badgeIcon[b.id]||Award;return <li key={b.id} className={b.done?'on':''}><span>{b.done?<Icon size={22}/>:<Lock size={18}/>}</span><strong>{b.name}</strong><small>{b.done?'Unlocked':b.hint}</small></li>;})}</ul>
  </Entrance>
  {up&&<div className="lv-up" role="status" aria-label={`Level up. You reached level ${up}`}><div className="lv-up-card" style={{'--lv':tier.color} as React.CSSProperties}>{Array.from({length:14},(_,i)=><i key={i} className="spark" style={{'--a':`${i*25.7}deg`,'--d':`${i%3*.08}s`} as React.CSSProperties}/>)}<Hex level={up} color={tier.color}/><h3>Level up!</h3><p>You are now a <b style={{color:tier.color}}>{tier.name}</b>. Keep going.</p><button type="button" className="fs-primary" onClick={()=>setUp(null)}>Nice</button></div></div>}
 </>;
}

// The full points history lives on its own page, opened from the level card.
export function XpHistoryPage({s,today}:{s:Snapshot;today:string}){
 const st=fitnessStats(s,today),hist=xpHistory(s,today);
 return <div className="xp-page"><Entrance className="panel xp-summary" style={{'--lv':st.tier.color} as React.CSSProperties}><Hex level={st.level} color={st.tier.color}/><div><span className="eyebrow">YOUR LEVEL</span><h2><b style={{color:st.tier.color}}>{st.tier.name}</b> · Level {st.level}</h2><p>{st.xp.toLocaleString()} XP earned in total. {st.span-st.into} XP to level {st.level+1}.</p></div><Link className="button" href="/fitness"><ArrowRight size={14} style={{transform:'rotate(180deg)'}}/>Back to Fitness</Link></Entrance>
  <Entrance className="panel lv-history lv-history-page"><div className="panel-heading"><div><h2>XP history</h2><p>Every finished workout adds points. Finished sessions stay finished, so your points are safe.</p></div><Zap size={22}/></div>
   {hist.length?<ol>{hist.map(h=><li key={h.id}><span className="lh-dot"><Dumbbell size={16}/></span><div><strong>{h.title}</strong><small>{new Date(`${h.date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})} · {h.type} · {h.minutes} min</small>{h.note&&<em className="lh-note">{h.note}</em>}{h.leveledUp&&<em className="lh-level"><Trophy size={13}/>Reached level {h.level}</em>}</div><b className={`xp-chip${h.xp?' got':''}`}><Zap size={12}/>{h.xp?`+${h.xp} XP`:'0 XP'}</b><small className="lh-total">{h.total} XP</small></li>)}</ol>:<p className="muted lh-empty">Finish a workout and your first points appear here.</p>}
  </Entrance>
 </div>;
}
