import {test,expect} from '@playwright/test';
for(const width of [390,1440])test(`goal pace, emergency fund preset and meal costs ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('/goals');await expect(page.locator('.goal-pace').first()).toContainText('per week');
 await expect(page.getByRole('button',{name:/^Emergency fund \d/})).toBeVisible();
 await page.screenshot({path:`artifacts/goals-pace-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/meals');await expect(page.getByRole('heading',{name:'What your food costs'})).toBeVisible();
 await page.screenshot({path:`artifacts/meals-insights-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
