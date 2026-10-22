import { test, expect } from '@playwright/test';
test.beforeEach(async ({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.addInitScript(()=>{
   const audit=window as unknown as {auditSources:AudioBufferSourceNode[];auditAnalysers:AnalyserNode[]};
   audit.auditSources=[];audit.auditAnalysers=[];
   const original=AudioContext.prototype.createBufferSource;
   AudioContext.prototype.createBufferSource=function(){const node=original.call(this);audit.auditSources.push(node);return node;};
   const createAnalyser=AudioContext.prototype.createAnalyser;
   AudioContext.prototype.createAnalyser=function(){const node=createAnalyser.call(this);audit.auditAnalysers.push(node);return node;};
 });
 await page.goto('/');await expect(page.locator('#library-bottom-panel')).toBeVisible();
 await page.waitForFunction(async()=>(await indexedDB.databases()).some(d=>d.name==='MixrDatabase' && (d.version??0)>=20));
  await page.evaluate(async () => {
    const sampleRate = 8000, samples = sampleRate * 40;
    const buffer = new ArrayBuffer(44 + samples * 2), view = new DataView(buffer);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(Math.sin(i * 2 * Math.PI * 220 / sampleRate) * 600), true);
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("MixrDatabase");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("tracks", "readwrite");
        for (const id of ["safety-one", "safety-two"]) transaction.objectStore("tracks").put({
          id, title: id, artist: "Test fixture", bpm: id === "safety-one" ? 120 : 124, key: "—", duration: 40,
          color: "#ff6b00", audioData: buffer.slice(0), peaks: Array(800).fill(0.1),
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => { database.close(); reject(transaction.error); };
      };
    });
  });

 await page.reload();await page.getByTitle('Load to Deck A',{exact:true}).first().click();
 await expect(page.locator('main').getByText('safety-one',{exact:true}).first()).toBeVisible();
});
test('only working pad modes and audio controls are exposed',async({page})=>{
 for(const id of ['#keylock-btn-A','#keylock-btn-B'])await expect(page.locator(id)).toHaveCount(0);
 for(const name of ['Quantize','REVERB','ROLL','SLICER','BEAT JMP'])await expect(page.getByRole('button',{name,exact:true})).toHaveCount(0);
 await expect(page.locator('.deck-panel').first().getByRole('button',{name:'LOOP',exact:true})).toBeVisible();
});
test('saving cue preserves current location and CUE returns there with keyboard',async({page})=>{
 await page.locator('#play-btn-A').click();await page.waitForTimeout(1300);
 await page.locator('#save-cue-btn-A').click();
 await expect(page.locator('#play-btn-A')).toContainText('PLAY');
 await page.locator('#play-btn-A').click();await page.waitForTimeout(1100);
 await page.locator('#cue-btn-A').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#play-btn-A')).toContainText('PLAY');
 await expect(page.locator('.deck-panel').first().getByText('0:00',{exact:true})).toHaveCount(0);
});
test('jog release restores the selected tempo',async({page})=>{
 const deck=page.locator('.deck-panel').first();await page.locator('#play-btn-A').click();
 const tempo=deck.getByRole('slider',{name:'Tempo',exact:true});await tempo.focus();await tempo.press('End');
 const rate=()=>page.evaluate(()=>(window as unknown as {auditSources:AudioBufferSourceNode[]}).auditSources.at(-1)?.playbackRate.value);
 await expect.poll(rate).toBeCloseTo(1.16,3);
 const box=await deck.locator('svg').filter({has:page.locator('circle')}).first().boundingBox();if(!box)throw Error('missing jog');
 await page.mouse.move(box.x+box.width*.75,box.y+box.height*.5);await page.mouse.down();await page.mouse.up();await page.waitForTimeout(250);
 await expect.poll(rate).toBeCloseTo(1.16,3);
});

