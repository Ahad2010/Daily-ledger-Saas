import type {Page} from '@playwright/test';
// Presses and holds a HoldButton with the mouse for longer than its hold time, then releases.
export async function holdToConfirm(page:Page,name:RegExp|string,ms=1700){
 const button=page.getByRole('button',{name}).first();await button.hover();await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();
}
