'use client';
import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useQueryClient} from '@tanstack/react-query';
import {FileUp,Check,TriangleAlert} from 'lucide-react';
import {parseCsv,guessColumns,detectDateFormat,mapTransactions,withOccurrences,money,currencyOptions,IMPORT_CHUNK,type ColumnMap,type DateFormat,type DecimalMark,type Snapshot} from '@ledger/shared';
import {Dialog} from './ui/dialog';
import {Button} from './ui/button';
import {request} from '../lib/data';

type Totals={imported:number;duplicates:number;limited:number;rejected:number};
const MAX_BYTES=2*1024*1024;

export function CsvImport({open,onOpenChange,s}:{open:boolean;onOpenChange:(open:boolean)=>void;s:Snapshot}){
 const client=useQueryClient(),input=useRef<HTMLInputElement>(null);
 const [rows,setRows]=useState<string[][]|null>(null),[fileName,setFileName]=useState(''),[error,setError]=useState('');
 const [map,setMap]=useState<ColumnMap>({}),[split,setSplit]=useState(false),[dateFormat,setDateFormat]=useState<DateFormat>('iso'),[ambiguous,setAmbiguous]=useState(false);
 const [decimal,setDecimal]=useState<DecimalMark>('auto'),[invert,setInvert]=useState(false),[currency,setCurrency]=useState(s.profile.currency),[category,setCategory]=useState('Imported'),[account,setAccount]=useState('Imported account');
 const [progress,setProgress]=useState<{done:number;total:number}|null>(null),[totals,setTotals]=useState<Totals|null>(null),[latestMonth,setLatestMonth]=useState('');
 const headers=rows?.[0]||[];
 const effectiveMap=useMemo<ColumnMap>(()=>split?{...map,amount:undefined}:{...map,debit:undefined,credit:undefined},[map,split]);
 const preview=useMemo(()=>rows?mapTransactions(rows,{map:effectiveMap,currency,dateFormat,decimal,negativeIsExpense:!invert,defaultCategory:category.trim()||'Imported',defaultAccount:account.trim()||'Imported account'}):null,[rows,effectiveMap,currency,dateFormat,decimal,invert,category,account]);
 const busy=!!progress&&!totals;

 function reset(){setRows(null);setFileName('');setError('');setMap({});setProgress(null);setTotals(null);setLatestMonth('');if(input.current)input.current.value='';}
 async function choose(file?:File){
  if(!file)return;setError('');setTotals(null);
  if(file.size>MAX_BYTES){setError('This file is larger than 2 MB. Split it by date range and import the parts.');return;}
  try{
   const parsed=parseCsv(await file.text());
   if(parsed.rows.length<2){setError('The file needs a header row and at least one transaction.');return;}
   const guess=guessColumns(parsed.rows[0]),detected=detectDateFormat(parsed.rows.slice(1,80).map(r=>r[guess.date??0]||''));
   setRows(parsed.rows);setFileName(file.name);setMap(guess);setSplit(guess.debit!==undefined&&guess.credit!==undefined);setDateFormat(detected.format);setAmbiguous(detected.ambiguous);
  }catch(e){setError((e as Error).message||'This file could not be read as CSV.');}
 }
 async function run(){
  if(!preview?.items.length)return;
  const items=withOccurrences(preview.items),total:Totals={imported:0,duplicates:0,limited:0,rejected:0};
  setError('');setProgress({done:0,total:items.length});
  try{
   for(let i=0;i<items.length;i+=IMPORT_CHUNK){
    const chunk=items.slice(i,i+IMPORT_CHUNK);
    const result=await request('/api/import/transactions',{method:'POST',body:JSON.stringify({rows:chunk.map(item=>({data:item.data,occurrence:item.occurrence}))})}) as {imported:number;duplicates:number;limited:number;rejectedCount:number};
    total.imported+=result.imported;total.duplicates+=result.duplicates;total.limited+=result.limited;total.rejected+=result.rejectedCount;setProgress({done:Math.min(items.length,i+IMPORT_CHUNK),total:items.length});
   }
   setLatestMonth(items.map(item=>item.data.date).sort().at(-1)!.slice(0,7));setTotals(total);
  }catch(e){setError(`${(e as Error).message} Rows already imported are kept; run the import again to continue without duplicates.`);setProgress(null);}
  finally{await client.invalidateQueries({queryKey:['snapshot']});}
 }
 const select=(label:string,key:keyof ColumnMap,optional=true)=><label key={key}><span>{label}{optional?' (optional)':''}</span><select value={map[key]??''} onChange={e=>setMap({...map,[key]:e.target.value===''?undefined:Number(e.target.value)})}>{optional&&<option value="">Not in this file</option>}{!optional&&map[key]===undefined&&<option value="">Choose a column</option>}{headers.map((h,i)=><option key={i} value={i}>{h.trim()||`Column ${i+1}`}</option>)}</select></label>;
 return <Dialog open={open} onOpenChange={next=>{if(busy)return;onOpenChange(next);if(!next)reset();}} title="Import bank transactions" description="Upload a CSV exported from your bank or card. You review everything before it is saved.">
  {totals?<div className="import-result" role="status"><span className="import-check"><Check size={20}/></span><h3>{totals.imported} transaction{totals.imported===1?'':'s'} imported</h3>
   <div className="import-summary"><span>{totals.duplicates} already existed</span>{totals.rejected>0&&<span>{totals.rejected} could not be read</span>}{totals.limited>0&&<span className="warn">{totals.limited} over your plan allowance</span>}</div>
   {totals.limited>0&&<p className="import-note">Free accounts keep up to 100 transactions per month. Import a smaller range or <Link href="/plans" onClick={()=>onOpenChange(false)}>explore Pro</Link>.</p>}
   <div className="dialog-actions"><Button onClick={()=>{reset();}}>Import another file</Button><Link className="button primary" href={`/finance/transactions?month=${latestMonth}`} onClick={()=>onOpenChange(false)}>View transactions</Link></div></div>
  :!rows?<div className="import-start"><label className="import-drop"><FileUp size={26}/><strong>Choose a CSV file</strong><span>Columns are detected automatically. Debit/credit and single amount columns both work. Up to 5,000 rows or 2 MB.</span><input ref={input} type="file" accept=".csv,.tsv,.txt,text/csv" aria-label="CSV file" onChange={e=>void choose(e.target.files?.[0])}/></label>{error&&<p role="alert" className="error">{error}</p>}<p className="import-note">Import adds records only. Rows you have already imported are skipped, so re-uploading the same file is safe. Transfers can be marked with a type column.</p></div>
  :<div className="import-map"><p className="import-file"><strong>{fileName}</strong> · {rows.length-1} rows</p>
   <div className="import-grid">{select('Date','date',false)}{select('Description','description')}
    {split?<>{select('Debit (money out)','debit',false)}{select('Credit (money in)','credit',false)}</>:select('Amount','amount',false)}
    {select('Category','category')}{select('Account','account')}{!split&&select('Type (debit/credit/transfer)','type')}</div>
   <div className="import-grid">
    <label><span>Amount layout</span><select value={split?'split':'single'} onChange={e=>setSplit(e.target.value==='split')}><option value="single">One amount column (+/−)</option><option value="split">Separate debit and credit columns</option></select></label>
    <label><span>Date order</span><select value={dateFormat} onChange={e=>setDateFormat(e.target.value as DateFormat)}><option value="iso">Year-month-day (2026-10-31)</option><option value="dmy">Day/month/year (31/10/2026)</option><option value="mdy">Month/day/year (10/31/2026)</option></select></label>
    <label><span>Decimal mark</span><select value={decimal} onChange={e=>setDecimal(e.target.value as DecimalMark)}><option value="auto">Detect automatically</option><option value=".">Period (1,234.56)</option><option value=",">Comma (1.234,56)</option></select></label>
    <label><span>Currency</span><select value={currency} onChange={e=>setCurrency(e.target.value)}>{currencyOptions.map(code=><option key={code} value={code}>{code}</option>)}</select></label>
    <label><span>Default category</span><input value={category} maxLength={160} onChange={e=>setCategory(e.target.value)}/></label>
    <label><span>Default account</span><input value={account} maxLength={160} onChange={e=>setAccount(e.target.value)}/></label></div>
   {!split&&<label className="check-label"><input type="checkbox" checked={invert} onChange={e=>setInvert(e.target.checked)}/>Positive amounts are spending (credit-card statements)</label>}
   {ambiguous&&<p className="import-warning" role="note"><TriangleAlert size={15}/>Dates like 01/02/2026 can be read two ways. Check the preview and change the date order if needed.</p>}
   {preview&&<div className="import-preview"><div className="import-summary"><span>{preview.items.length} ready</span>{preview.errors.length>0&&<span className="warn">{preview.errors.length} skipped</span>}</div>
    {preview.items.length>0&&<div className="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>{preview.items.slice(0,6).map(item=><tr key={item.line}><td>{item.data.date}</td><td>{item.data.title}</td><td>{item.data.category}</td><td className={item.data.type==='income'?'positive':item.data.type==='expense'?'negative':''}>{item.data.type==='income'?'+':item.data.type==='expense'?'−':''}{money(item.data.amount,currency)}</td></tr>)}</tbody></table></div>}
    {preview.errors.length>0&&<ul className="import-errors">{preview.errors.slice(0,4).map(e=><li key={e.line}>Row {e.line}: {e.message}</li>)}{preview.errors.length>4&&<li>and {preview.errors.length-4} more</li>}</ul>}</div>}
   {error&&<p role="alert" className="error">{error}</p>}
   {progress&&!totals&&<p className="import-note" role="status">Importing {progress.done} of {progress.total}…</p>}
   <div className="dialog-actions"><Button onClick={reset} disabled={busy}>Choose another file</Button><Button variant="primary" disabled={busy||!preview?.items.length} onClick={()=>void run()}>{busy?'Importing…':`Import ${preview?.items.length||0} transactions`}</Button></div></div>}
 </Dialog>;
}
