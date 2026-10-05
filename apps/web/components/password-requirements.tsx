import { passwordChecks } from '@ledger/shared';
import { Check } from 'lucide-react';
export function PasswordRequirements({value}:{value:string}){
 const checks=passwordChecks(value);
 return <ul id="password-requirements" className="password-requirements" aria-label="Password requirements">
  {[[checks.length,'At least 12 characters'],[checks.mix,'Mix of letters, numbers, and symbols']].map(([met,label])=><li key={String(label)} className={met?'met':''}><span aria-hidden="true">{met&&<Check size={10}/>}</span><span>{label}{met&&<span className="sr-only"> — met</span>}</span></li>)}
 </ul>;
}
