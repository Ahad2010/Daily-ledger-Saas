import {expect,test} from '@playwright/test';
import {demoSnapshot} from '@ledger/shared';
import {holdToConfirm} from './hold';

test('a failed cancellation shows the error and lets the member try again',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.route('**/backend/api/billing',r=>r.fulfill({json:{plan:'Pro',source:'provider',trial:{available:false,used:false,endsAt:null},accessUntil:null,cancelledAt:null,canCancel:true,paymentsConfigured:false,payments:[]}}));
 let calls=0;await page.route('**/backend/api/billing/cancel',r=>{calls++;return r.fulfill({status:500,json:{error:'The server could not complete this request.'}});});
 await page.goto('/settings?tab=billing');
 await page.getByRole('button',{name:'Cancel plan'}).click();
 await holdToConfirm(page,/Hold to cancel plan/);
 await expect(page.getByRole('alert')).toContainText('could not complete');
 await expect(page.getByRole('button',{name:/Hold to cancel plan/})).toBeVisible();
 expect(calls).toBe(1);
});
