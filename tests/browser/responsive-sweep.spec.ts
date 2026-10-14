import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot} from '../../packages/shared/src/index';
const widths=[[360,740],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]] as const;
const routes=['/','/finance','/finance/budgets','/finance/income','/finance/transactions','/finance/calculators','/tasks','/fitness','/meals','/goals','/assistant','/reports','/plans','/help','/billing/success','/settings?tab=general','/settings?tab=notifications','/settings?tab=plan','/settings?tab=billing','/settings?tab=referrals','/settings?tab=data'];
async function mock(page:Page){
 const s=demoSnapshot();s.profile.plan='Pro';s.profile.onboardingCompletedAt='2026-09-01T00:00:00Z';(s as any).planDetails={source:'paid',expiresAt:null,trial:{available:false,used:false,endsAt:null},catalog:{},usage:{emails:0,aiRequests:0,aiTokens:0},aiAllowances:{}};
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:'Fixture',email:'f@example.com',status:'active'},csrf:'x'}}));
 await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.route('**/backend/api/ai/status',r=>r.fulfill({json:{enabled:true,configured:true,usage:{requests:3,allowance:{requests:100,tokens:100000},tokens:1200}}}));
 await page.route('**/backend/api/ai/history',r=>r.fulfill({json:{messages:[]}}));
 await page.route('**/backend/api/billing',r=>r.fulfill({json:{plan:'Pro',source:'paid',trial:{available:false,used:false,endsAt:null},accessUntil:null,paymentsConfigured:false,payments:[]}}));
 await page.route('**/backend/status',r=>r.fulfill({json:{maintenance:{enabled:false,message:'',until:null}}}));
}
// Anything wider than the viewport that is not inside an intentionally scrolling container (tables, tab strips) is a layout bug.
const overflow=()=>{
 const vw=document.documentElement.clientWidth;const bad:string[]=[];
 if(document.documentElement.scrollWidth>vw+1)bad.push(`page scrolls horizontally (${document.documentElement.scrollWidth}px > ${vw}px)`);
 const scrolls=(el:Element)=>{for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const o=getComputedStyle(p);if(/(auto|scroll|hidden|clip)/.test(o.overflowX)&&p.scrollWidth>p.clientWidth)return true;}return false;};
 for(const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))){
  const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;const style=getComputedStyle(el);if(style.visibility==='hidden'||style.display==='none'||style.position==='fixed'&&el.classList.contains('mobile-overlay'))continue;
  if((r.right>vw+1||r.left<-1)&&!scrolls(el)&&!el.closest('.tour-layer,.sr-only,.hold-button__sr,svg,.recharts-wrapper,.pa-confetti'))bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0,2).join('.')} [${Math.round(r.left)}..${Math.round(r.right)}] "${(el.textContent||'').trim().slice(0,30)}"`);
  if(bad.length>=5)break;
 }
 return bad;
};
for(const [width,height] of widths)test(`no horizontal overflow on any page at ${width}px`,async({page})=>{
 test.setTimeout(240000);await page.setViewportSize({width,height});await mock(page);const failures:string[]=[];
 for(const route of routes){await page.goto(route);await page.waitForLoadState('networkidle');await page.waitForTimeout(400);const bad=await page.evaluate(overflow);if(bad.length)failures.push(`${route}: ${bad.join(' | ')}`);}
 expect(failures,failures.join('\n')).toEqual([]);
});
for(const [width,height] of widths)test(`drawers and dialogs stay inside the viewport at ${width}px`,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height});await mock(page);const failures:string[]=[];
 const inside=async(name:string)=>{await page.waitForTimeout(700);const box=await page.getByRole('dialog').last().boundingBox();if(!box){failures.push(`${name}: no dialog`);return;}if(box.x<-1||box.x+box.width>width+1||box.y<-1||box.y+box.height>height+1)failures.push(`${name}: dialog ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)} outside ${width}x${height}`);const bad=await page.evaluate(overflow);if(bad.length)failures.push(`${name}: ${bad.join(' | ')}`);};
 await page.goto('/tasks');await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'New task',exact:true}).click();await inside('add task drawer');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Notifications,/}).click();await inside('notifications drawer');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Delete /}).first().click();await inside('delete dialog');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Quick add'}).first().click();await inside('quick add');await page.keyboard.press('Escape');
 await page.goto('/finance/transactions');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Import CSV'}).click();
 await page.getByRole('dialog').getByLabel('CSV file').setInputFiles({name:'bank.csv',mimeType:'text/csv',buffer:Buffer.from('Transaction Date;Narrative;Debit;Credit\n13/10/2026;Grocery Store;"1.234,56";\n')});await inside('csv import');
 expect(failures,failures.join('\n')).toEqual([]);
});
