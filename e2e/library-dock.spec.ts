import { test, expect } from '@playwright/test';
for(const size of [{width:1440,height:900},{width:1366,height:768},{width:844,height:390},{width:667,height:375},{width:390,height:844}]) test('library dock stays visible without covering deck controls at '+size.width+'x'+size.height,async({page})=>{
 await page.setViewportSize(size);await page.goto('/');
 const dock=page.getByRole('button',{name:'Open media library',exact:true});await expect(dock).toBeInViewport();
 const top=(await dock.boundingBox())!.y;
 for(const id of size.width>size.height?['A','B']:['A']) {
   await expect(page.locator('#play-btn-'+id)).toBeInViewport();
   const controls=page.locator('#console-panel-'+id+' .pad-btn');
   for(const pad of await controls.all()) { const bounds=(await pad.boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(top); }
 }
 if(size.width>size.height){const bpm=page.locator('.mixer-bpm');const bounds=(await bpm.boundingBox())!;const panel=(await page.locator('.mixer-center-panel').boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(Math.min(top,panel.y+panel.height)+1);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/library-dock-'+size.width+'.png',fullPage:true});
 await dock.click();await expect(page.getByRole('dialog',{name:'Media library'})).toBeVisible();
 await expect(page.locator('#library-toggle-btn')).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(dock).toBeFocused();
});
test('collapsed library dock opens by dragging upward and the header trigger still works',async({page})=>{
 await page.goto('/');const dock=page.getByRole('button',{name:'Open media library',exact:true});const box=(await dock.boundingBox())!;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-80,{steps:8});await page.mouse.up();
 await expect(page.getByRole('dialog',{name:'Media library'})).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('#library-toggle-btn').click();await expect(page.getByRole('dialog',{name:'Media library'})).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('#library-toggle-btn')).toBeFocused();
});

test('the same library header rises to half-screen and stays above the laser',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/');
 const panel=page.locator('#media-library-drawer'),handle=page.getByRole('button',{name:'Open media library',exact:true});
 await expect(handle).toBeInViewport();await handle.evaluate(el=>el.setAttribute('data-continuity-probe','same-header'));
 await expect(page.locator('.library-dock')).toHaveCount(0);
 const foreground=await handle.evaluate(el=>{const sheet=el.closest('#media-library-drawer')!,laser=document.querySelector('.console-shell > div.pointer-events-none')!;return {sheet:Number(getComputedStyle(sheet).zIndex),laser:Number(getComputedStyle(laser).zIndex),background:getComputedStyle(el).backgroundColor};});
 expect(foreground.sheet).toBeGreaterThan(foreground.laser);expect(foreground.background).toBe('rgb(32, 32, 46)');
 await handle.click();const openHandle=page.getByRole('button',{name:'Close library',exact:true});
 await expect(openHandle).toHaveAttribute('data-continuity-probe','same-header');
 await expect.poll(async()=> (await panel.boundingBox())!.y).toBeCloseTo(450,0);
 await expect(panel).toHaveCSS('height','450px');await expect(page.getByRole('button',{name:/Height 1\//})).toHaveCount(0);
 await page.keyboard.press('Shift+Tab');expect(await panel.evaluate(el=>el.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(handle).toHaveAttribute('data-continuity-probe','same-header');
 await expect(handle).toBeInViewport();await expect(page.locator('.console-shell')).not.toHaveAttribute('inert');
 await page.keyboard.press('Tab');expect(await page.locator('.library-drawer-body').evaluate(el=>el.contains(document.activeElement))).toBe(false);
 await page.screenshot({path:'test-results/library-one-sheet-closed.png',fullPage:true});
 await handle.click();await expect.poll(async()=> (await panel.boundingBox())!.y).toBeCloseTo(450,0);
 await page.screenshot({path:'test-results/library-one-sheet-open.png',fullPage:true});
});
