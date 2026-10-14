import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const){
 test(`meals planner logs foods and sets a target ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/meals');
  const planner=page.locator('.nutrition-planner');await expect(planner.getByRole('heading',{name:'Eat to your target'})).toBeVisible();
  await planner.getByLabel('Search foods').fill('roti');await planner.getByRole('button',{name:'Add Roti (whole wheat)'}).click();
  await planner.getByLabel('Grams of Roti (whole wheat)').fill('80');await expect(planner.locator('.np-total')).toContainText('238 kcal');
  await planner.getByRole('button',{name:'Log as eaten'}).click();await expect(planner.getByRole('status')).toContainText('logged');
  await expect(planner.locator('.np-kcal strong')).toContainText('238');
  await planner.getByRole('button',{name:'Set daily target'}).first().click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const kcal=await dialog.getByLabel('Calories target').inputValue();expect(Number(kcal)).toBeGreaterThan(1200);
  await dialog.getByRole('button',{name:'Save target'}).click();await expect(dialog).toHaveCount(0);
  await expect(planner.getByText('Protein').first()).toBeVisible();await expect(planner.locator('.np-kcal em')).toContainText('left');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/meals-planner-${name}.png`,fullPage:true});
 });
 test(`fitness planner logs sets, records, programs and body weight ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/fitness');
  await page.getByRole('button',{name:'Log a session with sets'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByLabel('Session name').fill('Leg day test');await dialog.getByLabel('Exercise 1 name').fill('Squat');
  await dialog.getByLabel('Exercise 1 set 1 reps').fill('5');await dialog.getByLabel('Exercise 1 set 1 weight').fill('100');
  await dialog.getByRole('button',{name:'Add set'}).click();await dialog.getByLabel('Exercise 1 set 2 weight').fill('105');
  await expect(dialog.locator('.fp-volume')).toContainText('1,025');
  await dialog.getByRole('button',{name:'Save session'}).click();await expect(dialog).toHaveCount(0);
  const row=page.locator('.workout-session').filter({hasText:'Leg day test'});await expect(row).toBeVisible();await expect(row).toContainText('1 exercise ');
  await expect(page.locator('.fp-records')).toContainText('Squat');
  await page.getByRole('button',{name:'Schedule from tomorrow'}).first().click();await expect(page.locator('.fitness-planner').getByRole('status')).toContainText('scheduled');
  await page.getByLabel('Weight (kg)').fill('72.5');await page.getByRole('button',{name:'Save check-in'}).click();await expect(page.locator('.fp-body')).toContainText('72.5 kg');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/fitness-planner-${name}.png`,fullPage:true});
 });
}
