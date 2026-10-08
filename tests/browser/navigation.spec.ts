import {test,expect} from '@playwright/test';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parse} from 'dotenv';
import signature from 'cookie-signature';

test('auth routes exist and unknown routes show only 404',async({page})=>{
 for(const [path,heading] of [['/login','Log in to Daily Ledger'],['/signup','Create your Daily Ledger account'],['/admin/login','Log in to Daily Ledger Admin']]){
  expect((await page.goto(path))!.status(),path).toBe(200);
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
 }
 for(const path of ['/unknown-page','/admin/unknown-page']){
  expect((await page.goto(path))!.status()).toBe(404);
  await expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible();
  await expect(page.locator('.sidebar')).toHaveCount(0);
 }
});

test('customer navigation retains the shell, query data and document',async({page})=>{
 let documents=0,snapshots=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++;if(r.url().includes('/api/snapshot'))snapshots++;});
 await page.goto('/');await expect(page.locator('.sidebar')).toBeVisible();
 await page.evaluate(()=>{(window as any).__shell=document.querySelector('.sidebar');(window as any).__loaders=0;new MutationObserver(entries=>entries.forEach(e=>e.addedNodes.forEach(n=>{if(n instanceof Element&&(n.matches('.account-loading')||n.querySelector('.account-loading')))(window as any).__loaders++;}))).observe(document.body,{childList:true,subtree:true});});
 const initialSnapshots=snapshots;
 for(const [path,label] of [['/tasks','Tasks & Habits'],['/finance','Financial Planner'],['/fitness','Fitness'],['/meals','Meals & Grocery'],['/goals','Life Goals'],['/assistant','AI Assistant'],['/reports','Monthly Reports'],['/settings','Settings'],['/help','Help'],['/','Overview']]){
  await page.locator('.sidebar').getByRole('link',{name:label,exact:true}).click();await expect(page).toHaveURL(new RegExp(`${path==='/'?'/':path}$`));
  await expect(page.locator('.page-heading h1')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__shell===document.querySelector('.sidebar')),path).toBe(true);
 }
 expect(documents).toBe(1);expect(snapshots).toBe(initialSnapshots);expect(await page.evaluate(()=>(window as any).__loaders)).toBe(0);
});

test('selected administrator routes retain the shell and document',async({page})=>{
 test.skip(!process.env.TEST_DATABASE_URL,'Local database required');
 const env=parse(readFileSync('apps/api/.env'));const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});const sid=randomUUID();
 try{
  const admin=(await pool.query('SELECT "userId",version FROM "AdminAccess" WHERE id=1 AND active=true')).rows[0];test.skip(!admin,'Selected administrator required');
  await pool.query("INSERT INTO session (sid,sess,expire) VALUES ($1,$2,NOW()+INTERVAL '1 hour')",[sid,JSON.stringify({cookie:{originalMaxAge:3600000,httpOnly:true,secure:false,sameSite:'lax',path:'/'},passport:{user:admin.userId},csrf:randomUUID(),adminUserId:admin.userId,adminVersion:admin.version})]);
  await page.context().addCookies([{name:'ledger.sid',value:'s:'+signature.sign(sid,process.env.TEST_SESSION_SECRET||env.SESSION_SECRET),domain:'localhost',path:'/',httpOnly:true,sameSite:'Lax'}]);
  let documents=0;page.on('request',r=>{if(r.isNavigationRequest()&&r.frame()===page.mainFrame())documents++;});
  expect((await page.goto('/admin'))!.status()).toBe(200);await expect(page.locator('.admin-metrics')).toBeVisible();await page.evaluate(()=>(window as any).__shell=document.querySelector('.sidebar'));
  for(const [path,label] of [['users','Users'],['plans','Plans & Subscriptions'],['support','Customer Support'],['announcements','Announcements'],['settings','Platform Settings'],['','Overview']]){
   await page.locator('.sidebar').getByRole('link',{name:label,exact:true}).click();await expect(page).toHaveURL(`${process.env.WEB_TEST_URL||'http://localhost:3000'}/admin${path?'/'+path:''}`);
   await expect(page.locator('.page-heading h1')).toBeVisible();await expect(page.locator('.admin-main .error')).toHaveCount(0);
   expect(await page.evaluate(()=>(window as any).__shell===document.querySelector('.sidebar'))).toBe(true);
  }
  expect(documents).toBe(1);
 }finally{await pool.query('DELETE FROM session WHERE sid=$1',[sid]);await pool.end();}
});

test('saved progress interpolates from its current value and reduced motion settles immediately',async({page})=>{
 await page.goto('/goals');const goal=page.locator('.two-grid .panel').filter({has:page.getByRole('heading',{name:'Emergency fund',exact:true})});
 const fill=goal.locator('.progress>div');await expect(fill).toHaveCSS('width',/px$/);
 await expect.poll(()=>fill.evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBe(60);
 await fill.evaluate(el=>{(window as any).__widths=[];new MutationObserver(()=>{(window as any).__widths.push(parseFloat((el as HTMLElement).style.width));}).observe(el,{attributes:true,attributeFilter:['style']});});
 await goal.getByRole('button',{name:'Edit Emergency fund',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Current value',{exact:true}).fill('4000');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect.poll(()=>fill.evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBe(80);
 const widths=await page.evaluate(()=>(window as any).__widths as number[]);expect(widths.length).toBeGreaterThan(2);expect(Math.min(...widths)).toBeGreaterThanOrEqual(59.9);expect(widths.some(v=>v>60&&v<80)).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});await goal.getByRole('button',{name:'Edit Emergency fund',exact:true}).click();await dialog.getByLabel('Current value',{exact:true}).fill('3500');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toHaveCount(0);await expect.poll(()=>fill.evaluate(el=>parseFloat((el as HTMLElement).style.width))).toBe(70);
 await page.screenshot({path:'artifacts/animated-goals.png',fullPage:true});
});


