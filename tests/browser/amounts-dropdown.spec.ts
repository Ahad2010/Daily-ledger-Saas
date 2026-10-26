import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';

test('amounts show thousands commas while typing and category always lists every choice',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));localStorage.setItem('dl-finance-setup','done');}},s);
 await page.setViewportSize({width:1200,height:900});await page.goto('/finance');
 await page.locator('.fq.out').click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Name').fill('Laptop');
 const amount=dialog.getByLabel('Amount');await amount.click();await page.keyboard.type('100000');await expect(amount).toHaveValue('100,000');
 await page.keyboard.press('Backspace');await expect(amount).toHaveValue('10,000');
 const category=dialog.getByRole('combobox',{name:'Category'});await category.click();
 const list=dialog.getByRole('listbox');await expect(list.getByRole('option')).not.toHaveCount(0);const total=await list.getByRole('option').count();expect(total).toBeGreaterThanOrEqual(8);
 await list.getByRole('option',{name:'Housing'}).click();await expect(category).toHaveValue('Housing');
 await category.click();await expect(list.getByRole('option')).toHaveCount(total);await page.waitForTimeout(500);await page.screenshot({path:'artifacts/phase7/combo.png'});await dialog.getByRole('heading',{name:'New transaction'}).click();
 
 await dialog.getByRole('button',{name:/Create transaction|Save/}).click();await expect(dialog).toHaveCount(0);
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-ledger-demo-v1')!));
 const tx=data.records.find((r:any)=>r.kind==='transaction'&&r.data.title==='Laptop');expect(tx.data.amount).toBe(1000000);expect(tx.data.category).toBe('Housing');
});

test('an amount stops at ten digits and a huge total still fits its dashboard card',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));localStorage.setItem('dl-finance-setup','done');}},s);
 await page.setViewportSize({width:1200,height:900});await page.goto('/finance');
 await page.locator('.fq.in').click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Name').fill('Windfall');
 const amount=dialog.getByLabel('Amount');await amount.click();await page.keyboard.type('123456789012345');await expect(amount).toHaveValue('1,234,567,890');
 await dialog.getByRole('button',{name:/Create transaction|Save/}).click();await expect(dialog).toHaveCount(0);
 await page.goto('/');await page.waitForTimeout(1500);
 const cards=page.locator('.metric-card');for(const i of [0,1,2]){const c=cards.nth(i);const box=await c.boundingBox();const text=await c.locator('.metric-content strong, .metric-content > span:nth-of-type(2)').first().boundingBox();if(box&&text)expect(text.x+text.width).toBeLessThanOrEqual(box.x+box.width+1);}
});

test('overview shortens amounts from 100,000 and overview rows can be edited',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 s.records.push({id:'big',kind:'transaction',version:1,data:{title:'Bonus',date:'2026-09-29',amount:15000000,currency:'USD',type:'income',category:'Salary',account:'Main',notes:''}} as any);
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));localStorage.setItem('dl-finance-setup','done');}},s);
 await page.goto('/');await expect(page.locator('.metric-card').first()).toContainText('$154K');
 await page.goto('/finance');await expect(page.getByRole('button',{name:'Edit Bonus'})).toBeVisible();
});
