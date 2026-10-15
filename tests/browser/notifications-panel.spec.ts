import {test,expect} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
for(const [width,height] of [[390,844],[1440,900]])test(`notifications slide in from the right at ${width}px and can be cleared in one tap`,async({page})=>{
 await page.setViewportSize({width,height});const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 const notes=(i:number,read:boolean)=>({id:'n'+i,kind:'notification',version:1,data:{title:i===1?'Budget alert — Food reached 80% of its limit':'Your September report is ready',read,date:`2026-09-0${i+1}`}});
 s.records=[...s.records.filter(r=>r.kind!=='notification'&&r.kind!=='announcement'),notes(1,false),notes(2,false)] as typeof s.records;
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 const patched:string[]=[];
 await page.route('**/backend/api/records/**',async r=>{if(r.request().method()==='PATCH'){const id=r.request().url().split('/').at(-1)!;patched.push(id);const body=r.request().postDataJSON();s.records=s.records.map(x=>x.id===id?{...x,data:body.data,version:x.version+1}:x) as typeof s.records;await r.fulfill({json:{id,kind:'notification',data:body.data,version:2}});}else await r.continue();});
 await page.goto('/');await page.getByRole('button',{name:'Notifications, 2 unread'}).click();
 const panel=page.getByRole('dialog',{name:'Notifications'});await expect(panel).toBeVisible();await page.waitForTimeout(700);
 const box=await panel.boundingBox();expect(Math.round(box!.x+box!.width)).toBe(width);expect(box!.y).toBe(0);expect(Math.round(box!.height)).toBe(height);expect(box!.width).toBeLessThanOrEqual(Math.min(430,width*.94)+1);
 await expect(panel).toContainText('Stay updated with all the important activities.');await expect(panel).toContainText('Budget alert');await expect(panel).toContainText('Food reached 80% of its limit');await expect(panel).toContainText('reached the end of notifications');
 await panel.getByRole('button',{name:'Mark all as read'}).click();await expect.poll(()=>patched.length).toBe(2);
 await expect(panel.getByRole('button',{name:'Mark all as read'})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await expect(page.getByRole('button',{name:'Notifications, 0 unread'})).toBeVisible();
});

test('admin announcements appear in the bell panel, count on the bell and can be dismissed',async({page})=>{
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 const a={id:'a1',kind:'announcement',version:1,data:{title:'New: weekly review',description:'Open Reports every Monday.',audience:'Everyone',version:1,priority:5,publishAt:'2026-09-01T00:00:00.000Z',expiresAt:'2030-01-01T00:00:00.000Z',followup:false}};
 s.records=[...s.records.filter(r=>r.kind!=='notification'&&r.kind!=='announcement'),a] as typeof s.records;
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.goto('/');await page.getByRole('button',{name:'Notifications, 1 unread'}).click();
 const panel=page.getByRole('dialog',{name:'Notifications'});await expect(panel.getByText('New: weekly review')).toBeVisible();await expect(panel.getByText('Open Reports every Monday.')).toBeVisible();
});
