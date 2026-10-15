import {z} from 'zod';

// How this person likes numbers, dates and measurements shown. Stored as given; money, dates and weights are converted only when displayed.
export const displaySchema=z.object({
 units:z.enum(['metric','imperial']),
 weekStart:z.union([z.literal(0),z.literal(1),z.literal(6)]),
 dateFormat:z.enum(['mdy','dmy','iso']),
 numberFormat:z.enum(['us','eu','in','ch'])
});
export type Display=z.infer<typeof displaySchema>;
export const defaultDisplay:Display={units:'metric',weekStart:1,dateFormat:'mdy',numberFormat:'us'};
export const displayOptions={
 units:[{value:'metric',label:'Metric',hint:'kg, cm'},{value:'imperial',label:'Imperial',hint:'lb, ft and in'}],
 weekStart:[{value:'1',label:'Monday'},{value:'0',label:'Sunday'},{value:'6',label:'Saturday'}],
 dateFormat:[{value:'mdy',label:'Sep 30, 2026',hint:'Month first'},{value:'dmy',label:'30 Sep 2026',hint:'Day first'},{value:'iso',label:'2026-09-30',hint:'Year first'}],
 numberFormat:[{value:'us',label:'1,234.56',hint:'US, UK'},{value:'eu',label:'1.234,56',hint:'Europe'},{value:'in',label:'12,34,567.89',hint:'India, Pakistan'},{value:'ch',label:'1’234.56',hint:'Switzerland'}]
} as const;

let current:Display=defaultDisplay;
export function setDisplay(value?:Partial<Display>|null){current={...defaultDisplay,...(value||{})};}
export const getDisplay=()=>current;
export const numberLocale=()=>({us:'en-US',eu:'de-DE',in:'en-IN',ch:'de-CH'} as const)[current.numberFormat];
export const dateLocale=()=>current.dateFormat==='mdy'?'en-US':'en-GB';
export const isImperial=()=>current.units==='imperial';

const KG_PER_LB=0.45359237,CM_PER_IN=2.54;
export const weightUnit=()=>isImperial()?'lb':'kg';
export const kgToDisplay=(kg:number,decimals=1)=>{const v=isImperial()?kg/KG_PER_LB:kg,f=10**decimals;return Math.round(v*f)/f;};
export const displayToKg=(value:number)=>isImperial()?Math.round(value*KG_PER_LB*100)/100:value;
export const formatWeight=(kg:number,decimals=0)=>`${kgToDisplay(kg,decimals).toLocaleString(numberLocale())} ${weightUnit()}`;
export const cmToFeetInches=(cm:number)=>{const total=Math.round(cm/CM_PER_IN);return {feet:Math.floor(total/12),inches:total%12};};
export const feetInchesToCm=(feet:number,inches:number)=>Math.round((feet*12+inches)*CM_PER_IN);

// Dates arrive as YYYY-MM-DD. Short: 30 Sep or Sep 30. Long adds the year.
export function formatDate(date:string,style:'short'|'long'='long'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return date;
 if(current.dateFormat==='iso')return style==='long'?date:date.slice(5);
 const [y,m,d]=date.split('-').map(Number),mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
 if(current.dateFormat==='dmy')return style==='long'?`${d} ${mon} ${y}`:`${d} ${mon}`;
 return style==='long'?`${mon} ${d}, ${y}`:`${mon} ${d}`;
}
