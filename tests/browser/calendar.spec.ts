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
 const s=await seed(page);await page.goto('/calendar');await expect(page.locator('.cal-detail')).toBeVisible();await page.waitForTimeout(1200);
 const workout=recordsOf(s.records,'workout').find(w=>w.data.date==='2026-09-30'||w.data.date==='2026-09-26')!;
 const chip=page.locator(`.cal-day[data-date="${workout.data.date}"] .cal-chips em`).filter({hasText:workout.data.title});
 await chip.dragTo(page.locator('.cal-day[data-date="2026-09-28"]'),{targetPosition:{x:6,y:6}});
 await expect.poll(async()=>(await stored(page)).records.find((r:any)=>r.id===workout.id).data.date).toBe('2026-09-28');
 await page.getByRole('button',{name:'Week',exact:true}).click();await expect(page.locator('.cal-grid.is-week .cal-day')).toHaveCount(7);
});

test('calendar fits a phone without sideways scroll',async({page})=>{
 await seed(page);await page.setViewportSize({width:390,height:844});await page.goto('/calendar');
 await expect(page.locator('.cal-grid')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.cal-day[data-date="2026-09-12"]').click();await expect(page.locator('.cal-detail h2')).toContainText('September 12');
});

test('a habit added from a day repeats only on that weekday; a bill added from a day is one time',async({page})=>{
 await seed(page);await page.goto('/calendar');await page.getByRole('button',{name:'Next month'}).click();
 await page.locator('.cal-day[data-date="2026-10-31"]').click({position:{x:6,y:6}});
 const panel=page.locator('.cal-detail');await panel.getByRole('button',{name:'Habit',exact:true}).click();
 const form=page.getByRole('dialog');await form.getByLabel('Habit name',{exact:true}).fill('Drink water');await form.getByRole('button',{name:'Next',exact:true}).click();
 await expect(form.getByRole('button',{name:'Sat',exact:true})).toHaveClass(/selected/);await expect(form.getByRole('button',{name:'Mon',exact:true})).not.toHaveClass(/selected/);
 await form.getByRole('button',{name:'Create habit'}).click();await expect(form).toHaveCount(0);
 await expect(panel.getByText('Drink water')).toBeVisible();
 await expect(panel.getByRole('checkbox',{name:'Complete Drink water'})).toHaveCount(0);
 await panel.getByRole('button',{name:'Bill',exact:true}).click();
 await form.getByLabel('Name',{exact:true}).fill('Internet');await form.getByLabel('Amount',{exact:true}).fill('3000');await form.getByRole('button',{name:'Next',exact:true}).click();
 await expect(form.getByLabel('Date',{exact:true})).toHaveValue('2026-10-31');await form.getByRole('button',{name:'Save plan'}).click();await expect(form).toHaveCount(0);
 await expect(page.locator('.cal-day[data-date="2026-10-31"]')).toContainText('Internet');
 await page.getByRole('button',{name:'Next month'}).click();await expect(page.locator('.cal-day[data-date="2026-11-30"]')).not.toContainText('Internet');
});

test('a task can repeat on days picked from a calendar, each day becomes its own task',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('button',{name:'Quick add',exact:true}).click();await page.getByRole('button',{name:'Task',exact:true}).click();
 const form=page.getByRole('dialog');await form.getByLabel('Task title',{exact:true}).fill('Take vitamins');await form.getByRole('button',{name:'Next',exact:true}).click();
 await form.getByRole('radio',{name:'Pick days'}).click();await expect(form.getByText('Tap the days you want.')).toBeVisible();
 await form.getByRole('button',{name:'Next',exact:true}).click();await form.getByRole('button',{name:'Create task'}).click();await expect(form.getByText('Pick at least one day.')).toBeVisible();
 await form.getByRole('button',{name:'Next month'}).click();for(const d of ['2026-10-02','2026-10-05','2026-10-07'])await form.getByRole('button',{name:d,exact:true}).click();
 await expect(form.getByText('3 days selected')).toBeVisible();
 await form.getByRole('button',{name:'Next',exact:true}).click();await form.getByRole('button',{name:'Create task'}).click();await expect(form).toHaveCount(0);
 const tasks=(await stored(page)).records.filter((r:any)=>r.data.title==='Take vitamins');
 expect(tasks).toHaveLength(3);expect(new Set(tasks.map((t:any)=>t.data.due.slice(11,16))).size).toBe(1);
 expect(tasks.map((t:any)=>new Date(t.data.due).getDate()).sort()).toEqual([2,5,7]);
});

test('a workout and a meal can be planned on several chosen days',async({page})=>{
 await seed(page);await page.goto('/');await page.getByRole('button',{name:'Quick add',exact:true}).click();await page.getByRole('button',{name:'Workout',exact:true}).click();
 const form=page.getByRole('dialog');await form.getByLabel('Workout name',{exact:true}).fill('Leg day');await form.getByRole('button',{name:'Next',exact:true}).click();await form.getByRole('button',{name:'Next',exact:true}).click();
 await form.getByRole('radio',{name:'Pick days'}).click();await form.getByRole('button',{name:'Next month'}).click();for(const d of ['2026-10-03','2026-10-10'])await form.getByRole('button',{name:d,exact:true}).click();
 await form.getByRole('button',{name:'Create workout'}).click();await expect(form).toHaveCount(0);
 expect((await stored(page)).records.filter((r:any)=>r.data.title==='Leg day').map((r:any)=>r.data.date).sort()).toEqual(['2026-10-03','2026-10-10']);
});
