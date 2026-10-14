import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
test('pages suggest real next steps, dismissals last the day, and adding opens a drawer',async({page})=>{
 const s=demoSnapshot();s.records=[];s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.goto('/tasks');
 const strip=page.getByRole('region',{name:'Suggestions for you'});await expect(strip).toContainText('Nothing is planned for tomorrow');await expect(strip).toContainText('Add your first habit');
 await strip.getByRole('button',{name:'Dismiss suggestion'}).first().click();await expect(strip).not.toContainText('Nothing is planned for tomorrow');
 await page.reload();await expect(page.getByRole('region',{name:'Suggestions for you'})).not.toContainText('Nothing is planned for tomorrow');
 await page.getByRole('button',{name:'Add habit'}).click();
 const drawer=page.locator('.dialog-drawer');await expect(drawer).toBeVisible();await expect(drawer.getByRole('heading')).toContainText(/habit/i);
 const box=await drawer.boundingBox();expect(box!.x+box!.width).toBeGreaterThan(1200);
});
test('finance and fitness suggestions point at real gaps',async({page})=>{
 const s=demoSnapshot();s.records=[];s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.goto('/finance');await expect(page.getByRole('region',{name:'Suggestions for you'})).toContainText('Set a monthly budget');
 await page.goto('/fitness');await expect(page.getByRole('region',{name:'Suggestions for you'})).toContainText('No workout completed in the last 7 days');
});
