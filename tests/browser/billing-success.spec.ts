import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
async function serve(page:Page,get:()=>unknown){
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:get()}));
}
const account=(plan:'Free'|'Pro'|'Lifetime',source='paid')=>{const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';s.profile.plan=plan;(s as any).planDetails={source,expiresAt:null,trial:{available:false,used:false,endsAt:null},catalog:{},usage:{emails:0,aiRequests:0,aiTokens:0},aiAllowances:{}};return s;};
test('the payment page waits for server confirmation, then celebrates the confirmed plan',async({page})=>{
 let snapshot=account('Free','free');await serve(page,()=>snapshot);
 await page.goto('/billing/success');
 await expect(page.getByRole('status',{name:'Confirming your payment…'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your Pro plan is active'})).toHaveCount(0);
 snapshot=account('Pro');
 await expect(page.getByRole('heading',{name:'Your Pro plan is active'})).toBeVisible({timeout:15000});
 await expect(page.locator('.pa-benefits li')).toHaveCount(6);
 await expect(page.getByRole('link',{name:/Go to your dashboard/})).toHaveAttribute('href','/');
 await expect(page.getByRole('link',{name:'Billing & invoices'})).toHaveAttribute('href','/settings?tab=billing');
});
test('lifetime and trial plans get their own wording',async({page,browser})=>{
 await serve(page,()=>account('Lifetime'));await page.goto('/billing/success');
 await expect(page.getByRole('heading',{name:'Lifetime access is yours'})).toBeVisible();
 const context=await browser.newContext();const other=await context.newPage();
 const trial=account('Pro','trial');(trial as any).planDetails.trial={available:false,used:true,endsAt:new Date(Date.now()+5*86400000).toISOString()};await serve(other,()=>trial);
 await other.goto('http://localhost:3000/billing/success');await expect(other.getByRole('heading',{name:'Your 7-day Pro trial is active'})).toBeVisible();await expect(other.locator('.pa-copy')).toContainText('5 days left');await context.close();
});
test('unknown billing paths are not found',async({page})=>{const r=await page.goto('/billing/anything');expect(r?.status()).toBe(404);});
