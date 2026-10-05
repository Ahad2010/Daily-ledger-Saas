import { chromium,expect } from '@playwright/test';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(const route of ['','finance','tasks','fitness','meals','goals','reports','settings','help']){
   await page.goto('http://localhost:3000/'+route);
   await page.locator('.sidebar-profile strong').waitFor();
   await page.locator('.panel').first().waitFor();if(route==='')await expect(page.locator('.metric-content strong').first()).toHaveText('$4,000');
   await page.locator('.panel').first().evaluate(el=>new Promise(resolve=>{const check=()=>getComputedStyle(el).opacity==='1'?resolve(true):requestAnimationFrame(check);check();}));
   await page.screenshot({path:`artifacts/review-${route||'dashboard'}-${width}.png`,fullPage:route!=='finance'});
   console.log(`${route||'dashboard'} ${width}: ${await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)?'fits':'OVERFLOW'}`);
  }
 }
}finally{await browser.close();}
