import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
const emptyAccount=()=>{const snapshot=demoSnapshot();snapshot.records=[];return JSON.stringify(snapshot);};
const seed=(page:import('@playwright/test').Page)=>page.addInitScript(value=>localStorage.setItem('daily-ledger-demo-v1',value),emptyAccount());
test('an empty dashboard revs its gauges once, then settles on the real zero values',async({page})=>{
 await seed(page);await page.goto('/');
 await expect(page.locator('.ignition-gauge')).toBeVisible();
 await expect(page.locator('.ignition-gauge')).toHaveCount(0,{timeout:5000});
 await expect(page.getByRole('heading',{name:'No spending yet',exact:true})).toBeVisible();
 await expect(page.locator('.metric-hero .metric-content strong')).toHaveText('$0');
 await page.getByRole('link',{name:'Tasks & Habits'}).first().click();await page.getByRole('link',{name:'Overview'}).first().click();
 await expect(page.getByRole('heading',{name:'No spending yet',exact:true})).toBeVisible();await expect(page.locator('.ignition-gauge')).toHaveCount(0);
});
test('reduced motion and accounts with data skip the start-up effect',async({page,browser})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await seed(page);await page.goto('/');
 await expect(page.getByRole('heading',{name:'No spending yet',exact:true})).toBeVisible();await expect(page.locator('.ignition-gauge')).toHaveCount(0);
 const context=await browser.newContext();const filled=await context.newPage();await filled.goto('http://localhost:3000/');await expect(filled.locator('.donut-center strong')).toHaveText('$1,280');await expect(filled.locator('.ignition-gauge')).toHaveCount(0);await context.close();
});
test('Inter carries interface text and Manrope carries headings, both actually loaded',async({page})=>{
 await page.goto('/');await page.locator('h1').first().waitFor();
 const result=await page.evaluate(async()=>{await document.fonts.ready;const family=(selector:string)=>getComputedStyle(document.querySelector(selector)!).fontFamily;return {body:family('body'),heading:family('h1'),button:family('button'),loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)};});
 expect(result.body).toMatch(/inter/i);expect(result.button).toMatch(/inter/i);expect(result.heading).toMatch(/manrope/i);
 expect(result.loaded.join(' ')).toMatch(/inter/i);expect(result.loaded.join(' ')).toMatch(/manrope/i);
});
