import {test,expect} from '@playwright/test';
// Phone layout guards: nothing inside a card may spill outside it, and wide tables must scroll instead of being cut.
for(const width of [360,390])test(`overview KPI cards keep their text inside ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:800});await page.goto('/');await page.waitForTimeout(2200);
 const spill=await page.$$eval('.metrics-grid .metric-card',els=>els.flatMap(c=>{const r=c.getBoundingClientRect();return [...c.querySelectorAll('.metric-content *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&(b.left<r.left-1||b.right>r.right+1);}).map(e=>(e.textContent||'').slice(0,28));}));
 expect(spill).toEqual([]);
});
