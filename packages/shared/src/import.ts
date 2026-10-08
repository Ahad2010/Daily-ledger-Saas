import {schemas,type RecordData} from './index';

// Bank CSV import. Everything here is pure and deterministic: money is parsed from text into integer minor units
// without floating point, and every row is validated with the same schema as a hand-entered transaction.
export const IMPORT_MAX_ROWS=5000;
export const IMPORT_CHUNK=200;

export function parseCsv(input:string):{rows:string[][];delimiter:string}{
 const text=input.replace(/^﻿/,'');
 const firstLine=text.split(/\r\n|\n|\r/)[0]||'';
 const count=(char:string)=>{let inQuotes=false,n=0;for(const c of firstLine){if(c==='"')inQuotes=!inQuotes;else if(c===char&&!inQuotes)n++;}return n;};
 const delimiter=[',',';','\t'].map(char=>({char,n:count(char)})).sort((a,b)=>b.n-a.n)[0];
 const separator=delimiter.n>0?delimiter.char:',';
 const rows:string[][]=[];let row:string[]=[],field='',inQuotes=false,touched=false;
 const endField=()=>{row.push(field);field='';};
 const endRow=()=>{endField();if(row.some(cell=>cell.trim()!==''))rows.push(row);row=[];touched=false;if(rows.length>IMPORT_MAX_ROWS+1)throw new Error(`Files are limited to ${IMPORT_MAX_ROWS} rows. Split the file by date and import it in parts.`);};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(inQuotes){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else inQuotes=false;}else field+=c;continue;}
  if(c==='"'&&field===''){inQuotes=true;touched=true;}
  else if(c===separator){endField();touched=true;}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;endRow();}
  else{field+=c;touched=true;}
 }
 if(touched||field!==''||row.length)endRow();
 return {rows,delimiter:separator};
}

export type ColumnMap={date?:number;description?:number;amount?:number;debit?:number;credit?:number;type?:number;category?:number;account?:number;notes?:number};
export function guessColumns(headers:string[]):ColumnMap{
 const used=new Set<number>(),map:ColumnMap={};
 const find=(patterns:RegExp[])=>{for(const pattern of patterns){const index=headers.findIndex((h,i)=>!used.has(i)&&pattern.test(h.trim().toLowerCase()));if(index>=0){used.add(index);return index;}}return undefined;};
 map.date=find([/^(transaction |posting |posted |booking |value )?date$/,/date|datum|fecha|posted/]);
 map.debit=find([/debit|withdraw|paid out|money out|^dr$/]);
 map.credit=find([/credit|deposit|paid in|money in|^cr$/]);
 if(map.debit===undefined||map.credit===undefined){if(map.debit!==undefined)used.delete(map.debit);if(map.credit!==undefined)used.delete(map.credit);map.debit=undefined;map.credit=undefined;}
 map.amount=map.debit===undefined?find([/^(transaction )?amount( \(.*\))?$/,/amount|value|sum|^amt/]):undefined;
 map.type=find([/^(transaction )?type$/,/dr\/cr|debit\/credit/]);
 map.description=find([/^description$/,/description|details|narrat|memo|payee|merchant|particular|reference|name|title/]);
 map.category=find([/categor/]);
 map.account=find([/account|card/]);
 map.notes=find([/note|remark|comment/]);
 return Object.fromEntries(Object.entries(map).filter(([,v])=>v!==undefined)) as ColumnMap;
}

