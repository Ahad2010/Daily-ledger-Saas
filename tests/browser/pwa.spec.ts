import {test,expect} from '@playwright/test';

test('web app manifest, icons and mobile metadata make Daily Ledger installable',async({page,request})=>{
 await page.goto('/login');
 await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href',/manifest\.webmanifest/);
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#080808');
 await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href',/apple-touch-icon\.png/);
 const manifest=await (await request.get('/manifest.webmanifest')).json();
 expect(manifest).toMatchObject({name:'Daily Ledger',display:'standalone',start_url:'/',scope:'/',background_color:'#080808'});
 const sizes=manifest.icons.map((i:{sizes:string;purpose:string})=>`${i.sizes}:${i.purpose}`);expect(sizes).toEqual(expect.arrayContaining(['192x192:any','512x512:any','512x512:maskable']));
 for(const icon of manifest.icons){const response=await request.get(icon.src);expect(response.status()).toBe(200);expect(response.headers()['content-type']).toContain('image/png');expect(response.headers()['cache-control']).toContain('max-age=2592000');}
});

test('Settings offers the browser install prompt when the browser supports it',async({page})=>{
 await page.addInitScript(()=>{(window as unknown as {__fire:()=>void}).__fire=()=>{const e=new Event('beforeinstallprompt') as Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};e.prompt=()=>{(window as unknown as {__prompted:boolean}).__prompted=true;return Promise.resolve();};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e);};});
 await page.goto('/settings');await expect(page.locator('.plan-summary')).toBeVisible();await expect(page.locator('.install-app')).toHaveCount(0);
 await page.evaluate(()=>(window as unknown as {__fire:()=>void}).__fire());
 await expect(page.locator('.install-app')).toContainText('Install Daily Ledger');await page.getByRole('button',{name:'Install app'}).click();
 await expect(page.locator('.install-app')).toContainText('was added to your device');expect(await page.evaluate(()=>(window as unknown as {__prompted?:boolean}).__prompted)).toBe(true);
});

test('iPhone Safari gets the manual Add to Home Screen instructions',async({browser})=>{
 const context=await browser.newContext({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',viewport:{width:390,height:844}});
 const page=await context.newPage();await page.goto('/settings');await expect(page.locator('.install-app')).toContainText('Add to Home Screen');await context.close();
});
