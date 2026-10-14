'use client';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {schemas,type LedgerRecord} from '@ledger/shared';
import {adapter} from '../lib/data';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';

// Set a manual goal by how far along it is: drag the slider or type a percentage, and the amount follows.
export function GoalProgressDialog({goal,open,onOpenChange}:{goal:LedgerRecord<'goal'>;open:boolean;onOpenChange:(v:boolean)=>void}){
 const client=useQueryClient();const target=goal.data.target;
 const start=Math.min(100,Math.round(goal.data.current/target*100));
 const [percent,setPercent]=useState(start),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const amount=Math.round(target*percent)/100;
 async function save(){
  setBusy(true);setError('');
  try{
   const data=schemas.goal.parse({...goal.data,current:Math.round(target*percent/100*100)/100});
   await adapter.save({kind:'goal',id:goal.id,version:goal.version,data});await client.invalidateQueries({queryKey:['snapshot']});onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v);}} title="How far along are you?" description={`Set the progress for “${goal.data.title}”.`}>
  <div className="goal-slider">
   <div className="goal-slider-value"><strong>{percent}%</strong><span>{amount.toLocaleString()} of {target.toLocaleString()} {goal.data.unit}</span></div>
   <input type="range" min={0} max={100} step={1} value={percent} aria-label="Progress percentage" style={{['--fill' as string]:`${percent}%`}} onChange={e=>setPercent(Number(e.target.value))}/>
   <div className="goal-slider-quick" role="group" aria-label="Quick values">{[0,25,50,75,100].map(v=><button key={v} type="button" className={percent===v?'selected':''} onClick={()=>setPercent(v)}>{v}%</button>)}</div>
   <label className="goal-slider-number"><span>Or type a percentage</span><input type="number" min={0} max={100} value={percent} aria-label="Progress percentage number" onChange={e=>setPercent(Math.min(100,Math.max(0,Math.round(Number(e.target.value)||0))))}/></label>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <div className="dialog-actions"><Button onClick={()=>onOpenChange(false)} disabled={busy}>Cancel</Button><Button variant="primary" onClick={()=>void save()} disabled={busy} loading={busy}>Save progress</Button></div>
 </Dialog>;
}
