'use client';
import {useEffect,useState} from 'react';
import {Award,Check,Dumbbell,Flame,Lock,Sparkles,Target,Timer,Trophy,Zap} from 'lucide-react';
import type {Snapshot} from '@ledger/shared';
import {fitnessStats,TIERS,tierAt} from '../lib/fitness-xp';
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
 const [up,setUp]=useState<number|null>(null);
 useEffect(()=>{
  try{const seen=Number(localStorage.getItem('dl-fit-level')||0);if(seen&&st.level>seen){setUp(st.level);clockTick();setTimeout(clockTick,140);setTimeout(clockTick,280);}localStorage.setItem('dl-fit-level',String(Math.max(seen,st.level)));}catch{/* private mode */}
 },[st.level]);
 useEffect(()=>{if(up===null)return;const id=setTimeout(()=>setUp(null),6000);return()=>clearTimeout(id);},[up]);
 const tier=tierAt(up||st.level);
 return <>
  <Entrance className="panel lv-hero" style={{'--lv':st.tier.color} as React.CSSProperties}>
   <div className="lv-main"><Hex level={st.level} color={st.tier.color}/>
    <div className="lv-info">
     <span className="eyebrow">YOUR RANK</span><h2><b style={{color:st.tier.color}}>{st.tier.name}</b></h2>
     <div className="lv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={st.span} aria-valuenow={st.into} aria-label={`${st.into} of ${st.span} XP to level ${st.level+1}`}><i style={{width:`${st.span?Math.min(100,st.into/st.span*100):0}%`}}/></div>
     <p><strong><CountUp intro value={st.into} format={v=>`${v}`}/></strong> / {st.span} XP · <span>{st.span-st.into} XP to level {st.level+1}</span></p>
     <div className="lv-chips"><span className="streak"><Flame size={15}/>{st.streak} day streak</span><span><Zap size={15}/>{st.weekXp} XP this week</span>{next&&<span>Next rank: {next.name} at level {next.min}</span>}</div>
    </div>
   </div>
   <div className="lv-quests"><h3>This week's goals</h3>{st.quests.map(q=>{const Icon=questIcon[q.id as keyof typeof questIcon],pct=Math.min(100,q.value/q.target*100),done=q.value>=q.target;return <div key={q.id} className={`lv-quest${done?' done':''}`}><span className="lv-q-icon">{done?<Check size={16} strokeWidth={3}/>:<Icon size={16}/>}</span><div><strong>{q.label}</strong><i><b style={{width:`${pct}%`}}/></i></div><small>{Math.min(q.value,q.target)}/{q.target}</small></div>;})}</div>
  </Entrance>
  <Entrance className="panel lv-badges"><div className="panel-heading"><div><h2>Badges</h2><p>{st.badges.filter(b=>b.done).length} of {st.badges.length} unlocked. Each one is earned by training.</p></div><Award size={22}/></div>
   <ul>{st.badges.map(b=>{const Icon=badgeIcon[b.id]||Award;return <li key={b.id} className={b.done?'on':''}><span>{b.done?<Icon size={22}/>:<Lock size={18}/>}</span><strong>{b.name}</strong><small>{b.done?'Unlocked':b.hint}</small></li>;})}</ul>
  </Entrance>
  {up&&<div className="lv-up" role="status" aria-label={`Level up. You reached level ${up}`}><div className="lv-up-card" style={{'--lv':tier.color} as React.CSSProperties}>{Array.from({length:14},(_,i)=><i key={i} className="spark" style={{'--a':`${i*25.7}deg`,'--d':`${i%3*.08}s`} as React.CSSProperties}/>)}<Hex level={up} color={tier.color}/><h3>Level up!</h3><p>You are now a <b style={{color:tier.color}}>{tier.name}</b>. Keep going.</p><button type="button" className="fs-primary" onClick={()=>setUp(null)}>Nice</button></div></div>}
 </>;
}
