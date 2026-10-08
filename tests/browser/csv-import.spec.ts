import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot,type Snapshot} from '../../packages/shared/src/index';
function fixture():Snapshot{const s=demoSnapshot();s.profile={...s.profile,name:'Import fixture',email:'import@example.com',plan:'Pro',onboardingCompletedAt:'2026-09-01T00:00:00Z'};return s;}
async function mock(page:Page,s:Snapshot){await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:s.profile.name,email:s.profile.email,status:'active'},csrf:'fixture'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));}
const bank='Transaction Date;Narrative;Debit;Credit\n13/10/2026;Grocery Store;"1.234,56";\n14/10/2026;Salary;;"3.000,00"\n31/02/2026;Broken date;5,00;\n15/10/2026;Both columns;1,00;1,00\n';

test('CSV import: detects columns and formats, previews, imports in order and reports the result',async({page})=>{
 const s=fixture();await mock(page,s);let body:any;
 await page.route('**/backend/api/import/transactions',async r=>{body=r.request().postDataJSON();await r.fulfill({json:{imported:2,duplicates:0,limited:0,rejected:[],rejectedCount:0}});});
 await page.goto('/finance/transactions');await page.getByRole('button',{name:'Import CSV'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Import bank transactions'})).toBeVisible();
 await dialog.getByLabel('CSV file').setInputFiles({name:'bank.csv',mimeType:'text/csv',buffer:Buffer.from(bank)});
 await expect(dialog.getByLabel('Date order')).toHaveValue('dmy');await expect(dialog.getByLabel('Amount layout')).toHaveValue('split');
 await expect(dialog.locator('.import-summary')).toContainText('2 ready');await expect(dialog.locator('.import-summary')).toContainText('2 skipped');
 await expect(dialog.locator('.import-preview tbody tr').first()).toContainText('Grocery Store');await expect(dialog.locator('.import-preview tbody tr').first()).toContainText('−$1,234.56');await expect(dialog.locator('.import-preview tbody tr').nth(1)).toContainText('+$3,000');
 await expect(dialog.locator('.import-errors')).toContainText('Row 4');await expect(dialog.locator('.import-errors')).toContainText('Both');
 await dialog.getByRole('button',{name:'Import 2 transactions'}).click();
 await expect(dialog.getByRole('heading',{name:'2 transactions imported'})).toBeVisible();
 expect(body.rows).toHaveLength(2);expect(body.rows[0]).toEqual({occurrence:0,data:expect.objectContaining({title:'Grocery Store',date:'2026-10-13',amount:123456,type:'expense',currency:'USD'})});expect(body.rows[1].data).toEqual(expect.objectContaining({type:'income',amount:300000}));
 await expect(dialog.getByRole('link',{name:'View transactions'})).toHaveAttribute('href','/finance/transactions?month=2026-10');
});

test('CSV import: plan-limited rows are explained, and a bad file is rejected with a clear message',async({page})=>{
 const s=fixture();await mock(page,s);
 await page.route('**/backend/api/import/transactions',r=>r.fulfill({json:{imported:1,duplicates:1,limited:3,rejected:[],rejectedCount:0}}));
 await page.goto('/finance/transactions');await page.getByRole('button',{name:'Import CSV'}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('CSV file').setInputFiles({name:'empty.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Amount\n')});await expect(dialog.getByRole('alert')).toContainText('header row and at least one transaction');
 await dialog.getByLabel('CSV file').setInputFiles({name:'ok.csv',mimeType:'text/csv',buffer:Buffer.from('Date,Description,Amount\n2026-10-01,A,-5.00\n2026-10-02,B,-6.00\n2026-10-03,C,-7.00\n2026-10-04,D,-8.00\n2026-10-05,E,-9.00\n')});
 await dialog.getByRole('button',{name:'Import 5 transactions'}).click();await expect(dialog.getByRole('heading',{name:'1 transaction imported'})).toBeVisible();await expect(dialog.locator('.import-summary')).toContainText('1 already existed');await expect(dialog.locator('.import-summary')).toContainText('3 over your plan allowance');await expect(dialog.locator('.import-note')).toContainText('explore Pro');
});

test('CSV import is unavailable in the local demo, which never writes to a real account',async({page})=>{
 await page.goto('/finance/transactions');await expect(page.getByRole('button',{name:'Import CSV'})).toBeDisabled();
});
