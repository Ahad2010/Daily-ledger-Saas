import type {ChangeEvent} from 'react';
// Amounts read easier with thousands commas: 100000 shows as 100,000. The stored value never contains them.
export const group=(value:string)=>{const [whole,decimals]=value.replace(/[^\d.]/g,'').split('.');const spaced=(whole||'').replace(/\B(?=(\d{3})+(?!\d))/g,',');return decimals===undefined?spaced:`${spaced}.${decimals.slice(0,2)}`;};
export const ungroup=(value:string)=>value.replace(/,/g,'');
/** Regroups the field as the person types and keeps the cursor beside the digit they just typed. */
export function groupAsTyped(e:ChangeEvent<HTMLInputElement>,decimals=false){
 const el=e.target,raw=el.value,caret=el.selectionStart??raw.length;
 const before=raw.slice(0,caret).replace(decimals?/[^\d.]/g:/\D/g,'').length;
 const next=group(decimals?raw:raw.replace(/\..*$/,'')).slice(0,decimals?16:16);
 el.value=next;
 let pos=0,seen=0;while(pos<next.length&&seen<before){if(/[\d.]/.test(next[pos]))seen++;pos++;}
 try{el.setSelectionRange(pos,pos);}catch{/* some input types have no cursor */}
}
