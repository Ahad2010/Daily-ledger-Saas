'use client';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {Receipt,ExternalLink} from 'lucide-react';
import {money,type Snapshot} from '@ledger/shared';
import {Entrance} from './animation';
import {demoMode,request} from '../lib/data';

interface Payment{id:string;provider:string;kind:string;description:string|null;currency:string;amount:number;status:string;receiptUrl:string|null;createdAt:string}
interface Details{plan:string;source:string;trial:{available:boolean;used:boolean;endsAt:string|null};accessUntil:string|null;paymentsConfigured:boolean;payments:Payment[]}
const date=(value:string)=>new Date(value).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
const safeReceipt=(value:string|null)=>value&&/^https:\/\//i.test(value)?value:null;

export function BillingPanel({s}:{s:Snapshot}){
 const query=useQuery({queryKey:['billing'],queryFn:()=>request('/api/billing') as Promise<Details>,enabled:!demoMode,staleTime:30000});
 const details=query.data;
 const access=!details?'':details.trial.endsAt?`Free trial until ${date(details.trial.endsAt)}`:details.source==='provider'?'Paid membership':details.accessUntil?`Administrator-granted access until ${date(details.accessUntil)}`:details.source==='manual'||details.source==='manual override'?'Activated by your administrator':'Free membership';
 return <Entrance className="panel billing-panel"><div className="panel-heading"><div><span className="eyebrow">BILLING</span><h2>Billing &amp; invoices</h2></div><Receipt size={22}/></div>
  {demoMode?<p className="muted">Billing details appear in your signed-in account.</p>
  :query.isPending?<p className="muted" role="status">Loading billing details…</p>
  :query.isError?<p role="alert" className="error">{query.error.message} <button className="plain-button" onClick={()=>void query.refetch()}>Retry</button></p>
  :<>
   <div className="billing-summary"><div><small>Plan</small><strong>{s.profile.plan}</strong></div><div><small>Status</small><strong>{access}</strong></div></div>
   {details!.payments.length?<div className="table-scroll"><table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{details!.payments.map(p=>{const receipt=safeReceipt(p.receiptUrl);return <tr key={p.id}><td>{date(p.createdAt)}</td><td>{p.description||(p.kind==='lifetime'?'Lifetime membership':'Pro membership')}</td><td>{money(p.amount,p.currency)}</td><td><span className="tag">{p.status}</span></td><td>{receipt?<a className="billing-receipt" href={receipt} target="_blank" rel="noopener noreferrer">View<ExternalLink size={12}/></a>:'—'}</td></tr>;})}</tbody></table></div>
   :<p className="muted">{details!.paymentsConfigured?'No payments yet. Receipts and invoices will appear here.':'Online payments are not connected yet. Plan changes are handled by support, and every payment will appear here with its receipt once checkout is available.'}</p>}
   <p className="plan-small">Need an invoice or have a billing question? <Link href="/help">Contact support</Link>.</p></>}
 </Entrance>;
}
