import {test,expect} from '@playwright/test';
test('admin overview shows accounts and verified revenue per plan, separating paid, granted and trial',async({page})=>{
 await page.route('**/backend/api/admin/me',r=>r.fulfill({json:{user:{id:'admin-fixture',name:'Fixture admin'},csrf:'fixture'}}));
 await page.route('**/backend/api/admin/overview**',r=>r.fulfill({json:{totalUsers:9,newUsers:3,activeUsers:5,suspended:0,byPlan:{Free:4,Pro:3,Lifetime:2},planBreakdown:{Free:{accounts:4,paid:0,granted:0,trial:0},Pro:{accounts:3,paid:1,granted:1,trial:1},Lifetime:{accounts:2,paid:2,granted:0,trial:0}},revenueByPlan:{Pro:{USD:4000},Lifetime:{USD:20000}},revenue:{USD:{recurring:4000,lifetime:20000}},billingConfigured:true,jobs:[],deliveries:[],subscriptionStatuses:[],ai:[],activityDefinition:'Selected period.'}}));
 await page.goto('/admin');const card=page.locator('.panel,.card').filter({hasText:'Plans & revenue'}).first();await expect(card).toBeVisible();
 const row=(plan:string)=>card.locator('tbody tr').filter({hasText:plan});
 await expect(row('Pro')).toContainText('3');await expect(row('Pro').locator('td').nth(2)).toHaveText('1');await expect(row('Pro').locator('td').nth(3)).toHaveText('1');await expect(row('Pro').locator('td').nth(4)).toHaveText('1');await expect(row('Pro').locator('td').nth(5)).toHaveText('$40');
 await expect(row('Lifetime').locator('td').nth(5)).toHaveText('$200');await expect(card).toContainText('Trials and administrator grants are never revenue');
});
