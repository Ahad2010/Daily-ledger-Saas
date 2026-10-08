import {test,expect} from '@playwright/test';
test('optional 3D preserves exercise filters, controls and fallback',async({page})=>{
 test.setTimeout(180000); // Four viewport switches and context-loss recovery in software WebGL.
 const models:string[]=[];page.on('request',r=>{if(r.url().includes('/fitness/models/'))models.push(r.url());});
 const start=Date.now();await page.goto('/fitness');const guide=page.locator('.workout-guide');await expect(guide.getByRole('button',{name:'View in 3D'})).toBeVisible();console.log('Fitness ready ms',Date.now()-start);expect(models).toHaveLength(0);
 await guide.getByRole('textbox',{name:'Search exercises'}).fill('curl');await guide.locator('.muscle-buttons').getByRole('button',{name:'Biceps',exact:true}).click();
 const open=Date.now();await guide.getByRole('button',{name:'View in 3D'}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('canvas')).toBeVisible();await expect(dialog.locator('.anatomy-3d-label')).toHaveAttribute('data-ready','true',{timeout:90000});await expect(dialog.getByRole('alert')).toHaveCount(0);console.log('Viewer startup ms',Date.now()-open);
 await expect(dialog.locator('.anatomy-3d-label')).toHaveText('Biceps');const canvas=dialog.locator('canvas');const box=(await canvas.boundingBox())!;
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.55,{steps:20});await page.mouse.up();await expect(dialog.locator('.muscle-buttons button[aria-pressed=true]')).toHaveText('Biceps');
 for(const name of ['Front','Back','Reset view','Zoom in','Zoom out'])await dialog.locator('.anatomy-3d-toolbar').getByRole('button',{name,exact:true}).click();await page.screenshot({path:'artifacts/anatomy-3d-desktop.png'});
 await dialog.getByRole('button',{name:'Back to 2D',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(guide.getByRole('textbox',{name:'Search exercises'})).toHaveValue('curl');await expect(guide.locator('.exercise-muscle').first()).toHaveText('Biceps');
 await guide.getByRole('textbox',{name:'Search exercises'}).fill('');
 for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:800});await guide.getByRole('button',{name:'View in 3D'}).click();await expect(dialog.locator('canvas')).toBeVisible();await dialog.locator('.muscle-buttons').getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.locator('.anatomy-3d-label')).toHaveText('Back');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/anatomy-3d-${width}.png`});await dialog.getByRole('button',{name:'Close dialog'}).click();await expect(guide.locator('.exercise-muscle').first()).toHaveText('Back');}
 expect(models.filter(url=>new URL(url).pathname.endsWith('muscular.glb'))).toHaveLength(1);
 await guide.getByRole('button',{name:'View in 3D'}).click();await expect(dialog.locator('canvas')).toBeVisible();await dialog.locator('canvas').evaluate(canvas=>{const context=(canvas as HTMLCanvasElement).getContext('webgl2');context?.getExtension('WEBGL_lose_context')?.loseContext();});await expect(dialog.getByRole('alert')).toContainText('3D view paused');await dialog.getByRole('button',{name:'Use 2D view',exact:true}).click();await expect(guide.locator('.anatomy-view')).toBeVisible();
});
test('mobile touch rotates, pinches and deliberately selects visible muscles',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();
 await page.goto('/fitness');await page.getByRole('button',{name:'View in 3D'}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.anatomy-3d-label')).toHaveAttribute('data-ready','true',{timeout:90000});
 const canvas=dialog.locator('canvas'),box=(await canvas.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height*.3,cdp=await context.newCDPSession(page);const send=(type:string,points:{x:number;y:number;id:number}[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:2,radiusY:2,force:1}))});
 const before=await canvas.screenshot();await send('touchStart',[{x,y,id:1}]);await send('touchMove',[{x:x+50,y:y+10,id:1}]);await send('touchEnd',[]);await expect(dialog.locator('.muscle-buttons button[aria-pressed=true]')).toHaveText('Full body');await expect.poll(async()=>!(await canvas.screenshot()).equals(before)).toBe(true);
 const rotated=await canvas.screenshot();await send('touchStart',[{x:x-25,y,id:1},{x:x+25,y,id:2}]);await send('touchMove',[{x:x-65,y,id:1},{x:x+65,y,id:2}]);await send('touchEnd',[]);await expect(dialog.locator('.muscle-buttons button[aria-pressed=true]')).toHaveText('Full body');await expect.poll(async()=>!(await canvas.screenshot()).equals(rotated)).toBe(true);
 await dialog.locator('.anatomy-3d-toolbar').getByRole('button',{name:'Reset view'}).click();
 // Raycast hover finds a named superficial chest mesh; actual tap must select it.
 let target:{x:number;y:number}|undefined;
 for(const px of [.46,.48,.52,.54]){for(const py of [.24,.27,.3,.33]){const pos={x:box.x+box.width*px,y:box.y+box.height*py};await page.mouse.move(pos.x,pos.y);if(await dialog.locator('.anatomy-3d-label').textContent()==='Chest'){target=pos;break;}}if(target)break;}
 expect(target).toBeDefined();await page.touchscreen.tap(target!.x,target!.y);await expect(dialog.locator('.muscle-buttons button[aria-pressed=true]')).toHaveText('Chest');await dialog.getByRole('button',{name:'Close dialog'}).click();await expect(page.locator('.exercise-muscle').first()).toHaveText('Chest');
 const prior=await page.evaluate(()=>scrollY);await page.mouse.move(350,650);await page.mouse.wheel(0,-900);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(prior);await context.close();
});
test('model failure leaves 2D available',async({page})=>{
 let requests=0;await page.route('**/fitness/models/muscular.glb*',route=>++requests===1?route.abort():route.continue());await page.goto('/fitness');await page.getByRole('button',{name:'View in 3D'}).click();await expect(page.getByRole('alert')).toContainText('3D is unavailable',{timeout:90000});await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.locator('.anatomy-3d-label')).toHaveAttribute('data-ready','true',{timeout:90000});expect(requests).toBe(2);await page.getByRole('button',{name:'Back to 2D'}).click();await expect(page.locator('.anatomy-view')).toBeVisible();
});
test('unsupported WebGL keeps keyboard selection and 2D fallback available',async({page})=>{
 await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind:string,...args:any[]){return kind.startsWith('webgl')?null:get.call(this,kind as any,...args);} as typeof get;});
 await page.goto('/fitness');await page.getByRole('button',{name:'View in 3D'}).click();await expect(page.getByRole('alert')).toContainText('3D is unavailable');await page.getByRole('dialog').locator('.muscle-buttons').getByRole('button',{name:'Chest',exact:true}).press('Enter');await page.getByRole('button',{name:'Use 2D view'}).click();await expect(page.locator('.exercise-muscle').first()).toHaveText('Chest');
});
test('exercise detail keeps an explored muscle when returning to 2D',async({page})=>{
 await page.goto('/fitness/exercises/incline-push-up');await page.getByRole('button',{name:'View in 3D'}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('.anatomy-3d-label')).toHaveAttribute('data-ready','true',{timeout:90000});await dialog.locator('.muscle-buttons').getByRole('button',{name:'Back',exact:true}).press('Enter');await dialog.getByRole('button',{name:'Back to 2D'}).click();await expect(page.locator('.anatomy-focus')).toHaveText('Back');await expect(page.locator('.anatomy-view')).toHaveClass(/anatomy-back/);await expect(page.locator('.anatomy-overlay path')).toHaveAttribute('data-muscle','Back');
});






test('3D loading and repeated closing do not synchronously unmount another React root',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/fitness/models/muscular.glb*',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
 await page.goto('/fitness');await page.getByRole('button',{name:'View in 3D'}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('canvas')).toBeVisible();await dialog.getByRole('button',{name:'Back to 2D',exact:true}).click();
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'View in 3D'}).click();await expect(dialog.locator('.anatomy-3d-label')).toHaveAttribute('data-ready','true',{timeout:90000});if(i===1)await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:'Back to 2D',exact:true}).click();await expect(dialog).toHaveCount(0);}
 expect(errors.filter(error=>/synchronously unmount|React was already rendering|race condition/i.test(error))).toEqual([]);
});
