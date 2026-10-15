import {expect,test} from '@playwright/test';

test('currency, units, week start and number style can be changed in Settings',async({page})=>{
 await page.goto('/settings?tab=general');
 await page.getByRole('button',{name:'Edit language and currency'}).click();
 await page.getByRole('button',{name:'Currency',exact:true}).click();
 await page.getByLabel('Search currencies').fill('euro');
 await page.getByRole('dialog').getByRole('button',{name:/EUR/}).first().click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText('English, EUR')).toBeVisible();
 await page.goto('/');await expect(page.locator('.metric-content strong').first()).toHaveText('€4,000');
 await page.goto('/settings?tab=general');
 await page.getByRole('button',{name:'Edit units and formats'}).click();
 await page.getByRole('combobox',{name:'Units'}).click();await page.getByRole('option',{name:/Imperial/}).click();
 await page.getByRole('combobox',{name:'Week starts on'}).click();await page.getByRole('option',{name:'Sunday'}).click();
 await page.getByRole('combobox',{name:'Number format'}).click();await page.getByRole('option',{name:/1\.234,56/}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText(/Imperial \(lb, ft\) · Week starts Sunday/)).toBeVisible();
 await page.goto('/calendar');await expect(page.locator('.cal-head').first()).toHaveText('Sun');
 await page.goto('/fitness');await page.getByRole('tab',{name:'Progress'}).click();await expect(page.getByText('Weight (lb)')).toBeVisible();
});