export type DecimalMark='auto'|'.'|',';
// Thousands groups must be 1–3 digits first, then exactly three: 1,234,567 is valid, 1,234,5 is not.
const groupedOk=(value:string,separator:string)=>!value.includes(separator)||(()=>{const groups=value.split(separator);return groups[0].length>=1&&groups[0].length<=3&&groups.slice(1).every(g=>g.length===3);})();
// Signed integer minor units (cents), or NaN. Handles 1,234.56 · 1.234,56 · 1 234,56 · 1'234.56 · (12.50) · 12.50- · USD 12 · 12.5 DR.
export function parseAmount(raw:string,decimal:DecimalMark='auto'):number{
 let v=raw.trim().replace(/[−‒–—]/g,'-');if(!v)return NaN;
 let negative=false;
 if(/^\(.*\)$/.test(v)){negative=true;v=v.slice(1,-1).trim();}
 if(v.startsWith('-')){negative=true;v=v.slice(1);}else if(v.startsWith('+'))v=v.slice(1);
 if(v.endsWith('-')){negative=true;v=v.slice(0,-1);}
 v=v.replace(/\b(dr|cr)\b\.?/gi,(_,mark:string)=>{if(mark.toLowerCase()==='dr')negative=true;return '';});
 const token=v.match(/\d[\d.,'   ]*\d|\d/);
 if(!token)return NaN;
 if(/\d/.test(v.slice((token.index||0)+token[0].length))||/\d/.test(v.slice(0,token.index||0)))return NaN;
 const t=token[0].replace(/['   ]/g,'');
 const lastDot=t.lastIndexOf('.'),lastComma=t.lastIndexOf(','),dots=(t.match(/\./g)||[]).length,commas=(t.match(/,/g)||[]).length;
 let mark:''|'.'|',';
 if(decimal!=='auto')mark=decimal;
 else if(lastDot>=0&&lastComma>=0)mark=lastDot>lastComma?'.':',';
 else if(dots+commas===0)mark='';
 else{const char=dots?'.':',',n=dots||commas;mark=n>1?'':(t.length-t.indexOf(char)-1===3?'':char);}
 let whole=t,fraction='';
 if(mark){
  const parts=t.split(mark);if(parts.length>2)return NaN;
  const other=mark==='.'?',':'.';fraction=parts[1]??'';
  if(fraction.includes(other)||!groupedOk(parts[0],other))return NaN;
  whole=parts[0].split(other).join('');
 }else{
  if(!groupedOk(t,t.includes('.')?'.':',')||(t.includes('.')&&t.includes(',')))return NaN;
  whole=t.replace(/[.,]/g,'');
 }
 if(!/^\d+$/.test(whole)||(fraction!==''&&!/^\d{1,2}$/.test(fraction))||whole.length>12)return NaN;
 const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return negative?-cents:cents;
}

export type DateFormat='iso'|'dmy'|'mdy';
const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function validDate(year:number,month:number,day:number){if(!(year>=1900&&year<=2100&&month>=1&&month<=12&&day>=1&&day<=31))return null;const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?`${String(year).padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;}
const fullYear=(value:string)=>value.length===2?(Number(value)<70?2000+Number(value):1900+Number(value)):Number(value);
export function parseDate(raw:string,format:DateFormat):string|null{
 const value=raw.trim().replace(/[T ]\d{1,2}:\d{2}.*$/,'').trim();if(!value)return null;
 const named=value.match(/^(\d{1,2})[ \-.]+([A-Za-z]{3,9})\.?,?[ \-.]+(\d{2}|\d{4})$/)||null;
 if(named){const month=months.indexOf(named[2].slice(0,3).toLowerCase());return month<0?null:validDate(fullYear(named[3]),month+1,Number(named[1]));}
 const american=value.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
 if(american){const month=months.indexOf(american[1].slice(0,3).toLowerCase());return month<0?null:validDate(Number(american[3]),month+1,Number(american[2]));}
 const parts=value.split(/[-/.]/);if(parts.length!==3||parts.some(p=>!/^\d+$/.test(p)))return null;
 if(parts[0].length===4)return validDate(Number(parts[0]),Number(parts[1]),Number(parts[2]));
 if(parts[2].length!==2&&parts[2].length!==4)return null;
 return format==='mdy'?validDate(fullYear(parts[2]),Number(parts[0]),Number(parts[1])):validDate(fullYear(parts[2]),Number(parts[1]),Number(parts[0]));
}
export function detectDateFormat(samples:string[]):{format:DateFormat;ambiguous:boolean}{
 let iso=false,dmy=false,mdy=false,numeric=0;
 for(const raw of samples){const parts=raw.trim().replace(/[T ]\d{1,2}:\d{2}.*$/,'').split(/[-/.]/);if(parts.length!==3||parts.some(p=>!/^\d+$/.test(p)))continue;numeric++;if(parts[0].length===4){iso=true;continue;}if(Number(parts[0])>12)dmy=true;if(Number(parts[1])>12)mdy=true;}
 if(iso&&!dmy&&!mdy)return {format:'iso',ambiguous:false};
 if(dmy&&!mdy)return {format:'dmy',ambiguous:false};
 if(mdy&&!dmy)return {format:'mdy',ambiguous:false};
 return {format:'dmy',ambiguous:numeric>0};
}

export interface ImportOptions{map:ColumnMap;currency:string;dateFormat:DateFormat;decimal:DecimalMark;negativeIsExpense:boolean;defaultCategory:string;defaultAccount:string}
export interface ImportedRow{line:number;data:RecordData['transaction']}
const clean=(value:string|undefined,max:number)=>(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export function mapTransactions(rows:string[][],options:ImportOptions):{items:ImportedRow[];errors:{line:number;message:string}[]}{
 const items:ImportedRow[]=[],errors:{line:number;message:string}[]=[],{map}=options;
 const cell=(row:string[],index?:number)=>index===undefined?'':(row[index]??'').trim();
 rows.slice(1).forEach((row,offset)=>{
  const line=offset+2,fail=(message:string)=>{errors.push({line,message});};
  if(map.date===undefined)return fail('Choose the date column.');
  const date=parseDate(cell(row,map.date),options.dateFormat);if(!date)return fail(`Unrecognised date "${cell(row,map.date).slice(0,30)}".`);
  let type:'income'|'expense'|'transfer',amount:number;
  if(map.debit!==undefined&&map.credit!==undefined){
   const debit=cell(row,map.debit)?Math.abs(parseAmount(cell(row,map.debit),options.decimal)):0,credit=cell(row,map.credit)?Math.abs(parseAmount(cell(row,map.credit),options.decimal)):0;
   if(Number.isNaN(debit)||Number.isNaN(credit))return fail('The amount could not be read.');
   if(debit&&credit)return fail('Both debit and credit have a value.');
   if(!debit&&!credit)return fail('No amount on this row.');
   type=debit?'expense':'income';amount=debit||credit;
  }else{
   if(map.amount===undefined)return fail('Choose the amount column.');
   const signed=parseAmount(cell(row,map.amount),options.decimal);
   if(Number.isNaN(signed))return fail(`Amount "${cell(row,map.amount).slice(0,30)}" could not be read.`);
   if(signed===0)return fail('Zero amount.');
   amount=Math.abs(signed);const typeText=cell(row,map.type).toLowerCase();
   if(map.type!==undefined&&/^(transfer)/.test(typeText))type='transfer';
   else if(map.type!==undefined&&/^(debit|dr\b|withdraw|expense|payment|purchase|out)/.test(typeText))type='expense';
   else if(map.type!==undefined&&/^(credit|cr\b|deposit|income|refund|in\b)/.test(typeText))type='income';
   else type=(signed<0)===options.negativeIsExpense?'expense':'income';
  }
  const parsed=schemas.transaction.safeParse({title:clean(cell(row,map.description),160)||'Imported transaction',date,amount,currency:options.currency,type,category:clean(cell(row,map.category),160)||options.defaultCategory||'Imported',account:clean(cell(row,map.account),160)||options.defaultAccount||'Imported account',notes:clean(cell(row,map.notes),2000)});
  if(!parsed.success)return fail(parsed.error.issues[0]?.message||'This row is not valid.');
  items.push({line,data:parsed.data});
 });
 return {items,errors};
}

const slug=(value:string,max:number)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,max);
// Identical rows inside one file are distinct (occurrence 0,1,2…); the same file imported twice produces the same keys.
export function importKey(data:Pick<RecordData['transaction'],'date'|'type'|'amount'|'currency'|'title'|'account'>,occurrence:number){return `import:${data.date}:${data.type}:${data.amount}:${data.currency}:${slug(data.title,48)}:${slug(data.account,24)}:${occurrence}`;}
export function withOccurrences(items:ImportedRow[]){const seen=new Map<string,number>();return items.map(item=>{const base=importKey(item.data,0).replace(/:0$/,''),occurrence=seen.get(base)||0;seen.set(base,occurrence+1);return {line:item.line,data:item.data,occurrence};});}
