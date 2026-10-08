import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
for(const width of [390,1440])test(`OTP signup opens onboarding automatically at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});let verified=false;
 const snapshot=demoSnapshot();snapshot.profile.name='Verified user';snapshot.profile.onboardingCompletedAt=null;snapshot.records=[];
 await page.route('**/backend/auth/csrf',r=>r.fulfill({json:{csrf:'fixture'}}));
 await page.route('**/backend/auth/me',r=>r.fulfill({status:verified?200:401,json:verified?{user:{name:'Verified user',email:'verified@example.com',status:'active'},csrf:'fixture'}:{}}));
 await page.route('**/backend/health',r=>r.fulfill({json:{googleConfigured:false,passwordConfigured:true,signupConfigured:true}}));
 await page.route('**/backend/auth/signup',r=>r.fulfill({json:{verificationRequired:true,returnTo:'/verify-email'}}));
 await page.route('**/backend/auth/otp',r=>r.fulfill({json:{id:'fixture',email:'verified@example.com',purpose:'signup',expiresAt:new Date(Date.now()+600000).toISOString(),resendAt:new Date(Date.now()+45000).toISOString()}}));
 await page.route('**/backend/auth/otp/verify',async r=>{expect(r.request().postDataJSON().code).toBe('123456');verified=true;await r.fulfill({json:{ok:true,returnTo:'/'}});});
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:snapshot}));
 await page.goto('/signup');await page.getByLabel('Full name').fill('Verified user');await page.getByLabel('Email',{exact:true}).fill('verified@example.com');await page.getByLabel('Password',{exact:true}).fill('My verified ledger 42!');await page.getByRole('button',{name:'Create account',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Verify your email'})).toBeVisible();await expect(page.getByRole('button',{name:'Verify email',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:/Resend code in/})).toBeDisabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('Code digit 1',{exact:true}).fill('123456');await expect(page.getByLabel('Code digit 6')).toHaveValue('6');await page.screenshot({path:`artifacts/otp-signup-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Verify email',exact:true}).click();await expect(page.getByRole('heading',{name:'A little more about you'})).toBeVisible();await expect(page.getByLabel('Full name',{exact:true})).toHaveValue('Verified user');
});
test('reset OTP leads to a new password and then login, without onboarding',async({page})=>{
 await page.route('**/backend/auth/csrf',r=>r.fulfill({json:{csrf:'fixture'}}));await page.route('**/backend/auth/forgot-password',r=>r.fulfill({json:{returnTo:'/verify-email'}}));
 await page.route('**/backend/auth/otp',r=>r.fulfill({json:{id:'fixture',email:'verified@example.com',purpose:'reset',expiresAt:new Date(Date.now()+600000).toISOString(),resendAt:new Date(Date.now()+45000).toISOString()}}));
 await page.route('**/backend/auth/otp/verify',r=>r.fulfill({json:{id:'fixture',token:'a'.repeat(64),returnTo:'/reset-password'}}));
 await page.route('**/backend/auth/reset-password',async r=>{expect(r.request().postDataJSON()).toMatchObject({id:'fixture',token:'a'.repeat(64),password:'New verified ledger 43!'});await r.fulfill({json:{message:'Your password has been reset. Sign in with your new password.'}});});
 await page.goto('/forgot-password');await page.getByLabel('Email',{exact:true}).fill('verified@example.com');await page.getByRole('button',{name:'Send reset code'}).click();await expect(page.getByRole('heading',{name:'Verify your reset code'})).toBeVisible();await page.getByLabel('Code digit 1',{exact:true}).fill('123456');await page.getByRole('button',{name:'Verify code',exact:true}).click();await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();await page.reload();await page.getByLabel('New password').fill('New verified ledger 43!');await page.getByRole('button',{name:'Reset password',exact:true}).click();await expect(page.getByRole('status')).toContainText('Your password has been reset');await expect(page.getByRole('link',{name:'Back to login'})).toBeVisible();expect(await page.evaluate(()=>sessionStorage.getItem('daily-ledger-reset-proof'))).toBeNull();
});
