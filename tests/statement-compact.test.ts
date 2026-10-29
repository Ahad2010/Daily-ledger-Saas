import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoSnapshot} from '../packages/shared/src/index';
import {drawStatement,type PdfLike} from '../packages/shared/src/statement';

// A recording stand-in for PDFKit: every call returns the same object and every text() call is kept.
function recorder(){
 const texts:string[]=[];
 const doc:any=new Proxy({page:{width:595,height:842,margins:{left:40,right:40,top:40,bottom:40}},y:40},{
  get(target:any,key:string){
   if(key==='text')return (text:string)=>{texts.push(String(text));return doc;};
   if(key==='widthOfString')return (text:string)=>String(text).length*5;
   if(key==='bufferedPageRange')return ()=>({start:0,count:1});
   if(key in target)return target[key];
   return ()=>doc;
  },
  set(target:any,key:string,value:unknown){target[key]=value;return true;}
 });
 return {doc:doc as PdfLike,texts};
}
const withHugeIncome=()=>{
 const s=demoSnapshot();s.profile={...s.profile,currency:'PKR'};
 s.records.push({id:'huge-income',kind:'transaction',version:1,data:{title:'Big deal',date:'2026-10-05',amount:1_000_000_000_00,currency:'PKR',type:'income',category:'Work',account:'Checking',notes:''}} as never);
 return s;
};

test('the PDF statement shows very large totals in short form so they never get cut off',async()=>{
 const {doc,texts}=recorder();drawStatement(doc,withHugeIncome(),'2026-10',new Date('2026-10-29T10:00:00Z'));
 const compact=/^PKR\s1(\.\d+)?B$/,after=(label:string)=>texts[texts.findIndex(t=>t.toUpperCase()===label)+1];
 assert.match(after('MONEY IN'),compact,'Money in box is short');assert.match(after('NET MOVEMENT'),compact,'Net movement box is short');
 const totals=texts.filter(t=>/^PKR\s1(\.\d+)?B$/.test(t)).length;assert.ok(totals>=3,`the boxes and the weekly table use the short form (${totals} found)`);
});
