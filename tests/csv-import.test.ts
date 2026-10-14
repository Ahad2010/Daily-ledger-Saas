import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,guessColumns,parseAmount,parseDate,detectDateFormat,mapTransactions,withOccurrences,importKey,IMPORT_MAX_ROWS} from '../packages/shared/src/index';

test('CSV parsing handles BOM, CRLF, quotes, embedded newlines/delimiters and alternative delimiters',()=>{
 const text='﻿Date,Description,Amount\r\n2026-10-01,"Coffee, large",-4.50\r\n2026-10-02,"He said ""hi""\nsecond line",10\r\n\r\n';
 const {rows,delimiter}=parseCsv(text);assert.equal(delimiter,',');assert.equal(rows.length,3);assert.deepEqual(rows[1],['2026-10-01','Coffee, large','-4.50']);assert.equal(rows[2][1],'He said "hi"\nsecond line');
 assert.equal(parseCsv('a;b;c\n1;2;3').delimiter,';');assert.deepEqual(parseCsv('a\tb\n1\t2').rows[1],['1','2']);
 assert.throws(()=>parseCsv(Array.from({length:IMPORT_MAX_ROWS+3},(_,i)=>`r${i},x`).join('\n')),/limited to/);
});

test('amounts become exact signed integer minor units for common bank formats',()=>{
 const cases:[string,number,('auto'|'.'|',')?][]=[['12.50',1250],['-12.50',-1250],['(12.50)',-1250],['12.50-',-1250],['−12.50',-1250],['+7',700],['1,234.56',123456],['1.234,56',123456],['1 234,56',123456],["1'234.50",123450],['1,234',123400],['1.234.567',123456700],['12,5',1250],['$ 1,000',100000],['USD 12.30',1230],['12.5 DR',-1250],['0.07',7],['999999999999.99',99999999999999],['1.234',123400],['12.345',1234500]];
 for(const [input,expected,mark] of cases)assert.equal(parseAmount(input,mark),expected,`${input} (${mark||'auto'})`);
 for(const bad of ['','abc','1.2.3,4,5x','12 abc 34','1e5x','--'])assert.ok(Number.isNaN(parseAmount(bad)),`"${bad}" must be rejected`);
 assert.ok(Number.isNaN(parseAmount('1,234,5')),'ambiguous grouping is rejected rather than guessed');assert.ok(Number.isNaN(parseAmount('1.234','.')),'three decimals cannot be stored as cents');assert.equal(parseAmount('1.234,5',','),123450);
 assert.equal(Number.isInteger(parseAmount('19.99')),true);assert.equal(parseAmount('19.99'),1999,'no floating point drift');assert.equal(parseAmount('0.29'),29);assert.equal(parseAmount('1.15'),115);
});

test('dates parse to real calendar days, with explicit or detected day/month order',()=>{
 assert.equal(parseDate('2026-10-05','dmy'),'2026-10-05');assert.equal(parseDate('2026/10/05 14:30','mdy'),'2026-10-05');
 assert.equal(parseDate('05/10/2026','dmy'),'2026-10-05');assert.equal(parseDate('05/10/2026','mdy'),'2026-05-10');assert.equal(parseDate('5.10.26','dmy'),'2026-10-05');
 assert.equal(parseDate('05 Oct 2026','dmy'),'2026-10-05');assert.equal(parseDate('Oct 5, 2026','dmy'),'2026-10-05');
 for(const bad of ['31/02/2026','2026-13-01','00/10/2026','','not a date','5/10'])assert.equal(parseDate(bad,'dmy'),null,bad);
 assert.deepEqual(detectDateFormat(['13/10/2026','01/02/2026']),{format:'dmy',ambiguous:false});assert.deepEqual(detectDateFormat(['10/13/2026']),{format:'mdy',ambiguous:false});
 assert.deepEqual(detectDateFormat(['2026-10-13']),{format:'iso',ambiguous:false});assert.equal(detectDateFormat(['01/02/2026','03/04/2026']).ambiguous,true);
});

test('column guessing and mapping: signed amount, split debit/credit, type column and credit-card sign inversion',()=>{
 const base={currency:'USD',dateFormat:'iso' as const,decimal:'auto' as const,negativeIsExpense:true,defaultCategory:'Imported',defaultAccount:'Bank'};
 const signed=parseCsv('Date,Description,Amount,Category\n2026-10-01,Salary,3000.00,Work\n2026-10-02,=cmd|calc,-12.40,\n2026-10-03,Zero,0\n2026-10-04,Bad date row,1\n').rows;
 signed[4][0]='nope';const map=guessColumns(signed[0]);assert.deepEqual(map,{date:0,description:1,amount:2,category:3});
 const result=mapTransactions(signed,{...base,map});assert.equal(result.items.length,2);assert.equal(result.items[0].data.type,'income');assert.equal(result.items[0].data.amount,300000);assert.equal(result.items[1].data.type,'expense');assert.equal(result.items[1].data.amount,1240);assert.equal(result.items[1].data.category,'Imported');
 assert.deepEqual(result.errors.map(e=>e.line),[4,5]);assert.match(result.errors[0].message,/Zero/);assert.match(result.errors[1].message,/date/i);
 const split=parseCsv('Transaction Date,Narrative,Debit,Credit\n2026-10-01,Rent,900.00,\n2026-10-02,Refund,,15.5\n2026-10-03,Both,1,1\n').rows;const splitMap=guessColumns(split[0]);assert.deepEqual(splitMap,{date:0,debit:2,credit:3,description:1});
 const splitResult=mapTransactions(split,{...base,map:splitMap});assert.deepEqual(splitResult.items.map(i=>[i.data.type,i.data.amount]),[['expense',90000],['income',1550]]);assert.match(splitResult.errors[0].message,/Both/);
 const card=parseCsv('Date,Details,Amount\n2026-10-01,Shop,25.00\n').rows;assert.equal(mapTransactions(card,{...base,map:guessColumns(card[0]),negativeIsExpense:false}).items[0].data.type,'expense');
 const typed=parseCsv('Date,Description,Amount,Type\n2026-10-01,A,5.00,Debit\n2026-10-02,B,5.00,Credit\n2026-10-03,C,5.00,Transfer\n').rows;assert.deepEqual(mapTransactions(typed,{...base,map:guessColumns(typed[0])}).items.map(i=>i.data.type),['expense','income','transfer']);
});

test('identical rows in one file stay distinct, while re-importing the same file produces the same keys',()=>{
 const item=(line:number,title='Coffee')=>({line,data:{title,date:'2026-10-01',amount:450,currency:'USD',type:'expense' as const,category:'Food',account:'Card',notes:''}});
 const first=withOccurrences([item(2),item(3),item(4,'Tea')]);assert.deepEqual(first.map(r=>r.occurrence),[0,1,0]);
 const again=withOccurrences([item(2),item(3),item(4,'Tea')]);assert.deepEqual(again.map(r=>importKey(r.data,r.occurrence)),first.map(r=>importKey(r.data,r.occurrence)));
 assert.notEqual(importKey(first[0].data,0),importKey(first[0].data,1));
});
