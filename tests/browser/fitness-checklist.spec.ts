import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`ticking a workout never moves the other rows ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/fitness');
 const rows=page.locator('.workout-log-rows .detail-row');await expect(rows.first()).toBeVisible();
 const box=page.locator('.workout-log-rows .detail-row [role=checkbox]:not(:disabled)').first();await expect(box).toBeVisible();
 const before=await box.isChecked();
 await page.evaluate(()=>{const seen:string[]=[];(window as any).__rowMotion=seen;const read=()=>document.querySelectorAll('.workout-log-rows .detail-row').forEach(r=>{const t=getComputedStyle(r).transform;if(t&&t!=='none')seen.push(t);});const id=setInterval(read,16);setTimeout(()=>clearInterval(id),900);});
 await box.click({force:true});await page.waitForTimeout(950);
 expect(await page.evaluate(()=>(window as any).__rowMotion)).toEqual([]);
 await expect(page.locator('.workout-log-rows .detail-row[aria-hidden=true]')).toHaveCount(0);
 await expect(box).toBeChecked({checked:!before});
});
