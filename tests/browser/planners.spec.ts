import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const){
 test(`meals hub: log food, recents, water, target, tabs ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/meals');
  const tabs=page.getByRole('tablist',{name:'Meals sections'});for(const n of ['Today','Plan','Groceries','Insights'])await expect(tabs.getByRole('tab',{name:n})).toBeVisible();
  const log=page.locator('.np-log-card');await expect(log.getByRole('heading',{name:'Log food'})).toBeVisible();
  await log.getByLabel('Search foods').fill('roti');await log.getByRole('button',{name:'Add Roti (whole wheat)'}).click();
  await log.getByLabel('Grams of Roti (whole wheat)').fill('80');await expect(log.locator('.np-total')).toContainText('238 kcal');
  await log.getByRole('button',{name:'Log as eaten'}).click();await expect(log.getByRole('status')).toContainText('logged');
  await expect(page.locator('.np-today-log')).toContainText('Roti (whole wheat)');
  await expect(page.locator('.cal-ring')).toHaveAttribute('aria-label',/238 calories eaten/);
  await expect(page.getByRole('button',{name:'Add recent Roti (whole wheat)'})).toBeVisible();
  await page.getByRole('button',{name:'+ 250 ml'}).click();await expect(page.locator('.np-water')).toContainText('250 of 2,500 ml');
  await page.getByRole('button',{name:'Set daily target'}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  expect(Number(await dialog.getByLabel('Calories target').inputValue())).toBeGreaterThan(1200);
  await dialog.getByRole('button',{name:'Save target'}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.cal-ring')).toContainText('kcal left');await expect(page.locator('.np-next')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/meals-today-${name}.png`,fullPage:true});
  await tabs.getByRole('tab',{name:'Plan'}).click();await expect(page.locator('.plan-days .plan-day')).toHaveCount(7);await expect(page.locator('.meal-grid')).toContainText('Dinner');
  await page.screenshot({path:`artifacts/meals-plan-${name}.png`,fullPage:true});
  await tabs.getByRole('tab',{name:'Groceries'}).click();await expect(page.getByRole('heading',{name:'Grocery list'})).toBeVisible();
  await page.screenshot({path:`artifacts/meals-groceries-${name}.png`,fullPage:true});
  await tabs.getByRole('tab',{name:'Insights'}).click();await expect(page.getByRole('heading',{name:'This week'})).toBeVisible();await expect(page.locator('.np-stats')).toContainText('Days logged');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/meals-insights-${name}.png`,fullPage:true});
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
