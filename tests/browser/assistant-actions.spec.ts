import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
const actions=[{type:'create',kind:'task',data:{title:'Call the bank',description:'',due:'2026-10-09T12:00:00.000Z',priority:'medium',done:false,reminder:true,recurrence:'none'},label:'Add task "Call the bank" · due 2026-10-09'},{type:'link',path:'/finance/transactions',label:'Open Transactions'}];
async function setup(page:Page,history:unknown[]){
 const s=demoSnapshot();s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'fixture'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.route('**/backend/api/ai/status',r=>r.fulfill({json:{enabled:true,configured:true,usage:null}}));await page.route('**/backend/api/ai/history',r=>r.fulfill({json:{messages:history}}));
}
const message={id:'m1',question:'Add a task: call the bank tomorrow',answer:'I can add that for you.',month:'2026-09',createdAt:new Date().toISOString(),actions};

test('assistant proposals need an explicit confirmation and then use the normal save',async({page})=>{
 await setup(page,[message]);let saved:any;
 await page.route('**/backend/api/records',async r=>{saved=r.request().postDataJSON();await r.fulfill({status:201,json:{id:'t1',kind:'task',data:saved.data,version:1}});});
 await page.goto('/assistant');
 const card=page.locator('.ai-action');await expect(card).toContainText('Add task "Call the bank"');expect(saved).toBeUndefined();
 await expect(page.getByRole('link',{name:'Open Transactions'})).toHaveAttribute('href','/finance/transactions');
 await card.getByRole('button',{name:'Confirm'}).click();await expect(card.getByRole('button',{name:'Added'})).toBeDisabled();
 expect(saved).toMatchObject({kind:'task',data:{title:'Call the bank',priority:'medium'}});
 await page.reload();await expect(page.locator('.ai-action').getByRole('button',{name:'Added'})).toBeDisabled();
});

test('a plan limit on confirm is explained, not hidden, and nothing is marked as added',async({page})=>{
 await setup(page,[{...message,id:'m2'}]);
 await page.route('**/backend/api/records',r=>r.fulfill({status:403,json:{error:'Your plan allowance is reached. Existing records remain available.',code:'UPGRADE_REQUIRED'}}));
 await page.goto('/assistant');await page.locator('.ai-action').getByRole('button',{name:'Confirm'}).click();
 await expect(page.locator('.ai-action [role=alert]')).toContainText('plan allowance is reached');await expect(page.locator('.ai-action').getByRole('button',{name:'Confirm'})).toBeEnabled();
});

test('general help and command prompts are offered and send the general context',async({page})=>{
 await setup(page,[]);let body:any;await page.route('**/backend/api/ai/chat',r=>{body=r.request().postDataJSON();return r.fulfill({json:{message:{id:'m3',question:body.question,answer:'Open Transactions and choose Import CSV.',month:'2026-09',createdAt:new Date().toISOString(),actions:[{type:'link',path:'/finance/transactions',label:'Open Transactions'}]}}});});
 await page.goto('/assistant');await page.getByRole('button',{name:'How do I import my bank statement?'}).click();await expect(page.getByRole('combobox',{name:'Assistant context'})).toHaveValue('general');
 await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.ai-answer')).toContainText('Choose Import CSV');expect(body.intent).toBe('general');
 await expect(page.getByRole('link',{name:'Open Transactions'})).toBeVisible();
});
