import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';

for(const width of [390,1440])test(`ticking a workout never moves the other rows and locks it once done ${width}px`,async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 s.records.push({id:'planned-today',kind:'workout',version:1,data:{title:'Planned test session',date:'2026-09-30',type:'Strength',duration:40,done:false,notes:''}} as any);
 await page.addInitScript((x:any)=>{if(!localStorage.getItem('daily-ledger-demo-v1'))localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));},s);
 await page.setViewportSize({width,height:900});await page.goto('/fitness');
 const rows=page.locator('.workout-log-rows .detail-row');await expect(rows.first()).toBeVisible();
 const box=page.getByRole('checkbox',{name:/Complete workout Planned test session/});await expect(box).toBeVisible();await expect(box).not.toBeChecked();await page.waitForTimeout(1800);
 await page.evaluate(()=>{const seen:string[]=[];(window as any).__rowMotion=seen;const read=()=>document.querySelectorAll('.workout-log-rows .detail-row').forEach(r=>{const t=getComputedStyle(r).transform;if(t&&t!=='none')seen.push(t);});const id=setInterval(read,16);setTimeout(()=>clearInterval(id),900);});
 await box.click({force:true});await page.waitForTimeout(950);
 expect(await page.evaluate(()=>(window as any).__rowMotion)).toEqual([]);
 await expect(page.locator('.workout-log-rows .detail-row[aria-hidden=true]')).toHaveCount(0);
 await expect(box).toBeChecked();await expect(box).toHaveClass(/locked/);
 await box.click({force:true});await page.waitForTimeout(400);await expect(box).toBeChecked();
});
