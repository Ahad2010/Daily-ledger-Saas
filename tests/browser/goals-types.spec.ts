import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const){
 test(`goal types, manual check-ins and the history chart ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/goals');
  const picker=page.locator('.goal-types');await expect(picker.locator('.goal-type')).toHaveCount(7);
  await page.screenshot({path:`artifacts/goals-types-${name}.png`,fullPage:true});
  await picker.getByRole('listitem',{name:/Track any number/}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Goal name').fill('Books read');await dialog.getByLabel('Target amount').fill('12');await dialog.getByLabel('Unit').fill('books');
  await dialog.getByRole('button',{name:'Create goal'}).click();await expect(dialog).toHaveCount(0);
  const card=page.locator('.goal-block').filter({hasText:'Books read'});await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Check in'}).click();await dialog.getByRole('button',{name:'50%',exact:true}).click();await dialog.getByLabel('Note (optional)').fill('Halfway there');await dialog.getByRole('button',{name:'Save progress'}).click();await expect(dialog).toHaveCount(0);
  await expect(card.locator('.goal-values')).toContainText('6');
  await card.getByRole('link',{name:/Books read/}).click();await expect(page).toHaveURL(/\/goals\/.+/);
  await expect(page.locator('.goal-history')).toContainText('Halfway there');await expect(page.locator('.goal-history')).toContainText('6 books');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/goal-detail-${name}.png`,fullPage:true});
 });
 test(`a weight goal follows body check-ins on its own ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/goals');
  await page.locator('.goal-types').getByRole('listitem',{name:/Reach a weight/}).click();const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Goal name').fill('Get to 75 kg');await dialog.getByLabel('Current weight (kg)').fill('80');await dialog.getByLabel('Goal weight (kg)').fill('75');
  await dialog.getByRole('button',{name:'Create goal'}).click();await expect(dialog).toHaveCount(0);
  const card=page.locator('.goal-block').filter({hasText:'Get to 75 kg'});await expect(card).toContainText('Automatic');await expect(card.locator('.goal-percent')).toContainText('0%');
  await page.goto('/fitness');await page.getByRole('tab',{name:'Progress'}).click();await page.getByLabel('Weight (kg)').fill('78');await page.getByRole('button',{name:'Save check-in'}).click();await expect(page.locator('.fp-body')).toContainText('78 kg');
  await page.goto('/goals');await expect(page.locator('.goal-block').filter({hasText:'Get to 75 kg'}).locator('.goal-percent')).toContainText('40%');
 });
}
test('emergency fund shortcut lives inside the Save money setup',async({page})=>{
 await page.goto('/goals');await page.locator('.goal-types').getByRole('listitem',{name:/Save money/}).click();
 const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:/Use emergency fund/})).toBeVisible();
});
