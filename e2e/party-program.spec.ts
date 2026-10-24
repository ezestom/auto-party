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

async function seedThemes(page:Page, hand=false) {
 await page.evaluate(hand=>{
  localStorage.setItem('autoparty_blocks_v1',JSON.stringify([{id:'c',name:'Cumbia',trackIds:['fixture-a']},{id:'r',name:'Rock',trackIds:['fixture-b']},{id:'s',name:'Slow songs',trackIds:['fixture-c']}]));
  localStorage.setItem('eze_mix_settings',JSON.stringify({aiPointerEnabled:hand}));
 },hand);
 await page.reload();await page.bringToFront();
}

test('theme tabs create empty themes, assign existing songs and browse independently of playback',async({page})=>{
 await setup(page);await seedThemes(page);
 await page.locator('#library-toggle-btn').click();
 const library=page.getByRole('dialog',{name:'Media library',exact:true});
 await library.getByRole('button',{name:'New theme',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'New theme',exact:true});
 await editor.getByLabel('Theme name',{exact:true}).fill('DJ custom set');
 await editor.getByRole('button',{name:'Save theme',exact:true}).click();
 await expect(library.getByRole('tab',{name:'DJ custom set',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(library.locator('.library-song-row')).toHaveCount(0);
 await library.getByRole('button',{name:'Edit theme',exact:true}).click();
 await page.getByRole('checkbox',{name:'fixture-a',exact:true}).check();
 await page.getByRole('button',{name:'Save theme',exact:true}).click();
 await expect(library.locator('.library-song-row')).toHaveCount(1);
 await library.getByRole('tab',{name:'Rock',exact:true}).click();
 await expect(library.locator('.library-song-row')).toContainText('fixture-b');
 await library.getByRole('tab',{name:'Cumbia',exact:true}).focus();await page.keyboard.press('ArrowRight');
 await expect(library.getByRole('tab',{name:'Rock',exact:true})).toBeFocused();
 await page.reload();await page.locator('#library-toggle-btn').click();
 await expect(library.getByRole('tab',{name:'DJ custom set',exact:true})).toBeVisible();
});

test('one minute programme repeats its theme, advances naturally, and accepts a manual return without cutting',async({page})=>{
 test.setTimeout(115000);
 await setup(page,true);await seedThemes(page);
 await page.getByRole('button',{name:'Party mode',exact:true}).click();
 const program=page.getByRole('region',{name:'Party programme',exact:true});
 await program.locator('summary').click();
 await program.getByRole('button',{name:'Add stage',exact:true}).click();
 await program.getByLabel('Minutes for stage 1',{exact:true}).fill('1');await program.getByLabel('Minutes for stage 1',{exact:true}).blur();
 await program.getByRole('button',{name:'Add stage',exact:true}).click();
 await program.getByLabel('Theme for stage 2',{exact:true}).selectOption('r');
 await program.getByRole('checkbox',{name:'Use party programme',exact:true}).check();
 await page.reload();await page.getByRole('button',{name:'Party mode',exact:true}).click();
 await page.getByRole('button',{name:'Start party',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await expect(program).toContainText('Cumbia');
 await page.waitForTimeout(26000);
 await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await expect(page.getByRole('button',{name:'Pause party',exact:true})).toBeVisible();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-b',{timeout:55000});
 await expect(page.getByLabel('Musical block',{exact:true})).toHaveValue('r');
 await program.locator('summary').click();
 await expect(program.getByRole('button',{name:'Play stage 1 next',exact:true})).toBeEnabled({timeout:9000});
 await program.getByRole('button',{name:'Play stage 1 next',exact:true}).click();
 await expect(page.locator('.party-now h1')).toHaveText('fixture-b');
 await expect(page.getByText('Next theme: Cumbia · after this song',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Next song',exact:true}).click();
 await expect(page.getByLabel('Musical block',{exact:true})).toHaveValue('c');
 await page.screenshot({path:'test-results/party-program-running.png'});
});

for(const size of [{width:390,height:844},{width:844,height:390}])test('theme and programme editors fit '+size.width,async({page})=>{
 await page.setViewportSize(size);await setup(page);await seedThemes(page);
 await page.locator('#library-toggle-btn').click();
 const library=page.getByRole('dialog',{name:'Media library'});
 await library.getByRole('tab',{name:'Cumbia',exact:true}).click();
 await expect(library.getByRole('button',{name:'Play this theme next',exact:true})).toBeInViewport();
 await expect(library.getByTitle('Load to Deck A',{exact:true})).toBeInViewport();
 await library.getByRole('button',{name:'Edit theme',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save theme',exact:true})).toBeInViewport();
 await page.keyboard.press('Escape');await expect(library).toBeVisible();
 await library.getByRole('button',{name:'Close library',exact:true}).click();
 await page.getByRole('button',{name:'Party mode',exact:true}).click();
 const program=page.getByRole('region',{name:'Party programme',exact:true});await program.locator('summary').click();
 await program.getByRole('button',{name:'Add stage',exact:true}).click();
 await program.getByLabel('Minutes for stage 1',{exact:true}).fill('120');await program.getByLabel('Minutes for stage 1',{exact:true}).blur();
 await expect(program.getByRole('button',{name:'Remove stage 1',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/party-program-'+size.width+'.png'});
});

test('AI hand presses the real Play control when the engine starts the next deck',async({page})=>{
 test.setTimeout(40000);
 await page.setViewportSize({width:1440,height:900});await setup(page,true);
 await page.getByRole('button',{name:'Start party',exact:true}).click();await expect(page.locator('.party-now h1')).toHaveText('fixture-a');
 await page.getByRole('button',{name:'Manual console',exact:true}).click();
 await expect(page.locator('.ai-pointer[data-press=true]')).toBeVisible({timeout:30000});
 await expect(page.locator('#play-btn-B')).toContainText('PAUSE');
 await expect(page.locator('#play-btn-B')).toHaveClass(/ai-pointer-pressed/);
 await page.screenshot({path:'test-results/ai-hand-play.png'});
});
