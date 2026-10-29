import {money,moneyFit,recordsOf,metrics,type Snapshot} from './index';
import {monthReport} from './report';

// The slice of PDFKit's document API the statement uses, so the same layout renders on the server (pdfkit) and in the browser (pdfkit standalone).
export interface PdfLike{
 page:{width:number;height:number;margins:{left:number;right:number;top:number;bottom:number}};y:number;
 font(name:string):PdfLike;fontSize(size:number):PdfLike;fillColor(color:string):PdfLike;strokeColor(color:string):PdfLike;lineWidth(n:number):PdfLike;
 text(text:string,x?:number|Record<string,unknown>,y?:number,options?:Record<string,unknown>):PdfLike;
 rect(x:number,y:number,w:number,h:number):PdfLike;roundedRect(x:number,y:number,w:number,h:number,r:number):PdfLike;moveTo(x:number,y:number):PdfLike;lineTo(x:number,y:number):PdfLike;
 fill():PdfLike;stroke():PdfLike;addPage():PdfLike;widthOfString(text:string):number;
 bufferedPageRange():{start:number;count:number};switchToPage(n:number):PdfLike;
}

const INK='#14181a',MUTED='#6b7570',RULE='#dfe4e1',BRAND='#0d1f16',LIME='#8fd14f',IN='#1f7a4d',OUT='#b42318',SOFT='#f4f7f5';
const L=48,W=499;

