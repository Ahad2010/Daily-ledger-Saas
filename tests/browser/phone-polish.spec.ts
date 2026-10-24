import {test,expect} from '@playwright/test';
// Phone layout guards: nothing inside a card may spill outside it, and wide tables must scroll instead of being cut.
for(const width of [360,390])test(`overview KPI cards keep their text inside ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});await page.goto('/');await page.waitForTimeout(2200);
 const spill=await page.$$eval('.metrics-grid .metric-card',els=>els.flatMap(c=>{const r=c.getBoundingClientRect();return [...c.querySelectorAll('.metric-content *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.left<r.left-1||b.right>r.right+1);}).map(e=>(e.textContent||'').slice(0,28));}));
 expect(spill).toEqual([]);
});
test('plans comparison shows a value for every plan on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/plans');
 const cells=page.locator('.plan-compare tbody td');await expect(cells.first()).toBeVisible();
 const rows=await page.locator('.plan-compare tbody tr').count();expect(await cells.count()).toBe(rows*3);
 const hidden=await cells.evaluateAll(els=>els.filter(e=>{const b=e.getBoundingClientRect();return !b.width||!b.height||b.right>innerWidth+1;}).length);expect(hidden).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reports week by week becomes stacked cards on a phone with nothing cut off',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/reports');
 const wrap=page.locator('.report-weeks .table-scroll');await expect(wrap).toBeVisible();
 expect(await page.locator('.report-weeks tbody tr').first().evaluate(el=>getComputedStyle(el).display)).toBe('grid');
 expect(await page.locator('.report-weeks tbody tr').first().evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const path of ['/tasks'])test(`${path} summary cards form a 2x2 grid on a phone and tasks list comes before charts`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(path);if(path==='/tasks')await page.getByRole('tab',{name:'Insights',exact:true}).click();await page.waitForTimeout(800);
 const cards=page.locator('.feature-main .insight-grid .insight-card');expect(await cards.count()).toBe(4);
 const boxes=await cards.evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top)];}));
 expect(boxes[0][1]).toBe(boxes[1][1]);expect(boxes[2][1]).toBe(boxes[3][1]);expect(boxes[2][1]).toBeGreaterThan(boxes[0][1]);
 
});

test('/goals hero and guide fit a phone without sideways scroll',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/goals');await expect(page.locator('.g-hero')).toBeVisible();await expect(page.getByRole('button',{name:'Open the guide for this page'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('meal plan slots stack in one column on a phone and nothing spills sideways',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/meals');await page.getByRole('tab',{name:'Plan'}).click();
 const slots=page.locator('.plan-slots .plan-slot');await expect(slots.first()).toBeVisible();
 const boxes=await slots.evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.right)];}));
 for(const b of boxes){expect(b[0]).toBe(boxes[0][0]);expect(b[1]).toBeLessThanOrEqual(390);}
 expect(await page.evaluate(()=>[...document.querySelectorAll('.plan-slots *')].every(e=>e.getBoundingClientRect().right<=innerWidth+1))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
