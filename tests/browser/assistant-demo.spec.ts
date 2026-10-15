import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const)test(`demo assistant answers from your data and confirms actions ${name}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/assistant');
 await expect(page.getByText('Connection unavailable')).toHaveCount(0);
 const box=page.getByLabel('Ask the AI Assistant');await expect(box).toBeEnabled();
 await box.fill('Summarize my month');await page.getByRole('button',{name:'Send'}).click();
 await expect(page.locator('.ai-answer').last()).toContainText('This month you earned',{timeout:10000});
 await page.screenshot({path:`artifacts/assistant-demo-${name}.png`,fullPage:true});
 await box.fill('Add a task: call the bank');await page.getByRole('button',{name:'Send'}).click();
 await expect(page.locator('.ai-answer').last()).toContainText('call the bank',{timeout:10000});
 await page.getByRole('button',{name:'Confirm'}).click();await expect(page.getByText('Added')).toBeVisible();
 await expect(page.locator('.ai-footnote')).toContainText('Demo replies');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
