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
test('curated blocks persist and a DJ request overrides the block without interrupting playback',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await setup(page);
 await page.getByRole('button',{name:'Create theme',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Cumbia');
 await page.getByRole('checkbox',{name:'fixture-a',exact:true}).check();await page.getByRole('checkbox',{name:'fixture-b',exact:true}).check();
 await page.getByRole('button',{name:'Save theme',exact:true}).click();
 await expect(page.getByLabel('Musical block',{exact:true})).toContainText('Cumbia · 2 songs');
 await page.getByRole('button',{name:'Start party',exact:true}).click();await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await page.locator('#library-toggle-btn').click();const drawer=page.getByRole('dialog',{name:'Media library'});
 await drawer.getByRole('tab',{name:'All music',exact:true}).click();
 await drawer.getByRole('button',{name:'Play next: fixture-c',exact:true}).click();
 await drawer.getByRole('textbox',{name:'Search music',exact:true}).fill('fixture-c');
 await page.getByRole('button',{name:'Close library',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await expect(page.locator('.party-queue ol li').first()).toContainText('fixture-c');
 await expect(page.locator('.party-queue ol li').first()).toContainText('DJ request');
 await page.getByRole('button',{name:'Next song',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-c',{timeout:10000});
 await expect(page.locator('.party-queue ol li').first()).toContainText('fixture-b');
 await page.getByRole('button',{name:'Manual console',exact:true}).click();
 await page.locator('#play-btn-B').click();await expect(page.getByRole('button',{name:'Resume Auto-DJ',exact:true})).toBeVisible();
 await page.locator('#play-btn-B').click();await page.locator('.mixer-center-panel').getByRole('slider',{name:'Fader',exact:true}).press('End');await page.getByRole('button',{name:'Resume Auto-DJ',exact:true}).click();
 await expect(page.locator('#ai-autodj-btn')).toContainText('GROQ ON');
 await page.reload();await page.getByRole('button',{name:'Party mode',exact:true}).click();
 await expect(page.getByLabel('Musical block',{exact:true})).toContainText('Cumbia · 2 songs');
});
test('natural transitions use the audible ending and prepare the next deck silently',async({page})=>{
 test.setTimeout(45000);
 await setup(page,true);await page.getByRole('button',{name:'Start party',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await page.getByRole('button',{name:'Manual console',exact:true}).click();
 await expect(page.locator('#play-btn-B')).toContainText('PLAY');
 await expect(page.locator('#play-btn-B')).toContainText('PAUSE',{timeout:30000});
 await expect(page.locator('#play-btn-A')).toContainText('PLAY',{timeout:8000});
});
for(const size of [{width:390,height:844},{width:844,height:390}]) test('block editor fits '+size.width+'x'+size.height,async({page})=>{
 await page.setViewportSize(size);await setup(page);
 await page.getByRole('button',{name:'Create theme',exact:true}).click();await page.getByLabel('Theme name',{exact:true}).fill('Classics');
 await expect(page.getByRole('button',{name:'Save theme',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/party-blocks-'+size.width+'.png',fullPage:true});
});

test('a permitted Groq effect reaches the engine and can be cancelled without stopping the party',async({page})=>{
 await setup(page);
 await page.route('**/api/ai/setlist',async route=>{const {tracks}=route.request().postDataJSON();await route.fulfill({json:{source:'groq',model:'fixture',djComment:'Subtle filter',setlist:tracks.map((t:{id:string},i:number)=>({trackId:t.id,mixPoint:8,transitionStyle:'smooth',effect:i===0?'filter_sweep':'none'}))}});});
 await page.getByRole('button',{name:'Start party',exact:true}).click();await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await expect(page.getByText('Audio Engine Playing',{exact:true})).toBeVisible();
 await page.locator('.party-fx-details summary').click();
 await page.getByRole('button',{name:'Next song',exact:true}).click();
 await expect(page.getByText('Filter sweep is active.',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Transition effects',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Cancel effect',exact:true}).click();
 await expect(page.getByText('Simple fade is always the fallback.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Pause party',exact:true})).toBeVisible();
});
test('a one-shot echo returns to auto and Off remains selected for later transitions',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Start party',exact:true}).click();await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await page.locator('.party-fx-details summary').click();const select=page.getByLabel('Transition effects',{exact:true});
 await select.selectOption('echo_out');await page.getByRole('button',{name:'Next song',exact:true}).click();
 await expect(page.getByText('Echo out is active.',{exact:true})).toBeVisible();
 await expect(select).toHaveValue('auto');await expect(select).toBeEnabled({timeout:6000});
 await select.selectOption('none');await page.getByRole('button',{name:'Next song',exact:true}).click();
 await expect(select).toHaveValue('none');
 await expect(page.getByText('Simple fade is always the fallback.',{exact:true})).toBeVisible();
});

test('Off transition effects persist across reload and reset with preferences',async({page})=>{
 await setup(page);await page.locator('.party-fx-details summary').click();await page.getByLabel('Transition effects',{exact:true}).selectOption('none');
 await page.reload();await page.getByRole('button',{name:'Party mode',exact:true}).click();await page.locator('.party-fx-details summary').click();
 await expect(page.getByLabel('Transition effects',{exact:true})).toHaveValue('none');
 await page.locator('#settings-btn').click();const dialog=page.getByRole('dialog',{name:'Settings',exact:true});
 await dialog.getByRole('tab',{name:'Auto-DJ',exact:true}).click();await dialog.getByRole('button',{name:'Reset preferences',exact:true}).click();
 await expect(dialog.getByLabel('Transition effects',{exact:true})).toHaveValue('auto');
});
