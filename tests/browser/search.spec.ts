import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const)test(`search finds pages and records on ${name}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/');
 const input=page.getByLabel('Search your records');
 if(width<=800)await page.getByRole('button',{name:'Open search'}).click();else await input.click();
 await expect(input).toBeFocused();
 await input.fill('meals');await expect(page.locator('.search-results').getByRole('button',{name:/Meals & Grocery/})).toBeVisible();
 await page.screenshot({path:`artifacts/search-pages-${name}.png`});
 await input.fill('chicken');await expect(page.locator('.search-results .eyebrow',{hasText:'Your records'})).toBeVisible();const hit=page.locator('.search-results').getByRole('button',{name:/chicken/i}).first();await expect(hit).toBeVisible();
 await page.screenshot({path:`artifacts/search-records-${name}.png`});
 await hit.click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 if(width<=800)await page.getByRole('button',{name:'Open search'}).click();
 await input.fill('zzzz-nothing');await expect(page.locator('.search-results')).toContainText('No results');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.keyboard.press('Escape');await expect(page.locator('.search-results')).toHaveCount(0);
});
test('donut sweeps once it is on screen and ends full',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const seg=page.locator('[data-donut-segment]').first();await seg.scrollIntoViewIfNeeded();
 const len=()=>seg.evaluate(el=>Number((el.getAttribute('stroke-dasharray')||'0').split(' ')[0]));
 await page.waitForTimeout(250);const mid=await len();await page.waitForTimeout(2200);const end=await len();
 expect(end).toBeGreaterThan(mid);expect(end).toBeGreaterThan(100);
 await page.locator('.gauge-donut').screenshot({path:'artifacts/donut-end.png'});
});
test('phone KPI cards show full amounts',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.waitForTimeout(2500);
 const clipped=await page.$$eval('.metrics-grid .metric-content strong',els=>els.filter(e=>e.scrollWidth>e.clientWidth+1).length);expect(clipped).toBe(0);
 await page.locator('.metrics-grid').screenshot({path:'artifacts/kpi-phone.png'});
});
