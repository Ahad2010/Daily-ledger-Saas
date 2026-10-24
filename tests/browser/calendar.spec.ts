import {test,expect} from '@playwright/test';
import {demoSnapshot,recordsOf} from '../../packages/shared/src/index';

const seed=async(page:any)=>{const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1'))localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));},s);return s;};
const stored=(page:any)=>page.evaluate(()=>JSON.parse(localStorage.getItem('daily-ledger-demo-v1')!));

test('calendar shows habits and money, adds from the day panel and ticks items',async({page})=>{
 await seed(page);await page.goto('/calendar');
 const panel=page.locator('.cal-detail');await expect(panel.getByRole('group',{name:/^Add to /})).toBeVisible();
 for(const name of ['Task','Habit','Workout','Meal','Bill','Money'])await expect(panel.getByRole('button',{name,exact:true})).toBeVisible();
 await expect(panel.getByText('Reading')).toBeVisible();await expect(panel.getByText('Consulting income')).toBeVisible();
 await expect(page.locator('.cal-glance')).toContainText('days planned');
 await panel.getByRole('button',{name:'Task',exact:true}).click();await expect(page.getByRole('dialog').getByText('What needs doing?')).toBeVisible();
 await page.keyboard.press('Escape');
 const tick=panel.getByRole('checkbox',{name:'Complete Finish client proposal'});await tick.click();await expect(tick).toBeChecked();
 const data=await stored(page);expect(data.records.find((r:any)=>r.data.title==='Finish client proposal').data.done).toBe(true);
});

test('pick a task, then a day: it is rescheduled and keeps its time',async({page})=>{
 const s=await seed(page);await page.goto('/calendar');
 const task=recordsOf(s.records,'task').find(t=>t.data.title==='Review monthly budget')!;const before=new Date(task.data.due);
 await page.locator('.cal-detail').getByRole('button',{name:'Move Review monthly budget'}).click();await expect(page.locator('.cal-placing')).toContainText('Review monthly budget');
 await page.locator('.cal-day[data-date="2026-09-22"]').click();await expect(page.locator('.cal-placing')).toHaveCount(0);
 const after=(await stored(page)).records.find((r:any)=>r.id===task.id).data.due;const moved=new Date(after);
 expect(Math.round((moved.getTime()-before.getTime())/864e5)).toBe(-8);expect(moved.getUTCHours()).toBe(before.getUTCHours());
 await expect(page.locator('.cal-day[data-date="2026-09-22"]')).toContainText('Review monthly budget');
});

test('dragging a chip onto another day reschedules it, week view lists everything',async({page})=>{
 const s=await seed(page);await page.goto('/calendar');
 const workout=recordsOf(s.records,'workout').find(w=>w.data.date==='2026-09-30'||w.data.date==='2026-09-26')!;
 const chip=page.locator(`.cal-day[data-date="${workout.data.date}"] .cal-chips em`).filter({hasText:workout.data.title});
 await chip.dragTo(page.locator('.cal-day[data-date="2026-09-28"]'),{targetPosition:{x:6,y:6}});
 expect((await stored(page)).records.find((r:any)=>r.id===workout.id).data.date).toBe('2026-09-28');
 await page.getByRole('button',{name:'Week',exact:true}).click();await expect(page.locator('.cal-grid.is-week .cal-day')).toHaveCount(7);
});

test('calendar fits a phone without sideways scroll',async({page})=>{
 await seed(page);await page.setViewportSize({width:390,height:844});await page.goto('/calendar');
 await expect(page.locator('.cal-grid')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.cal-day[data-date="2026-09-12"]').click();await expect(page.locator('.cal-detail h2')).toContainText('September 12');
});
