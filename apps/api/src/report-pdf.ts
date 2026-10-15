import PDFDocument from 'pdfkit';
import type {Response} from 'express';
import {drawStatement,type PdfLike,type Snapshot} from '@ledger/shared';

// Bank-statement style monthly PDF, generated on demand. The layout lives in @ledger/shared so the demo renders the same file in the browser.
export function renderReportPdf(res:Response,s:Snapshot,month:string,now=new Date()){
 const doc=new PDFDocument({size:'A4',margin:48,bufferPages:true,info:{Title:`Daily Ledger statement ${month}`,Author:'Daily Ledger'}});doc.pipe(res);
 drawStatement(doc as unknown as PdfLike,s,month,now);
 doc.end();
}
