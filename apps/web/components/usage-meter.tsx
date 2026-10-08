'use client';
import {AnimatedProgress} from './animation';

export type UsageLevel='unlimited'|'ok'|'high'|'full';
// Red from 80% like the usage meters people know from Claude/Codex; 100% reads as a hard limit.
export function usageLevel(used:number,limit:number|null|undefined):UsageLevel{
 if(limit===null||limit===undefined||!Number.isFinite(limit))return 'unlimited';
 if(limit<=0)return used>0?'full':'ok';
 const percent=used/limit*100;
 return percent>=100?'full':percent>=80?'high':'ok';
}
export function UsageMeter({used,limit,label}:{used:number;limit:number|null|undefined;label?:string}){
 const level=usageLevel(used,limit);
 if(level==='unlimited'||!limit||limit<=0)return null;
 const percent=Math.min(100,used/limit*100);
 return <div className="usage-meter" data-level={level} aria-label={label?`${label}: ${Math.round(percent)}% used`:undefined}><AnimatedProgress value={percent}/>{level!=='ok'&&<span className="usage-flag">{level==='full'?'Limit reached':`${Math.floor(percent)}% used`}</span>}</div>;
}
