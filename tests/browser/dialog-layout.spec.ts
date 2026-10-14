import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
// Regression: a dialog that grows after it opens (the CSV preview) must stay inside the viewport and keep its buttons reachable.
for(const [width,height] of [[390,844],[360,640],[1440,900]])test(`CSV import dialog stays inside the viewport at ${width}x${height}`,async({page})=>{
 await page.setViewportSize({width,height});const s=demoSnapshot();s.profile.plan='Pro';s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.route('**/backend/api/import/transactions',r=>r.fulfill({json:{imported:1,duplicates:0,limited:0,rejected:[],rejectedCount:0}}));
 await page.goto('/finance/transactions');await page.getByRole('button',{name:'Import CSV'}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('CSV file').setInputFiles({name:'bank.csv',mimeType:'text/csv',buffer:Buffer.from('Transaction Date;Narrative;Debit;Credit\n13/10/2026;Grocery Store;"1.234,56";\n')});
 await expect(dialog.locator('.import-summary')).toContainText('1 ready');await page.waitForTimeout(500);
 const box=await dialog.boundingBox();expect(box!.y).toBeGreaterThanOrEqual(-1);expect(box!.y+box!.height).toBeLessThanOrEqual(height+1);
 await dialog.getByRole('button',{name:'Import 1 transaction'}).click();await expect(dialog.getByRole('heading',{name:'1 transaction imported'})).toBeVisible();
});
