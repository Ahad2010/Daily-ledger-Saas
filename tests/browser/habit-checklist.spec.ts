import {test,expect} from '@playwright/test';
for(const width of [360,390,768,1024,1440,1920])test(`weekly habits, streaks and isolated chart hover ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/tasks');
 const checklist=page.locator('.weekly-habits');await expect(checklist.getByRole('heading',{name:'Weekly habit checklist'})).toBeVisible();
 const reading=checklist.locator('.weekly-habit').filter({has:page.getByRole('heading',{name:'Reading',exact:true})});
 await expect(reading.locator('.habit-day')).toHaveCount(7);await expect(reading.locator('.habit-streak')).toContainText('current');await expect(reading.locator('.habit-streak')).toContainText('best');
 await expect(reading.getByRole('button',{name:'Reading, 2026-09-29, Completed',exact:true})).toBeDisabled();
 const today=reading.getByRole('button',{name:'Reading, 2026-09-30, Completed',exact:true});await today.click();
 await expect(reading.getByRole('button',{name:'Reading, 2026-09-30, Due today',exact:true})).toHaveAttribute('aria-pressed','false');
 await reading.getByRole('button',{name:'Reading, 2026-09-30, Due today',exact:true}).click();await expect(today).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`artifacts/habit-checklist-${width}.png`,fullPage:true});
 const chart=page.locator('.task-analytics .trend-chart');await chart.scrollIntoViewIfNeeded();const box=await chart.boundingBox();await page.mouse.move(box!.x+box!.width*.55,box!.y+box!.height*.5);
 await expect(page.getByRole('tooltip')).toHaveCount(1);await expect(page.getByRole('tooltip')).toContainText('tasks');
 await page.mouse.move(0,0);await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('habit creation and removal update the checklist with motion-safe controls',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/tasks');await page.getByRole('button',{name:'New habit',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Habit name',{exact:true}).fill('Stretching fixture');await dialog.getByRole('button',{name:'Create habit'}).click();await expect(dialog).toHaveCount(0);
 const habit=page.locator('.weekly-habit').filter({hasText:'Stretching fixture'});await expect(habit).toBeVisible();await expect(habit.locator('.habit-streak')).toContainText('0 current');
 await habit.getByRole('button',{name:'Delete Stretching fixture',exact:true}).click();await dialog.getByRole('button',{name:'Delete record',exact:true}).click();await expect(habit).toHaveCount(0);
});

test('habit ticks stay simple and immediate without scale or stroke animation',async({page})=>{
 await page.goto('/tasks');const reading=page.locator('.weekly-habit').filter({has:page.getByRole('heading',{name:'Reading',exact:true})});
 const mark=reading.locator('.habit-day.today .habit-check-mark');
 await mark.evaluate(el=>{const changes:string[]=[];(window as any).__habitMotion=changes;new MutationObserver(entries=>entries.forEach(e=>changes.push((e.target as HTMLElement).getAttribute('style')||''))).observe(el,{attributes:true,subtree:true,attributeFilter:['style']});});
 await reading.getByRole('button',{name:'Reading, 2026-09-30, Completed',exact:true}).click();await expect(reading.getByRole('button',{name:'Reading, 2026-09-30, Due today',exact:true})).toBeEnabled();
 await reading.getByRole('button',{name:'Reading, 2026-09-30, Due today',exact:true}).click();await expect(reading.getByRole('button',{name:'Reading, 2026-09-30, Completed',exact:true})).toHaveAttribute('aria-pressed','true');
 expect(await page.evaluate(()=>(window as any).__habitMotion.some((s:string)=>s.includes('scale')))).toBe(false);
 expect(await page.evaluate(()=>(window as any).__habitMotion.some((s:string)=>s.includes('stroke-dashoffset')))).toBe(false);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>(window as any).__habitMotion=[]);
 await reading.getByRole('button',{name:'Reading, 2026-09-30, Completed',exact:true}).click();await expect(reading.getByRole('button',{name:'Reading, 2026-09-30, Due today',exact:true})).toHaveAttribute('aria-pressed','false');
 expect(await mark.evaluate(el=>getComputedStyle(el).transform)).toBe('none');
});
