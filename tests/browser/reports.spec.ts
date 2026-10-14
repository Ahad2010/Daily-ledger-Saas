import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const number=(text:string)=>Number(text.replace(/[^0-9.\-−]/g,'').replace('−','-'));

test('monthly report: KPIs, weekly review and week table agree, and the CSV carries the same sections',async({page})=>{
 await page.goto('/reports');
 await expect(page.locator('.report-hero h2')).toHaveText('September 2026');
 const kpis=page.locator('.report-kpi');await expect(kpis.nth(0)).toContainText('$4,000');await expect(kpis.nth(1)).toContainText('$1,280');await expect(kpis.nth(2)).toContainText('$2,720');await expect(kpis.nth(3)).toContainText('64% used');
 await expect(page.locator('.report-review h2')).toHaveText('Your week in review');await expect(page.locator('.review-col')).toHaveCount(3);
 const rows=page.locator('.report-weeks tbody tr');await expect(rows).toHaveCount(5);
 const income=await rows.evaluateAll(trs=>trs.map(tr=>tr.children[1].textContent||''));const expenses=await rows.evaluateAll(trs=>trs.map(tr=>tr.children[2].textContent||''));
 expect(Math.round(income.reduce((n,t)=>n+number(t),0)*100)).toBe(400000);expect(Math.round(expenses.reduce((n,t)=>n+number(t),0)*100)).toBe(128000);
 await expect(page.locator('.category-row')).toHaveCount(4);
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export CSV'}).click()]);
 const csv=readFileSync((await download.path())!,'utf8');expect(csv).toContain('Week by week');expect(csv).toContain('Spending by category');expect(csv).toContain('"Income","4000"');
});

test('monthly report fits phone widths without page overflow',async({page})=>{
 for(const width of [360,390,768]){await page.setViewportSize({width,height:844});await page.goto('/reports');await expect(page.locator('.report-kpis')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
});
