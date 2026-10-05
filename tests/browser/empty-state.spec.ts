import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';

test('account loading never flashes a dashboard before onboarding',async({page})=>{
 const snapshot=demoSnapshot();snapshot.profile.onboardingCompletedAt=null;
 let release:()=>void=()=>{};const pending=new Promise<void>(resolve=>release=resolve);
 await page.route('**/backend/auth/me',async r=>{await pending;await r.fulfill({json:{user:{name:'Fixture'},csrf:'fixture'}});});
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:snapshot}));
 await page.goto('/');await expect(page.getByRole('status',{name:'Opening your workspace'})).toBeVisible();
 await expect(page.locator('.app-shell')).toHaveCount(0);release();
 await expect(page.getByRole('heading',{name:'A little more about you'})).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Developer',exact:true}).click();
 await expect(page.getByRole('button',{name:'Financial Planner',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Financial Planner',exact:true}).click();
 await expect(page.getByRole('button',{name:'Build my dashboard'})).toBeVisible();
 await expect(page.locator('.app-shell')).toHaveCount(0);
});

for(const width of [360,390,768,1024,1440,1920])test(`premium empty workspace ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});const snapshot=demoSnapshot();snapshot.records=[];snapshot.profile.onboardingCompletedAt='2026-10-05T10:00:00Z';
 let authReads=0;
 await page.route('**/backend/auth/me',r=>{authReads++;return r.fulfill({json:{user:{name:snapshot.profile.name},csrf:'fixture'}});});
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:snapshot}));
 await page.route('**/backend/api/records',r=>{const body=r.request().postDataJSON();const record={...body,id:'new-expense',version:1};snapshot.records.push(record);return r.fulfill({json:record});});
 await page.goto('/');await expect(page.getByRole('heading',{name:`Welcome, ${snapshot.profile.name}`})).toBeVisible();
 const ring=page.locator('.cash-panel .empty-metal');await page.locator('.cash-panel').scrollIntoViewIfNeeded();
 const start=await ring.evaluate(el=>getComputedStyle(el).transform);
 await expect.poll(()=>ring.evaluate(el=>getComputedStyle(el).transform)).not.toBe(start);
 await expect(page.locator('.cash-panel .empty-symbol svg')).toHaveAttribute('stroke-width','2.2');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const panel=await page.locator('.cash-panel').boundingBox(),cta=await page.getByRole('button',{name:'Add transaction',exact:true}).boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
 await page.screenshot({path:`artifacts/premium-empty-${width}.png`,fullPage:true});
 await page.emulateMedia({reducedMotion:'reduce'});
 const staticStart=await ring.evaluate(el=>getComputedStyle(el).transform);
 await page.getByRole('button',{name:'Add expense',exact:true}).click();
 await expect(ring).toHaveCSS('transform',staticStart);
 const form=page.getByRole('dialog');await form.getByLabel('Description',{exact:true}).fill('First expense');await form.getByLabel('Amount',{exact:true}).fill('50');
 await form.getByRole('button',{name:'Create transaction'}).click();await expect(form).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'No spending yet',exact:true})).toHaveCount(0);
 await expect(page.locator('.donut-center strong')).toHaveText('$50');
 await expect(page.locator('.cash-panel .premium-empty')).toHaveCount(0);expect(authReads).toBe(1);
});
