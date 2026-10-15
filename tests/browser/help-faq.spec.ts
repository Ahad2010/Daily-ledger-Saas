import {test,expect} from '@playwright/test';

test('help answers open one at a time',async({page})=>{
 await page.goto('/help');
 const first=page.getByRole('button',{name:/Why do my totals change/}),second=page.getByRole('button',{name:/How do planned income and bills work/});
 await first.click();await expect(first).toHaveAttribute('aria-expanded','true');
 await second.click();await expect(second).toHaveAttribute('aria-expanded','true');await expect(first).toHaveAttribute('aria-expanded','false');
 await page.getByLabel('Search answers').fill('recover');await expect(page.getByRole('button',{name:/recover my account/})).toBeVisible();await expect(first).toHaveCount(0);
});
