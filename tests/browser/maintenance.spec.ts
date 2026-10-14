import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
test('customers see a maintenance page, never a broken app, and recover when it ends',async({page})=>{
 let maintenance:{enabled:boolean;message:string;until:string|null}={enabled:true,message:'We are upgrading our servers.',until:new Date(Date.now()+2*3600000).toISOString()};
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/status',r=>r.fulfill({json:{maintenance}}));
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.goto('/');
 const screen=page.getByRole('status',{name:'Daily Ledger is under maintenance'});await expect(screen).toBeVisible();
 await expect(screen.getByRole('heading',{name:'We’ll be right back'})).toBeVisible();await expect(screen).toContainText('We are upgrading our servers.');await expect(screen).toContainText('Expected back around');
 await expect(page.locator('.sidebar')).toHaveCount(0);
 await page.goto('/login');await expect(page.getByRole('status',{name:'Daily Ledger is under maintenance'})).toBeVisible();
 maintenance={enabled:false,message:'',until:null};
 await page.getByRole('button',{name:'Check again'}).click();await expect(page.getByRole('status',{name:'Daily Ledger is under maintenance'})).toHaveCount(0);
});
test('the admin area is never blocked by maintenance mode',async({page})=>{
 await page.route('**/backend/status',r=>r.fulfill({json:{maintenance:{enabled:true,message:'Down',until:null}}}));
 await page.goto('/admin/login');await expect(page.getByRole('status',{name:'Daily Ledger is under maintenance'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Log in to Daily Ledger Admin'})).toBeVisible();
});