// A bank-statement style monthly PDF: account block, summary, every transaction with a running net, then categories and weeks.
export function drawStatement(doc:PdfLike,s:Snapshot,month:string,now=new Date()){
 const currency=s.profile.currency,tz=s.profile.timezone,report=monthReport(s.records,month,currency,tz,now),m=metrics(s.records,month,currency,tz,now),c=report.current;
 const label=new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 const day=(d:string)=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US',{day:'2-digit',month:'short',timeZone:'UTC'});
 const dayLong=(d:string)=>new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 const fit=(text:string,width:number,size:number)=>{doc.fontSize(size);if(doc.widthOfString(text)<=width)return text;let t=text;while(t.length>1&&doc.widthOfString(t+'...')>width)t=t.slice(0,-1);return t+'...';};
 const bottom=doc.page.height-62;
 const ensure=(h:number,redraw?:()=>void)=>{if(doc.y+h>bottom){doc.addPage();doc.y=48;redraw?.();}};
 const right=(text:string,xRight:number,y:number,width:number)=>doc.text(text,xRight-width,y,{width,align:'right',lineBreak:false});

 // Header band
 doc.rect(0,0,doc.page.width,104).fillColor(BRAND).fill();doc.rect(0,104,doc.page.width,3).fillColor(LIME).fill();
 doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff').text('Daily Ledger',L,34,{lineBreak:false});
 doc.font('Helvetica').fontSize(10).fillColor('#a9c9b4').text('Account statement',L,60,{lineBreak:false});
 doc.font('Helvetica-Bold').fontSize(13).fillColor('#ffffff');right(label,L+W,36,260);
 doc.font('Helvetica').fontSize(9.5).fillColor('#a9c9b4');right(`${dayLong(`${month}-01`)} to ${dayLong(report.end)}`,L+W,58,300);
 doc.y=126;

 // Account block
 const info:[string,string][]=[['Account holder',s.profile.name],['Email',s.profile.email],['Currency',currency],['Statement date',dayLong(now.toISOString().slice(0,10))]];
 info.forEach(([k,v],i)=>{const x=L+(i%2)*255,y=126+Math.floor(i/2)*30;doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k.toUpperCase(),x,y,{lineBreak:false});doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(fit(v,230,10.5),x,y+12,{lineBreak:false});});
 doc.y=196;

 // Summary boxes
 const boxes:[string,string,string][]=[['Money in',moneyFit(c.income,currency,10_000_000),IN],['Money out',moneyFit(c.expenses,currency,10_000_000),OUT],['Net movement',moneyFit(c.net,currency,10_000_000),c.net<0?OUT:IN],['Savings rate',m.savingsRate===null?'n/a':`${Math.round(m.savingsRate)}%`,INK]];
 const bw=(W-3*10)/4;
 boxes.forEach(([k,v,col],i)=>{const x=L+i*(bw+10);doc.roundedRect(x,196,bw,58,8).fillColor(SOFT).fill();doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(k.toUpperCase(),x+12,208,{lineBreak:false});doc.font('Helvetica-Bold').fontSize(13).fillColor(col).text(fit(v,bw-20,13),x+12,226,{lineBreak:false});});
 doc.y=272;
 if(m.budget){const used=Math.min(100,c.expenses/m.budget*100);doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Budget: ${money(c.expenses,currency)} of ${money(m.budget,currency)} used (${Math.round(c.expenses/m.budget*100)}%)`,L,272,{lineBreak:false});doc.roundedRect(L,288,W,6,3).fillColor(RULE).fill();doc.roundedRect(L,288,Math.max(6,W*used/100),6,3).fillColor(c.expenses>m.budget?OUT:LIME).fill();doc.y=310;}

 // Transactions
 const tx=recordsOf(s.records,'transaction').filter(r=>r.data.currency===currency&&r.data.type!=='transfer'&&r.data.date.startsWith(month)&&r.data.date<=report.end).sort((a,b)=>a.data.date.localeCompare(b.data.date));
 const cols={date:L+8,desc:L+58,cat:L+194,out:L+275,inn:L+350,bal:L+W-8},descW=130,catW=76;
 const section=(title:string,sub?:string)=>{ensure(60);doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(title,L,doc.y+8,{lineBreak:false});if(sub)doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(sub,L,doc.y+24,{lineBreak:false});doc.y+=sub?44:34;};
 const txHead=()=>{const y=doc.y;doc.rect(L,y,W,20).fillColor(BRAND).fill();doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');doc.text('DATE',cols.date,y+6,{lineBreak:false});doc.text('DESCRIPTION',cols.desc,y+6,{lineBreak:false});doc.text('CATEGORY',cols.cat,y+6,{lineBreak:false});right('MONEY OUT',cols.out+70,y+6,70);right('MONEY IN',cols.inn+70,y+6,70);right('NET TOTAL',cols.bal,y+6,70);doc.y=y+24;};
 section('Transactions',`${tx.length} ${tx.length===1?'transaction':'transactions'} in ${label}. Transfers between your own accounts are not counted.`);
 if(tx.length){
  txHead();let running=0;
  tx.forEach((r,i)=>{ensure(22,txHead);const y=doc.y,isIn=r.data.type==='income';running+=isIn?r.data.amount:-r.data.amount;
   if(i%2===0)doc.rect(L,y-3,W,20).fillColor(SOFT).fill();
   doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(day(r.data.date),cols.date,y+1,{lineBreak:false});
   doc.fillColor(INK).text(fit(r.data.title,descW,9),cols.desc,y+1,{lineBreak:false});doc.fillColor(MUTED).text(fit(r.data.category,catW,9),cols.cat,y+1,{lineBreak:false});
   if(!isIn){doc.fillColor(OUT);right(money(r.data.amount,currency),cols.out+70,y+1,70);}else{doc.fillColor(IN);right(money(r.data.amount,currency),cols.inn+70,y+1,70);}
   doc.fillColor(running<0?OUT:INK);right(money(running,currency),cols.bal,y+1,70);doc.y=y+20;});
  const y=doc.y+2;doc.moveTo(L,y).lineTo(L+W,y).strokeColor(INK).lineWidth(.8).stroke();doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text('Totals',cols.desc,y+8,{lineBreak:false});doc.fillColor(OUT);right(moneyFit(c.expenses,currency,10_000_000),cols.out+70,y+8,70);doc.fillColor(IN);right(moneyFit(c.income,currency,10_000_000),cols.inn+70,y+8,70);doc.fillColor(c.net<0?OUT:INK);right(moneyFit(c.net,currency,10_000_000),cols.bal,y+8,70);doc.y=y+30;
 }else{doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No transactions were recorded in this period.',L,doc.y,{lineBreak:false});doc.y+=26;}

 // Categories
 if(report.categories.length){
  section('Spending by category','Share of money out, compared with the previous period.');
  report.categories.slice(0,12).forEach(cat=>{ensure(26);const y=doc.y;doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(fit(cat.name,150,9.5),L+8,y,{lineBreak:false});doc.roundedRect(L+170,y+3,150,6,3).fillColor(RULE).fill();doc.roundedRect(L+170,y+3,Math.max(4,150*cat.percentage/100),6,3).fillColor(LIME).fill();doc.fillColor(MUTED).text(`${Math.round(cat.percentage)}%`,L+330,y,{lineBreak:false});doc.fillColor(INK);right(money(cat.amount,currency),L+W-8,y,110);doc.y=y+22;});
 }

 // Weeks
 section('Week by week','Monday to Sunday, clipped to the statement period.');
 const wx=[L+8,L+138,L+228,L+318,L+390,L+450];
 const weekHead=()=>{const y=doc.y;doc.rect(L,y,W,20).fillColor(BRAND).fill();doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');['WEEK','MONEY IN','MONEY OUT','NET','TASKS','HABITS'].forEach((h,i)=>doc.text(h,wx[i],y+6,{lineBreak:false}));doc.y=y+24;};
 weekHead();
 report.weeks.forEach((w,i)=>{ensure(22,weekHead);const y=doc.y;if(i%2===0)doc.rect(L,y-3,W,20).fillColor(SOFT).fill();doc.font('Helvetica').fontSize(9).fillColor(INK).text(w.label,wx[0],y+1,{lineBreak:false});doc.fillColor(IN).text(moneyFit(w.income,currency,10_000_000),wx[1],y+1,{lineBreak:false});doc.fillColor(OUT).text(moneyFit(w.expenses,currency,10_000_000),wx[2],y+1,{lineBreak:false});doc.fillColor(w.net<0?OUT:INK).text(moneyFit(w.net,currency,10_000_000),wx[3],y+1,{lineBreak:false});doc.fillColor(MUTED).text(w.tasksDue?`${w.tasksDone}/${w.tasksDue}`:'-',wx[4],y+1,{lineBreak:false});doc.text(w.habitRate===null?'-':`${Math.round(w.habitRate)}%`,wx[5],y+1,{lineBreak:false});doc.y=y+20;});

 doc.y+=14;ensure(40);
 doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Figures come from your own Daily Ledger records and are not issued by a bank. Transfers are excluded and only transactions in the statement currency are included.',L,doc.y,{width:W});

 // Footer on every page
 const range=doc.bufferedPageRange();doc.page.margins.bottom=0;
 for(let i=0;i<range.count;i++){doc.switchToPage(range.start+i);doc.page.margins.bottom=0;doc.moveTo(L,doc.page.height-44).lineTo(L+W,doc.page.height-44).strokeColor(RULE).lineWidth(.6).stroke();doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Daily Ledger · ${s.profile.name} · ${label}`,L,doc.page.height-34,{lineBreak:false});right(`Page ${i+1} of ${range.count}`,L+W,doc.page.height-34,120);}
}
