import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
test.use({storageState:{cookies:[],origins:[]}});
async function fresh(page:Page,onboardedAt:string){
 const s=demoSnapshot();s.profile.onboardingCompletedAt=onboardedAt;
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
}
// A new account is first offered the tour; nothing starts until it says yes.
const invitation=(page:Page)=>page.getByRole('dialog',{name:'Tour invitation'});
async function accept(page:Page){await expect(invitation(page)).toBeVisible({timeout:15000});await invitation(page).getByRole('button',{name:'Yes, show me'}).click();}
test('a newly onboarded account is walked through the main areas once',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'});
 await expect(invitation(page)).toBeVisible({timeout:15000});await expect(invitation(page)).toContainText('Want a quick tour?');await expect(tour).toHaveCount(0);
 await accept(page);await expect(tour).toBeVisible();
 await expect(tour).toContainText('Step 1 of 11');
 for(let i=0;i<10;i++)await tour.getByRole('button',{name:'Next'}).click();
 await expect(tour).toContainText('Step 11 of 11');await tour.getByRole('button',{name:'Done'}).click();await expect(tour).toHaveCount(0);
 await page.reload();await page.waitForTimeout(4000);await expect(page.getByRole('dialog',{name:'Product tour'})).toHaveCount(0);await expect(invitation(page)).toHaveCount(0);
});
test('skipping persists, long-time accounts are not interrupted, and Settings can replay it',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'});await accept(page);await expect(tour).toBeVisible();await tour.getByRole('button',{name:'Skip tour'}).first().click();await expect(tour).toHaveCount(0);
 await page.goto('/settings');await page.getByRole('button',{name:'Replay'}).click();await expect(tour).toBeVisible();await page.keyboard.press('Escape');await expect(tour).toHaveCount(0);
});
test('an account onboarded long ago never sees the automatic tour',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await fresh(page,'2026-09-01T00:00:00Z');await page.goto('/');await page.waitForTimeout(4500);await expect(page.getByRole('dialog',{name:'Product tour'})).toHaveCount(0);await expect(invitation(page)).toHaveCount(0);
});

test('on a phone the tour opens the sidebar drawer itself, spotlights its real links, then closes it',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'}),drawer=page.locator('aside.sidebar.open');
 // Offered first: the drawer stays shut and nothing is highlighted until the account says yes.
 await expect(invitation(page)).toBeVisible({timeout:15000});await expect(drawer).toHaveCount(0);await expect(tour).toHaveCount(0);
 await accept(page);
 await expect(tour).toBeVisible();
 await expect(drawer).toBeVisible();
 const count=Number((await tour.locator('.tour-count').innerText()).match(/of (\d+)/i)![1]);expect(count).toBeGreaterThan(8);
 // Every sidebar step highlights the actual link, which sits inside the open drawer.
 const spotOnLink=async(href:string)=>{
  await expect.poll(async()=>{const spot=await page.locator('.tour-spot').boundingBox(),link=await page.locator(`.sidebar a.nav-link[href="${href}"]`).boundingBox();if(!spot||!link)return {ok:false,href,spot,link};const cx=spot.x+spot.width/2,cy=spot.y+spot.height/2;return {ok:cx>=link.x&&cx<=link.x+link.width&&cy>=link.y&&cy<=link.y+link.height,href,spot,link};},{timeout:5000}).toMatchObject({ok:true});
 };
 await expect(tour).toContainText('Overview');await spotOnLink('/');
 await tour.getByRole('button',{name:'Next'}).click();await expect(tour).toContainText('Today');await spotOnLink('/today');
 await tour.getByRole('button',{name:'Next'}).click();await expect(tour).toContainText('Calendar');await spotOnLink('/calendar');
 // Walk on to the first step that is not in the drawer: the drawer closes by itself.
 for(let i=3;i<count;i++){
  await tour.getByRole('button',{name:'Next'}).click();
  if(await drawer.count()===0)break;
 }
 await expect(drawer).toHaveCount(0,{timeout:3000});
 // The final step points at the menu button that reopens it.
 while(!(await tour.getByRole('button',{name:'Done'}).count())){await tour.getByRole('button',{name:'Next'}).click();}
 await expect(tour).toContainText('Your menu');
 await tour.getByRole('button',{name:'Done'}).click();await expect(tour).toHaveCount(0);await expect(drawer).toHaveCount(0);
});
test('skipping the phone tour closes the drawer it opened',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fresh(page,new Date().toISOString());await page.goto('/');
 const tour=page.getByRole('dialog',{name:'Product tour'});await accept(page);await expect(tour).toBeVisible();await expect(page.locator('aside.sidebar.open')).toBeVisible();
 await tour.getByRole('button',{name:'Skip tour'}).first().click();await expect(tour).toHaveCount(0);await expect(page.locator('aside.sidebar.open')).toHaveCount(0);
});
test('declining the invitation starts nothing and is remembered',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fresh(page,new Date().toISOString());await page.goto('/');
 await expect(invitation(page)).toBeVisible({timeout:15000});
 await invitation(page).getByRole('button',{name:'Maybe later'}).click();
 await expect(invitation(page)).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Product tour'})).toHaveCount(0);await expect(page.locator('aside.sidebar.open')).toHaveCount(0);
 await page.reload();await page.waitForTimeout(4500);await expect(invitation(page)).toHaveCount(0);
});