test('automatic fade completes and preserves manual EQ with Smart EQ off',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const deck=page.locator('.deck-panel').first();const hi=deck.getByRole('slider',{name:'Hi',exact:true});await hi.focus();await hi.press('Home');
 await page.getByRole('button',{name:'SMART EQ',exact:true}).click();
 await page.getByRole('button',{name:'AUTO B ▶',exact:true}).click();
 await expect(page.locator('.mixer-center-panel').getByRole('slider',{name:'Fader',exact:true})).toHaveAttribute('aria-valuenow','1',{timeout:7000});
 await expect(hi).toHaveAttribute('aria-valuenow','0');expect(errors).toEqual([]);
});
test('new projector shows the selected video and clears it on delete',async({page})=>{
 const sourceWarnings:string[]=[];
 page.on('console',message=>{if(message.text().includes('empty string'))sourceWarnings.push(message.text());});
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const r=indexedDB.open('MixrDatabase');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('videos','readwrite');for(const [id,title]of [['audit-a','AUDIT A'],['audit-z','AUDIT Z']])tx.objectStore('videos').put({id,title,category:'CUSTOM VJ',duration:1,url:'',color:'#00d4ff'});tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};r.onerror=()=>reject(r.error)}));
 await page.reload();await page.getByText('AUDIT A',{exact:true}).last().click();
 await expect(page.locator('video[src=""]')).toHaveCount(0);
 const opened=page.waitForEvent('popup');await page.getByTitle('Open VJ Display Window for Monitor 2 Projector/TV',{exact:true}).click();const projector=await opened;
 await expect(projector.getByText('AUDIT A',{exact:true})).toBeVisible();
 const a=page.getByTitle('Delete VJ Video',{exact:true}).first();await a.click({force:true});
 await expect(projector.getByText('AUDIT Z',{exact:true})).toBeVisible();
 await page.getByTitle('Delete VJ Video',{exact:true}).first().click({force:true});
 await expect(projector.getByText('STANDBY — NO VIDEO LOADED',{exact:true})).toBeVisible();await projector.close();
 expect(sourceWarnings).toEqual([]);
});

test('EQ describes real dB and filter uses frequency units',async({page})=>{
 const deck=page.locator('.deck-panel').first();
 await expect(deck.getByRole('slider',{name:'Hi',exact:true})).toHaveAttribute('aria-valuetext','0 dB');
 await expect(deck.getByRole('slider',{name:'Filter',exact:true})).toHaveAttribute('aria-valuetext','OFF');
});

test('visual analyser follows actual output and becomes silent when master is muted',async({page})=>{
 const energy=()=>page.evaluate(()=>{
   const analyser=(window as unknown as {auditAnalysers:AnalyserNode[]}).auditAnalysers[0];
   if(!analyser)return 0;
   const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
   return Math.sqrt(samples.reduce((sum,sample)=>sum+sample*sample,0)/samples.length);
 });
 await page.locator('#play-btn-A').click();
 await expect.poll(energy).toBeGreaterThan(0.001);
 const master=page.getByRole('slider',{name:'Mst',exact:true});await master.focus();await master.press('Home');
 await expect.poll(energy).toBeLessThan(0.00001);
 await master.press('End');await expect.poll(energy).toBeGreaterThan(0.001);
 await page.locator('#play-btn-A').click();await expect.poll(energy).toBeLessThan(0.00001);
});
test('party view starts locally, pauses safely and fits a phone',async({page})=>{
 await page.route('https://generativelanguage.googleapis.com/**',r=>r.abort());
 await page.getByRole('button',{name:'Modo Fiesta',exact:true}).click();
 await expect(page.getByRole('region',{name:'Modo Fiesta',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Iniciar fiesta',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pausar fiesta',exact:true})).toBeVisible();
 await expect(page.getByRole('status')).toContainText('Automático activo');
 await page.getByRole('button',{name:'Pausar fiesta',exact:true}).click();
 await expect(page.getByRole('button',{name:'Iniciar fiesta',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/party-phone.png',fullPage:true});
 await page.getByRole('button',{name:'Consola manual',exact:true}).click();
 await expect(page.locator('#play-btn-A')).toBeVisible();
});
