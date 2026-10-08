import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
for(const width of [390,1440])test(`referral Settings and paid ranking fit ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});const s=demoSnapshot();s.profile={...s.profile,plan:'Pro',email:'ranking@example.com',onboardingCompletedAt:'2026-10-01T00:00:00Z'};
 const data={code:'ahad-noor-fixture',link:'http://localhost:3000/signup?ref=ahad-noor-fixture',total:3,paid:true,rankingActive:true,rank:2,leaders:[{name:'Sara Ahmed',total:5,rank:1,you:false},{name:'Ahad Noor',total:3,rank:2,you:true},{name:'Ali Khan',total:1,rank:3,you:false}]};
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:s.profile.name,email:s.profile.email,status:'active'},csrf:'fixture'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));await page.route('**/backend/api/referrals',r=>r.fulfill({json:data}));
 await page.goto('/settings');await expect(page.getByLabel('Your referral link')).toHaveValue(data.link);await expect(page.locator('.sidebar a[href="/ranking"]')).toHaveCount(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.referral-own-total>strong')).toHaveText('3');await page.screenshot({path:`artifacts/referral-settings-${width}.png`,fullPage:true});
 await page.goto('/ranking');await expect(page.getByRole('heading',{name:'Your circle. Your place.'})).toBeVisible();await expect(page.locator('.referral-you')).toContainText('Ahad Noor');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.referral-rank-stat strong').last()).toHaveText('3');await expect(page.locator('.referral-leaderboard')).toHaveCSS('opacity','1');await page.screenshot({path:`artifacts/referral-ranking-${width}.png`,fullPage:true});
 data.rankingActive=false;data.total=0;await page.reload();await expect(page.getByRole('heading',{name:'Your circle starts with one friend'})).toBeVisible();await expect(page.locator('.sidebar a[href="/ranking"]')).toHaveCount(0);
});
test('a referral link prefills signup and travels with the OTP request',async({page})=>{
 let submitted:any;
 await page.route('**/backend/auth/me',r=>r.fulfill({status:401,json:{error:'Sign in'}}));
 await page.route('**/backend/health',r=>r.fulfill({json:{googleConfigured:false,passwordConfigured:true,signupConfigured:true}}));
 await page.route('**/backend/auth/csrf',r=>r.fulfill({json:{csrf:'fixture'}}));
 await page.route('**/backend/auth/signup',r=>{submitted=r.request().postDataJSON();return r.fulfill({json:{verificationRequired:true,returnTo:'/verify-email'}});});
 await page.route('**/backend/auth/otp',r=>r.fulfill({json:{id:'fixture',email:'invitee@example.com',purpose:'signup',expiresAt:new Date(Date.now()+600000).toISOString(),resendAt:new Date(Date.now()+45000).toISOString()}}));
 await page.goto('/signup?ref=ahad-noor-fixture');await expect(page.getByLabel('Referral code',{exact:true})).toHaveValue('ahad-noor-fixture');
 await page.getByLabel('Full name',{exact:true}).fill('Invited friend');await page.getByLabel('Email',{exact:true}).fill('invitee@example.com');await page.getByLabel('Password',{exact:true}).fill('My new ledger 42!');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page).toHaveURL(/\/verify-email$/);expect(submitted.referralCode).toBe('ahad-noor-fixture');
});
