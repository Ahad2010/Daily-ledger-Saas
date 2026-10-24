import {test,expect} from '@playwright/test';
for(const [name,width] of [['phone',390],['laptop',1440]] as const){
 test(`today screen gathers the day and the weekly review ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/today');
  await expect(page.getByRole('heading',{name:/^Good (morning|afternoon|evening|night)/})).toBeVisible();
  for(const h of ['Tasks','Habits','Workout','Meals','Bills this week','Goals'])await expect(page.locator('.today-card').getByRole('heading',{name:h})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Your last 7 days'})).toBeVisible();await expect(page.getByRole('heading',{name:'Wins'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/today-${name}.png`,fullPage:true});
 });
 test(`calendar shows plans, switches month and adds for a day ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/calendar');
  await expect(page.getByRole('heading',{name:'September 2026'})).toBeVisible();
  await expect(page.locator('.cal-day.today')).toHaveCount(1);
  await page.getByRole('gridcell',{name:/^2026-09-30/}).click({position:{x:6,y:6}});await expect(page.locator('.cal-detail')).toContainText('September 30');
  await page.getByRole('button',{name:'Task',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Next month'}).click();await expect(page.getByRole('heading',{name:'October 2026'})).toBeVisible();
  await page.getByRole('button',{name:'Today',exact:true}).click();await expect(page.getByRole('heading',{name:'September 2026'})).toBeVisible();
  await page.getByRole('button',{name:'Workouts'}).click();await expect(page.getByRole('button',{name:'Workouts'})).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`artifacts/calendar-${name}.png`,fullPage:true});
 });
 test(`goal percentage opens a slider and saves ${name}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/goals');
  await page.getByRole('button',{name:/Set progress for Emergency fund/}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'75%',exact:true}).click();await expect(dialog.locator('.goal-slider-value')).toContainText('3,750');
  await page.screenshot({path:`artifacts/goal-slider-${name}.png`});
  await dialog.getByRole('button',{name:'Save progress'}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Set progress for Emergency fund, currently 75%/})).toBeVisible();
 });
}
test('Today and Calendar are in the navigation and search',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 await expect(page.getByRole('link',{name:'Today',exact:true}).first()).toBeVisible();await expect(page.getByRole('link',{name:'Calendar',exact:true}).first()).toBeVisible();
 await page.getByLabel('Search your records').fill('calendar');await page.locator('.search-results').getByRole('button',{name:/Calendar/}).click();await expect(page).toHaveURL(/\/calendar/);
});
