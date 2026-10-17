'use client';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {dateLocale} from '@ledger/shared';
import {Select} from './ui/select';
const shift=(month:string,by:number)=>{const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+by,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;};
const label=(month:string)=>{const [y,m]=month.split('-').map(Number);return new Intl.DateTimeFormat(dateLocale(),{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));};
// A month picker that looks the same in every browser (Firefox has no native month field) and steps with one tap on a phone.
export function MonthStepper({value,onChange}:{value:string;onChange:(month:string)=>void}){
 const options=Array.from({length:49},(_,i)=>shift(value,i-36)).map(m=>({value:m,label:label(m)}));
 return <div className="month-control month-stepper" role="group" aria-label="Month"><button type="button" className="icon-button" aria-label="Previous month" onClick={()=>onChange(shift(value,-1))}><ChevronLeft size={17}/></button><Select label="Selected month" className="month-select" value={value} onChange={onChange} options={options}/><button type="button" className="icon-button" aria-label="Next month" onClick={()=>onChange(shift(value,1))}><ChevronRight size={17}/></button></div>;
}
