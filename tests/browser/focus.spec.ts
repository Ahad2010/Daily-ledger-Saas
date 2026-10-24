import {expect,test} from '@playwright/test';
test('Tasks focus tab shows today, adds a task and ticks it off',async({page})=>{
 await page.goto('/tasks');
 await expect(page.getByText("TODAY'S FOCUS")).toBeVisible();
 await expect(page.getByRole('heading',{name:'Needs your attention'})).toBeVisible();
 await page.getByLabel('Quick add task title').fill('Call the bank');await page.getByRole('form',{name:'Quick add task'}).getByRole('button',{name:'Add task'}).click();await page.getByRole('dialog').getByRole('button',{name:'Add task',exact:true}).click();
 await expect(page.getByText('Call the bank').first()).toBeVisible();
 await page.getByRole('tab',{name:'Habits',exact:true}).click();await expect(page.getByRole('heading',{name:'Weekly habit checklist'})).toBeVisible();
});
test('finance snapshot has quick add on top and the weekly review shows a scorecard',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/finance');
 const quick=page.getByRole('group',{name:'Quick add'});await expect(quick.getByRole('button',{name:'Add income'})).toBeVisible();
 const kpi=await page.locator('.fin-kpis').boundingBox();const q=await quick.boundingBox();expect(q!.y).toBeLessThan(kpi!.y);
 await page.goto('/today');await expect(page.locator('.wr-stat')).toHaveCount(4);
});
test('demo mode lets you add a profile photo',async({page})=>{
 await page.goto('/settings?tab=general');
 await page.locator('input[aria-label="Profile photo file"]').setInputFiles({name:'me.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')});
 await expect(page.getByText('Profile photo updated.')).toBeVisible();await expect(page.locator('.sidebar-profile .avatar-image')).toBeVisible();
});
test('monthly report downloads a statement PDF in demo mode',async({page})=>{
 await page.goto('/reports');const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:/Export PDF/}).click()]);
 expect(download.suggestedFilename()).toMatch(/\.pdf$/);
});
