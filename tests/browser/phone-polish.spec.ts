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
test('reports week table scrolls sideways instead of being cut on a phone',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/reports');
 const wrap=page.locator('.report-weeks .table-scroll');await expect(wrap).toBeVisible();
 expect(await wrap.evaluate(el=>el.scrollWidth>el.clientWidth&&getComputedStyle(el).overflowX==='auto')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const path of ['/tasks','/goals'])test(`${path} summary cards form a 2x2 grid on a phone and tasks list comes before charts`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(path);await page.waitForTimeout(800);
 const cards=page.locator('.feature-main .insight-grid .insight-card');expect(await cards.count()).toBe(4);
 const boxes=await cards.evaluateAll(els=>els.map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.left),Math.round(b.top)];}));
 expect(boxes[0][1]).toBe(boxes[1][1]);expect(boxes[2][1]).toBe(boxes[3][1]);expect(boxes[2][1]).toBeGreaterThan(boxes[0][1]);
 if(path==='/tasks'){const task=await page.getByRole('heading',{name:'Tasks',exact:true}).first().boundingBox();const chart=await page.locator('.feature-trends').first().boundingBox();expect(task!.y).toBeLessThan(chart!.y);}
});
