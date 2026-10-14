import {test,expect,type Page} from '@playwright/test';
import {demoSnapshot,type Snapshot} from '../../packages/shared/src/index';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=','base64');
function fixture():Snapshot{const s=demoSnapshot();s.profile={...s.profile,name:'Avatar Fixture',email:'avatar@example.com',plan:'Pro',onboardingCompletedAt:'2026-09-01T00:00:00Z',avatarUrl:null};return s;}
async function mock(page:Page,s:Snapshot,configured:boolean){
 await page.route('**/backend/auth/me',r=>r.fulfill({json:{user:{name:s.profile.name,email:s.profile.email,status:'active'},csrf:'fixture'}}));await page.route('**/backend/api/snapshot',r=>r.fulfill({json:s}));
 await page.route('**/backend/api/profile/avatar',async r=>{const method=r.request().method();if(method==='GET')return r.fulfill({json:{configured,avatarUrl:s.profile.avatarUrl}});if(method==='PUT'){s.profile.avatarUrl=r.request().postDataJSON().url;return r.fulfill({json:{avatarUrl:s.profile.avatarUrl}});}if(method==='DELETE'){s.profile.avatarUrl=null;return r.fulfill({status:204,body:''});}return r.fallback();});
}
test('profile photo: signed direct upload, saved URL shown in the shell, and removal',async({page})=>{
 const s=fixture();await mock(page,s,true);let uploadBody='';
 await page.route('**/backend/api/profile/avatar/sign',r=>r.fulfill({status:200,json:{apiKey:'123456',timestamp:1700000000,signature:'sig-fixture',public_id:'daily-ledger/avatars/u-0a1b2c3d',allowed_formats:'jpg,png,webp',transformation:'c_fill,g_auto,h_256,w_256',uploadUrl:'https://api.cloudinary.com/v1_1/democloud/image/upload'}}));
 await page.route('https://api.cloudinary.com/**',r=>{uploadBody=r.request().postData()||'';return r.fulfill({json:{secure_url:'https://res.cloudinary.com/democloud/image/upload/v1/daily-ledger/avatars/u-0a1b2c3d.png',public_id:'daily-ledger/avatars/u-0a1b2c3d'}});});
 await page.route('https://res.cloudinary.com/**',r=>r.fulfill({contentType:'image/png',body:png}));
 await page.goto('/settings');const box=page.locator('.avatar-upload');await expect(box).toContainText('Profile photo');await expect(page.locator('.sidebar-profile .avatar')).toHaveText('AF');
 await box.getByLabel('Profile photo file').setInputFiles({name:'me.png',mimeType:'image/png',buffer:png});
 await expect(box.getByRole('status')).toHaveText('Profile photo updated.');
 expect(uploadBody).toContain('name="signature"');expect(uploadBody).toContain('sig-fixture');expect(uploadBody).toContain('name="allowed_formats"');expect(uploadBody).not.toMatch(/secret/i);
 await expect(page.locator('.sidebar-profile .avatar img')).toHaveAttribute('src','https://res.cloudinary.com/democloud/image/upload/v1/daily-ledger/avatars/u-0a1b2c3d.png');
 await box.getByRole('button',{name:'Remove'}).click();await expect(page.locator('.sidebar-profile .avatar img')).toHaveCount(0);await expect(page.locator('.sidebar-profile .avatar')).toHaveText('AF');
});
test('profile photo: unsupported or oversized files are rejected before any upload; hidden when not configured',async({page})=>{
 const s=fixture();await mock(page,s,true);let signed=0;await page.route('**/backend/api/profile/avatar/sign',r=>{signed++;return r.fulfill({status:500,json:{error:'no'}});});
 await page.goto('/settings');const box=page.locator('.avatar-upload');
 await box.getByLabel('Profile photo file').setInputFiles({name:'a.gif',mimeType:'image/gif',buffer:png});await expect(box.getByRole('status')).toHaveText('Choose a JPG, PNG or WebP image.');
 await box.getByLabel('Profile photo file').setInputFiles({name:'big.png',mimeType:'image/png',buffer:Buffer.alloc(3*1024*1024+1)});await expect(box.getByRole('status')).toHaveText('Choose an image under 3 MB.');expect(signed).toBe(0);
});
test('profile photo controls stay hidden until Cloudinary is configured',async({page})=>{
 const s=fixture();await mock(page,s,false);await page.goto('/settings');await expect(page.locator('.plan-summary')).toBeVisible();await expect(page.locator('.avatar-upload')).toHaveCount(0);
});
