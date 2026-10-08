import {test,expect} from '@playwright/test';
import {demoSnapshot,recordsOf,type Snapshot} from '../../packages/shared/src/index';
const catalog={Free:{tasks:5,habits:3,goals:3,transactions:100,automations:0,emails:0},Pro:{tasks:null,habits:null,goals:null,transactions:null,automations:10,emails:150},Lifetime:{tasks:null,habits:null,goals:null,transactions:null,automations:5,emails:60}};
function fixture(openTasks=5):Snapshot{
 const s=demoSnapshot();
 s.profile={...s.profile,name:'Trial fixture',email:'trial@example.com',plan:'Free',onboardingCompletedAt:'2026-09-01T00:00:00Z',allowances:{tasks:5,habits:3,goals:3,transactions:100,automations:0,emails:0}};
 s.records=recordsOf(s.records,'task').slice(0,openTasks).map(r=>({...r,data:{...r.data,done:false,completedAt:null}}));
 s.planDetails={source:'free',expiresAt:null,trial:{available:true,used:false,endsAt:null},catalog:catalog as never,usage:{emails:0,aiRequests:9,aiTokens:1000},aiAllowances:{Free:{requests:10,tokens:10000},Pro:{requests:100,tokens:100000},Lifetime:{requests:60,tokens:60000}}};
 return s;
}
async function mock(page:import('@playwright/test').Page,s:Snapshot){await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:s.profile.name,email:s.profile.email,status:'active'},csrf:'fixture'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));}

test('free users are offered a no-card Pro trial; starting it updates the plan without a reload',async({page})=>{
 const s=fixture();let started=0;await mock(page,s);
 await page.route('**/backend/api/billing/trial',async r=>{started++;const endsAt=new Date(Date.now()+7*86400000).toISOString();s.profile.plan='Pro';s.profile.allowances={tasks:null,habits:null,goals:null,transactions:null,automations:10,emails:150};s.planDetails!.source='manual override';s.planDetails!.trial={available:false,used:true,endsAt};await r.fulfill({status:201,json:{endsAt}});});
 await page.goto('/tasks');await expect(page.getByRole('heading',{name:'Upgrade your Daily Ledger'})).toBeVisible();
 const offer=page.getByRole('dialog').locator('.trial-offer');await expect(offer).toContainText('Try Pro free for 7 days');await expect(offer).toContainText('No card needed');
 await offer.getByRole('button',{name:'Start 7-day Pro trial'}).click();expect(started).toBe(1);
 await expect(page.locator('.sidebar .plan-badge')).toHaveText('Pro trial · 7d left',{timeout:20000});
 await page.getByRole('dialog').getByRole('button',{name:'Continue with Free',exact:true}).click({timeout:3000}).catch(()=>undefined);
 await page.goto('/settings');await expect(page.locator('.plan-summary h2')).toHaveText('Pro plan');await expect(page.locator('.trial-status')).toContainText('7 days left');await expect(page.locator('.plan-source')).toContainText('Free Pro trial');await expect(page.locator('.trial-offer')).toHaveCount(0);
});

test('usage meters turn red from 80% and show the hard limit at 100%',async({page})=>{
 const s=fixture(5);s.planDetails!.trial.available=false;s.planDetails!.trial.used=true;await mock(page,s);
 await page.goto('/settings');await page.getByRole('button',{name:'Continue with Free',exact:true}).click({timeout:3000}).catch(()=>undefined);
 const tasks=page.locator('.plan-usage-row').filter({hasText:'Active tasks'});
 await expect(tasks.locator('.usage-meter')).toHaveAttribute('data-level','full');await expect(tasks.locator('.usage-flag')).toHaveText('Limit reached');
 await expect(tasks.locator('.progress>div')).toHaveCSS('background-color','rgb(240, 70, 58)');
 const ai=page.locator('.plan-usage-row').filter({hasText:'AI requests this month'});await expect(ai.locator('.usage-meter')).toHaveAttribute('data-level','high');await expect(ai.locator('.usage-flag')).toHaveText('90% used');await expect(ai.locator('.progress>div')).toHaveCSS('background-color','rgb(232, 104, 95)');
 const habits=page.locator('.plan-usage-row').filter({hasText:'Active habits'});await expect(habits.locator('.usage-flag')).toHaveCount(0);await expect(habits.locator('.progress>div')).toHaveCSS('background-color','rgb(128, 228, 189)');
});
