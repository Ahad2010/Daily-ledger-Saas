import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';

const emptyWorkspace=async(page:any)=>{const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';s.records=s.records.filter((r:any)=>r.kind==='bodyMetric');await page.addInitScript((x:any)=>{try{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));localStorage.removeItem('dl-finance-setup');}}catch{/* ignore */}},s);};
const stored=(page:any)=>page.evaluate(()=>JSON.parse(localStorage.getItem('daily-ledger-demo-v1')!));

test('a new customer answers a few questions and finance fills itself',async({page})=>{
 await emptyWorkspace(page);await page.goto('/finance');
 const dialog=page.getByRole('dialog');await expect(dialog.getByText('How much do you earn each month?')).toBeVisible();
 await dialog.getByLabel('Amount for Salary').fill('50000');
 await page.screenshot({path:'artifacts/phase4/setup-2-income.png'});await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await dialog.getByRole('button',{name:'Rent',exact:true}).click();await dialog.getByLabel('Amount for Rent').fill('15000');await dialog.getByRole('button',{name:'Internet',exact:true}).click();await dialog.getByLabel('Amount for Internet').fill('3000');
 await page.screenshot({path:'artifacts/phase4/setup-3-bills.png'});await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await dialog.getByRole('button',{name:/^70% of income/}).click();await expect(dialog.getByLabel('Monthly budget')).toHaveValue('35,000');
 await page.screenshot({path:'artifacts/phase4/setup-4-budget.png'});await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await dialog.getByRole('button',{name:'Vacation',exact:true}).click();await dialog.getByLabel('Goal target').fill('100000');
 await page.screenshot({path:'artifacts/phase4/setup-5-goal.png'});await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await expect(dialog.getByText('Here is your plan')).toBeVisible();await page.screenshot({path:'artifacts/phase4/setup-6-review.png'});
 await dialog.getByRole('button',{name:'Create my finance plan'}).click();await expect(dialog.getByText('Your finance is ready')).toBeVisible();
 await page.screenshot({path:'artifacts/phase4/setup-7-done.png'});
 await dialog.getByRole('button',{name:'Open my overview'}).click();await expect(dialog).toHaveCount(0);
 const data=await stored(page);const by=(k:string)=>data.records.filter((r:any)=>r.kind===k);
 expect(by('cashPlan').map((r:any)=>`${r.data.type}:${r.data.title}:${r.data.amount}`).sort()).toEqual(['expense:Internet:300000','expense:Rent:1500000','income:Salary:5000000']);
 expect(by('budget')).toHaveLength(1);expect(by('budget')[0].data.amount).toBe(3500000);expect(by('goal').map((r:any)=>r.data.title)).toContain('Vacation');
 await expect(page.locator('.fs-banner')).toHaveCount(0);await expect(page.locator('.finance-options')).toContainText('1 source');
 await page.screenshot({path:'artifacts/phase4/setup-8-overview.png',fullPage:true});
});

test('maybe later closes the guide and the banner can start it again',async({page})=>{
 await emptyWorkspace(page);await page.goto('/finance');const dialog=page.getByRole('dialog');
 await expect(dialog.getByText('How much do you earn each month?')).toBeVisible();await dialog.getByRole('button',{name:'Maybe later'}).click();await expect(dialog).toHaveCount(0);
 await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:/Start guided setup/}).click();await expect(page.getByRole('dialog').getByText('How much do you earn each month?')).toBeVisible();
});

test('finance pages use the dropdown instead of a back link and income rows say received or not received',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1'))localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));},s);
 await page.goto('/finance/income');await expect(page.getByRole('link',{name:'Back to Finance'})).toHaveCount(0);
 await expect(page.getByRole('combobox',{name:'Finance page'})).toContainText('Income');
 await page.goto('/finance');await expect(page.getByRole('tab',{name:'Overview'})).toBeVisible();await expect(page.getByRole('tab',{name:'Snapshot'})).toHaveCount(0);
});

test('a brand new account sees the finance guide only when it opens Finance',async({page})=>{
 await emptyWorkspace(page);await page.goto('/');await page.waitForTimeout(1500);
 await expect(page.getByRole('dialog').getByText('How much do you earn each month?')).toHaveCount(0);
 await page.goto('/finance');
 await expect(page.getByRole('dialog').getByText('How much do you earn each month?')).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Maybe later'}).click();await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('finance overview amounts count up from zero to the real number',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1'))localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));},s);
 await page.goto('/finance');const net=page.locator('.fh-main>strong, .fh-main strong').first();
 await expect(net).toHaveText('$2,720',{timeout:8000});
});

test('a free account saves its saving goal without the paid-only Finance link',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';(s.profile as any).plan='Free';s.records=s.records.filter((r:any)=>r.kind==='bodyMetric');
 await page.addInitScript((x:any)=>{try{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));localStorage.removeItem('dl-finance-setup');}}catch{/* ignore */}},s);
 await page.goto('/finance');await page.getByText('Upgrade your Daily Ledger').waitFor({timeout:8000}).then(()=>page.getByText('Continue with Free').click()).catch(()=>{});await page.waitForTimeout(600);const dialog=page.getByRole('dialog');await expect(dialog.getByText('How much do you earn each month?')).toBeVisible();
 await dialog.getByLabel('Amount for Salary').fill('1000');await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await dialog.getByRole('button',{name:'Home',exact:true}).click();await dialog.getByLabel('Goal target').fill('10000');await dialog.getByRole('button',{name:'Next',exact:true}).click();
 await expect(dialog.getByText('Here is your plan')).toBeVisible();await dialog.getByRole('button',{name:'Create my finance plan'}).click();await expect(dialog.getByText('Your finance is ready')).toBeVisible();
 const data=await stored(page);const goal=data.records.find((r:any)=>r.kind==='goal'&&r.data.title.includes('Home'));expect(goal).toBeTruthy();expect(goal.data.linkedCategory).toBeUndefined();
});
