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
