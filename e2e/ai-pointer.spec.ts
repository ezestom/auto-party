import { test, expect, type Page } from '@playwright/test';
async function setup(page: Page, short=false) {
 await page.route('**/api/ai/status',r=>r.fulfill({json:{configured:true,authorized:true,model:'fixture'}}));
 await page.route('**/api/ai/setlist',async r=>{const {tracks}=r.request().postDataJSON();await r.fulfill({json:{source:'groq',model:'fixture',djComment:'Curated block',setlist:tracks.map((t:{id:string})=>({trackId:t.id,mixPoint:24,transitionStyle:'smooth'}))}});});
 await page.goto('/');
 await expect.poll(()=>page.evaluate(async()=> (await indexedDB.databases()).some(db=>db.name==='MixrDatabase' && (db.version||0)>=20))).toBe(true);
 await page.evaluate(async short=>{
  const rate=8000,duration=short?24:90,samples=rate*duration,buffer=new ArrayBuffer(44+samples*2),v=new DataView(buffer);
  const text=(offset:number,text:string)=>[...text].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);text(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples*2,true);
  for(let i=0;i<(short?rate*21:samples);i++)v.setInt16(44+i*2,Math.round(Math.sin(i*2*Math.PI*220/rate)*1500),true);
  await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('MixrDatabase');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('tracks','readwrite');tx.onerror=()=>{db.close();reject(tx.error);};for(const id of ['fixture-a','fixture-b','fixture-c'])tx.objectStore('tracks').put({id,title:id,artist:'Fixture',bpm:id==='fixture-c'?94:120,key:'—',duration,color:'#ff6b00',audioData:buffer.slice(0),peaks:[.1],detailPeaks:[.1],waveformVersion:1});tx.oncomplete=()=>{db.close();resolve();};};});
 },short);
 await page.reload();await page.getByRole('button',{name:'Party mode',exact:true}).click();
}

test('AI hand follows real preparation, yields immediately and resumes after inactivity', async ({page}) => {
 test.setTimeout(40000);
 await page.setViewportSize({width:1440,height:900}); await setup(page,true);
 await page.getByRole('button',{name:'Start party',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await page.getByRole('button',{name:'Manual console',exact:true}).click();
 const hand=page.locator('.ai-pointer'), drawer=page.getByRole('dialog',{name:'Media library'});
 await expect(hand).toBeVisible({timeout:10000}); await expect(hand).toContainText('AI');
 await expect(hand).toHaveCSS('pointer-events','none');
 await expect(drawer).toBeVisible();
 await expect(page.locator('[data-ai-track="fixture-b"]')).toBeVisible();
 await expect(page.locator('[data-ai-track="fixture-b"]')).toHaveClass(/ai-pointer-target/);
 await page.mouse.move(200,200); await expect(hand).toHaveCount(0);
 await page.waitForTimeout(1600); await expect(hand).toHaveCount(0);
 await expect(hand).toBeVisible({timeout:2500});
 await page.screenshot({path:'test-results/ai-hand-desktop.png'});
 // A held pointer retains control even after the inactivity timeout.
 await page.mouse.move(1000,840); await page.mouse.down(); await page.waitForTimeout(3300); await expect(hand).toHaveCount(0);
 await page.mouse.up();
 await drawer.getByRole('textbox',{name:'Search music',exact:true}).fill('fixture-c');
 await page.waitForTimeout(3300); await expect(hand).toHaveCount(0);
 await expect(page.locator('#play-btn-A')).toContainText('PAUSE');
});

test('AI hand preference persists and reduced motion suppresses the guide', async ({page}) => {
 await setup(page,true);
 await page.locator('#settings-btn').click();
 const settings=page.getByRole('dialog',{name:'Settings',exact:true});
 await settings.getByRole('tab',{name:'Auto-DJ',exact:true}).click();
 await settings.getByRole('switch',{name:'AI hand',exact:true}).uncheck();
 await page.reload(); await page.locator('#settings-btn').click();
 await page.getByRole('tab',{name:'Auto-DJ',exact:true}).click();
 await expect(page.getByRole('switch',{name:'AI hand',exact:true})).not.toBeChecked();
 await page.getByRole('switch',{name:'AI hand',exact:true}).check();
 await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.getByRole('button',{name:'Party mode',exact:true}).click();
 await page.getByRole('button',{name:'Start party',exact:true}).click();
 await page.waitForTimeout(6500);
 await expect(page.locator('.ai-pointer')).toHaveCount(0);
 await expect(page.getByRole('dialog',{name:'Media library'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Pause party',exact:true})).toBeVisible();
});

test('the guide retires and the audio transitions independently', async ({page}) => {
 test.setTimeout(40000);
 await page.setViewportSize({width:1440,height:900}); await setup(page,true); await page.bringToFront();
 await page.getByRole('button',{name:'Start party',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 const drawer=page.getByRole('dialog',{name:'Media library'});
 await expect(drawer).toBeVisible({timeout:10000});
 await expect(page.locator('[data-ai-track="fixture-b"]')).toHaveClass(/ai-pointer-target/);
 await page.screenshot({path:'test-results/ai-hand-preparing.png'});
 await expect(drawer).toHaveCount(0,{timeout:7000});
 await expect(page.locator('.ai-pointer')).toHaveCount(0,{timeout:3000});
 await expect(page.locator('.party-now h1')).toHaveText('fixture-b',{timeout:22000});
 await expect(page.getByRole('button',{name:'Pause party',exact:true})).toBeVisible();
});

for(const size of [{width:390,height:844},{width:844,height:390}]) test('AI hand fits and manual closing wins '+size.width, async ({page}) => {
 await page.setViewportSize(size); await setup(page,true);
 await page.bringToFront();
 await page.getByRole('button',{name:'Start party',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 const hand=page.locator('.ai-pointer'); await expect(hand).toBeVisible({timeout:10000});
 const drawer=page.getByRole('dialog',{name:'Media library'}); await expect(drawer).toBeVisible();
 const box=(await hand.boundingBox())!;
 expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(size.width);
 await page.screenshot({path:'test-results/ai-hand-'+size.width+'.png'});
 await drawer.getByRole('button',{name:'Close library',exact:true}).click();
 await page.waitForTimeout(3800); await expect(drawer).toHaveCount(0); await expect(hand).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
