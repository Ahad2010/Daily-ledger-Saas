import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';

const seed=async(page:any,seen:string)=>{const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';await page.addInitScript(([x,level]:[any,string])=>{if(!localStorage.getItem('daily-ledger-demo-v1')){localStorage.setItem('daily-ledger-demo-v1',JSON.stringify(x));if(level)localStorage.setItem('dl-fit-level',level);}},[s,seen]);};

test('fitness shows level, rank, XP, weekly goals and badges',async({page})=>{
 await seed(page,'');await page.goto('/fitness');
 const hero=page.locator('.lv-hero');await expect(hero).toContainText('Rookie');await expect(hero).toContainText('XP to level');
 await expect(hero.getByRole('progressbar')).toHaveAttribute('aria-valuenow',/\d+/);
 await expect(hero.getByText('Train 3 times')).toBeVisible();await expect(page.locator('.lv-badges li.on')).not.toHaveCount(0);await expect(page.locator('.lv-badges li:not(.on)')).not.toHaveCount(0);
 await expect(page.getByRole('status',{name:/Level up/})).toHaveCount(0);
});

test('reaching a new level shows a celebration once',async({page})=>{
 await seed(page,'1');await page.goto('/fitness');
 const up=page.getByRole('status',{name:/Level up/});await expect(up).toBeVisible();await up.getByRole('button',{name:'Nice'}).click();await expect(up).toHaveCount(0);
 await page.reload();await expect(page.getByRole('status',{name:/Level up/})).toHaveCount(0);
});

test('completed workouts show the XP they earned and programs show their first sessions',async({page})=>{
 await seed(page,'');await page.goto('/fitness');
 await expect(page.locator('.workout-session .xp-chip.got').first()).toContainText('XP');
 await expect(page.locator('.fp-when').first()).toContainText('Your first sessions');await expect(page.getByRole('button',{name:'Start this plan tomorrow'}).first()).toBeVisible();
});

test('XP history lists finished sessions and a finished workout cannot be unticked',async({page})=>{
 await seed(page,'');await page.goto('/fitness');
 await expect(page.locator('.lv-history li').first()).toContainText('XP');
 const done=page.locator('.workout-session.session-completed [role=checkbox]').first();await expect(done).toHaveClass(/locked/);
 await done.click({force:true});await expect(done).toBeChecked();
});
