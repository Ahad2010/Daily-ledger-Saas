import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
test.use({storageState:{cookies:[],origins:[]}});
async function fresh(page:Page,onboardedAt:string){
 const s=demoSnapshot();s.profile.onboardingCompletedAt=onboardedAt;
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
}
test('a newly onboarded account is walked through the main areas once',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'});await expect(tour).toBeVisible({timeout:15000});
 await expect(tour).toContainText('Step 1 of 6');
 for(let i=0;i<5;i++)await tour.getByRole('button',{name:'Next'}).click();
 await expect(tour).toContainText('Step 6 of 6');await tour.getByRole('button',{name:'Done'}).click();await expect(tour).toHaveCount(0);
 await page.reload();await page.waitForTimeout(3500);await expect(page.getByRole('dialog',{name:'Product tour'})).toHaveCount(0);
});
test('skipping persists, long-time accounts are not interrupted, and Settings can replay it',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'});await expect(tour).toBeVisible({timeout:15000});await tour.getByRole('button',{name:'Skip tour'}).first().click();await expect(tour).toHaveCount(0);
 await page.goto('/settings');await page.getByRole('button',{name:'Replay'}).click();await expect(tour).toBeVisible();await page.keyboard.press('Escape');await expect(tour).toHaveCount(0);
});
test('an account onboarded long ago never sees the automatic tour',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,'2026-09-01T00:00:00Z');await page.goto('/');await page.waitForTimeout(4000);await expect(page.getByRole('dialog',{name:'Product tour'})).toHaveCount(0);
});
