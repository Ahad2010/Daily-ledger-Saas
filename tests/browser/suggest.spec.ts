import {expect,test} from '@playwright/test';
test('adding a transaction suggests a category and a task priority',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Quick add',exact:true}).click();await page.getByRole('button',{name:'Transaction',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Description',{exact:true}).fill('Uber ride to office');
 const group=dialog.getByRole('group',{name:'Suggestions'});await expect(group).toBeVisible();
 await group.getByRole('button',{name:'Transport'}).click();await expect(dialog.getByLabel('Category')).toHaveValue('Transport');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Quick add',exact:true}).click();await page.getByRole('button',{name:'Task',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Task title',{exact:true}).fill('Pay electricity bill today');
 await expect(page.getByRole('dialog').getByRole('group',{name:'Suggestions'})).toContainText('set high priority');
});
test('the clear history confirmation reads cleanly',async({page})=>{
 await page.goto('/assistant');
 const clear=page.getByRole('button',{name:/Clear history/});if(await clear.count()){await clear.click();await expect(page.getByRole('dialog').getByText('Clear your AI history?')).toBeVisible();await expect(page.getByRole('button',{name:'Keep history'})).toBeVisible();}
});
test('themed dropdowns work inside a drawer and keep the drawer open',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Quick add',exact:true}).click();await page.getByRole('button',{name:'Task',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:'Priority'}).click();await page.getByRole('option',{name:'High'}).click();
 await expect(dialog).toBeVisible();await expect(dialog.getByRole('combobox',{name:'Priority'})).toContainText('High');
 await dialog.getByLabel('Task title',{exact:true}).fill('Dropdown check');await dialog.getByRole('button',{name:/Create task/}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
