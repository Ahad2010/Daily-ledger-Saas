import PDFDocument from 'pdfkit';
import type {Response} from 'express';
import {money,reportSections,type Snapshot} from '@ledger/shared';

const INK='#111111',MUTED='#666666',RULE='#d0d0d0';
// Plain, printable monthly report generated on demand from the same sections as the CSV and the on-screen report.
export function renderReportPdf(res:Response,s:Snapshot,month:string,now=new Date()){
 const doc=new PDFDocument({size:'A4',margin:50,info:{Title:`Daily Ledger report ${month}`,Author:'Daily Ledger'}});doc.pipe(res);
 const currency=s.profile.currency,left=50,width=495,label=new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 const fmt=(heading:string,column:number,value:string|number)=>{
  if(typeof value==='string')return value;
  if(heading==='Overview')return /^(Income|Expenses|Net savings|Budget)$/.test(String(value))?String(value):String(value);
  if(heading==='Week by week')return column>=1&&column<=3?money(value*100,currency):column===6?`${value}%`:String(value);
  if(heading==='Spending by category')return column===1||column===3?money(value*100,currency):column===2||column===4?`${value}%`:String(value);
  return String(value);
 };
 const ensure=(height:number)=>{if(doc.y+height>doc.page.height-70)doc.addPage();};
 doc.fillColor(INK).font('Helvetica-Bold').fontSize(22).text('Daily Ledger');
 doc.font('Helvetica').fontSize(12).fillColor(MUTED).text(`Monthly report · ${label} · ${currency}`).moveDown(1.2);
 for(const section of reportSections(s,month,now)){
  ensure(70);doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(section.heading).moveDown(.4);
  if(section.header){
   const columns=section.header.length,first=section.heading==='Week by week'?120:150,rest=(width-first)/(columns-1),x=(i:number)=>i===0?left:left+first+(i-1)*rest,w=(i:number)=>i===0?first-6:rest-6;
   const row=(cells:(string|number)[],bold:boolean)=>{ensure(18);const y=doc.y;doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(bold?8.5:9.5).fillColor(bold?MUTED:INK);cells.forEach((cell,i)=>doc.text(bold?String(cell):fmt(section.heading,i,cell),x(i),y,{width:w(i),lineBreak:false,ellipsis:true,align:i===0?'left':'right'}));doc.y=y+(bold?15:16);doc.moveTo(left,doc.y-2).lineTo(left+width,doc.y-2).strokeColor(RULE).lineWidth(.5).stroke();};
   row(section.header,true);
   if(section.rows.length)section.rows.forEach(r=>row(r,false));else{doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text('No data for this period.',left,doc.y+2);doc.moveDown(.6);}
  }else{
   for(const [name,value] of section.rows){ensure(18);const y=doc.y;const money$=/^(Income|Expenses|Net savings|Budget)$/.test(String(name));doc.font('Helvetica').fontSize(10.5).fillColor(MUTED).text(String(name),left,y,{width:240,lineBreak:false});doc.fillColor(INK).text(money$?money(Number(value)*100,currency):String(value),left+250,y,{width:width-250,lineBreak:false,align:'right'});doc.y=y+17;}
  }
  doc.moveDown(1);
 }
 doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Figures come from your own records. Transfers are excluded and only transactions in the report currency are included. Task completion counts tasks due in the period; habit completion counts scheduled occurrences only.',left,doc.y,{width});
 doc.end();
}
