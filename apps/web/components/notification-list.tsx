'use client';
import {Bell,Check,CircleCheck,Clock3,Dumbbell,Flame,PiggyBank,Receipt,Sparkles,Target,Wallet} from 'lucide-react';
import type {LedgerRecord} from '@ledger/shared';

type Tone='warn'|'good'|'info';
// Pick an icon and colour from what the message is about, so a glance tells you what kind of news it is.
function kindOf(title:string):{Icon:typeof Bell;tone:Tone}{
 const t=title.toLowerCase();
 if(/overdue|due |missed|late/.test(t))return {Icon:Clock3,tone:'warn'};
 if(/budget|limit|spent/.test(t))return {Icon:PiggyBank,tone:'warn'};
 if(/bill|payment|invoice/.test(t))return {Icon:Receipt,tone:'warn'};
 if(/habit|streak/.test(t))return {Icon:Flame,tone:'good'};
 if(/goal|milestone/.test(t))return {Icon:Target,tone:'good'};
 if(/workout|exercise|training/.test(t))return {Icon:Dumbbell,tone:'good'};
 if(/income|saved|savings|salary/.test(t))return {Icon:Wallet,tone:'good'};
 if(/done|complete/.test(t))return {Icon:CircleCheck,tone:'good'};
 if(/welcome|new|tip|trial/.test(t))return {Icon:Sparkles,tone:'info'};
 return {Icon:Bell,tone:'info'};
}
const dayDiff=(today:string,date:string)=>Math.round((Date.parse(`${today}T12:00:00Z`)-Date.parse(`${date}T12:00:00Z`))/864e5);
const group=(today:string,date:string)=>{const d=dayDiff(today,date);return d<=0?'Today':d===1?'Yesterday':d<7?'This week':'Earlier';};
const ago=(today:string,date:string)=>{const d=dayDiff(today,date);return d<=0?'Today':d===1?'Yesterday':d<7?`${d} days ago`:new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});};

export function NotificationList({records,today,onToggle}:{records:LedgerRecord<'notification'>[];today:string;onToggle:(r:LedgerRecord<'notification'>)=>void}){
 if(!records.length)return <div className="n-empty"><span><CircleCheck size={26}/></span><strong>You are all caught up</strong><p>Budget alerts, reminders and streaks will show up here.</p></div>;
 const sorted=[...records].sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date)));
 const groups=['Today','Yesterday','This week','Earlier'].map(label=>({label,items:sorted.filter(r=>group(today,String(r.data.date))===label)})).filter(g=>g.items.length);
 let index=0;
 return <div className="n-groups">{groups.map(g=><section key={g.label} className="n-group" aria-label={g.label}><h3>{g.label}</h3><ul className="notification-list">{g.items.map(r=>{const [head,...rest]=String(r.data.title).split(' — ');const {Icon,tone}=kindOf(String(r.data.title));const unread=!r.data.read;return <li key={r.id} style={{animationDelay:`${Math.min(index++,8)*45}ms`}}>
   <button className={`notification-item n-card${unread?' is-unread':' is-read'}`} data-tone={tone} onClick={()=>onToggle(r)} aria-label={`${head}. ${unread?'Unread, tap to mark as read':'Read, tap to mark as unread'}`}>
    <span className="n-icon" aria-hidden="true">{unread?<Icon size={18}/>:<Check size={16}/>}</span>
    <span className="n-body"><span className="n-head"><strong>{head}</strong><time>{ago(today,String(r.data.date))}</time></span>{rest.length>0&&<span className="n-text">{rest.join(' — ')}</span>}<small>{unread?'Tap to mark as read':'Read'}</small></span>
    {unread&&<i className="n-dot" aria-hidden="true"/>}
   </button></li>;})}</ul></section>)}</div>;
}
