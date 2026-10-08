import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
test.use({timezoneId:'Asia/Karachi',locale:'en-PK'});
test('onboarding detects browser timezone and region, then preserves manual preferences',async({page})=>{
 const snapshot=demoSnapshot();snapshot.profile.onboardingCompletedAt=null;snapshot.profile.timezone='UTC';snapshot.profile.currency='USD';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:snapshot.profile.name,email:snapshot.profile.email,status:'active'},csrf:'fixture'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:snapshot}));
 await page.goto('/');await expect(page.getByRole('heading',{name:'A little more about you'})).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Time zone',exact:true})).toHaveValue('Asia/Karachi');await expect(page.getByRole('button',{name:'Currency',exact:true})).toContainText('PKR');
 await page.getByRole('combobox',{name:'Time zone',exact:true}).selectOption('UTC');await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.getByRole('combobox',{name:'Time zone',exact:true})).toHaveValue('UTC');
});
