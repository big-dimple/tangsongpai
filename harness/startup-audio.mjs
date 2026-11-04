/** Real Chromium startup, audio lifecycle and first tutorial inputs. No synthetic game commands. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out='shots/startup-audio';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:'/tmp/tangsongpai-startup-vite',optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port:5630,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.STARTUP_CHROMIUM??(process.platform==='win32'?undefined:'/usr/bin/chromium'),args:['--no-sandbox','--disable-gpu']});
const report={browser:browser.version(),scope:'Chromium software rendering and emulated touch; audio states and scheduled sources observed, not human listening or physical-device acceptance.',cases:[]};
const url='http://127.0.0.1:5630/?harness=1&seed=startup-check';
const ready=page=>page.waitForFunction(()=>window.__harness?.game.scene.isActive('title'),null,{timeout:20000});
async function instrument(context){
 await context.addInitScript(()=>{
  window.__startup={events:[],contexts:[],media:[],frames:[]};const log=(type,more={})=>window.__startup.events.push({type,t:performance.now(),...more});
  const OriginalContext=window.AudioContext;
  window.AudioContext=class extends OriginalContext{constructor(...args){super(...args);window.__startup.contexts.push(this);log('context',{state:this.state});}};
  const decode=OriginalContext.prototype.decodeAudioData;
  OriginalContext.prototype.decodeAudioData=function(...args){const ctx=this;log('decode-start',{state:ctx.state});const p=decode.apply(this,args);p.then(buffer=>log('decode-ready',{state:ctx.state,duration:buffer.duration}),()=>log('decode-error'));return p;};
  const resume=OriginalContext.prototype.resume;
  OriginalContext.prototype.resume=function(...args){log('resume-call',{state:this.state});const p=resume.apply(this,args);p.then(()=>log('resume-ready',{state:this.state}),()=>log('resume-error'));return p;};
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){log('sfx-start',{state:this.context.state,duration:this.buffer?.duration});return start.apply(this,args);};
  const NativeAudio=window.Audio;
  window.Audio=function(...args){const element=new NativeAudio(...args);window.__startup.media.push(element);return element;};
  const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){const el=this;log('media-play-call',{src:el.src});const p=play.apply(this,args);p?.then(()=>log('media-playing',{src:el.src}),error=>log('media-denied',{name:error?.name,src:el.src}));return p;};
  const capture=()=>{const h=document.querySelector('#resource-loading');window.__startup.frames.push({t:performance.now(),loading:!!h?.open,loaded:Number(h?.dataset.loaded??0),total:Number(h?.dataset.total??0),value:h?.querySelector('progress')?.value??0,home:!!document.querySelector('.title-home'),ensemble:!!document.querySelector('.qiyu-ensemble-burst-canvas')});};
  document.addEventListener('DOMContentLoaded',()=>{capture();setInterval(capture,40);});
 });
}
const inspect=page=>page.evaluate(()=>({events:window.__startup.events,frames:window.__startup.frames,contexts:window.__startup.contexts.map(c=>c.state),media:window.__startup.media.map(a=>({src:a.src,paused:a.paused,readyState:a.readyState,currentTime:a.currentTime})),scene:window.__harness?.game.scene.getScenes(true).map(s=>s.scene.key)}));
const errorCheck=(page,row)=>{page.on('pageerror',e=>row.errors.push(String(e)));};
async function cold(width,height){
 const touch=width<700,name=`cold-${width}`,context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:touch?2:1}),page=await context.newPage(),row={name,errors:[],requests:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 page.on('request',r=>{if(/\/assets\/audio\//.test(r.url()))row.requests.push({url:r.url(),at:Date.now()});});
 await page.route('**/assets/**',async route=>{const path=new URL(route.request().url()).pathname;if(/\.avatar\.webp$/.test(path)||/\/audio\/(foley-v1|gamefeel-rfc|score-impact|high-multiplier)\/.*\.(ogg|mp3)$/.test(path))await new Promise(r=>setTimeout(r,160));await route.continue().catch(()=>{});});
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#resource-loading').waitFor();
  await page.waitForFunction(()=>Number(document.querySelector('#resource-loading')?.dataset.total)>=20,null,{timeout:15000});
  row.loading=await page.locator('#resource-loading').evaluate(h=>({loaded:+h.dataset.loaded,total:+h.dataset.total,value:h.querySelector('progress').value,scrollX:h.scrollWidth>h.clientWidth,box:h.getBoundingClientRect().toJSON()}));
  assert.equal(row.loading.scrollX,false);assert.ok(row.loading.value<1);await page.screenshot({path:`${out}/${name}-loading.png`});
  await ready(page);row.before=await inspect(page);
  assert.equal(await page.locator('#resource-loading').count(),0);assert.equal(await page.locator('.title-home').count(),1);
  assert.ok(row.before.events.filter(e=>e.type==='decode-ready').length>=10,'opening sounds decoded before interaction');
  for(const sample of ['card-slide-1','chip-lay-1','impactWood_light_000','impactBell_heavy_003','cloth2','card-place-1','card-fan-1','impactWood_heavy_000','card-shove-1','chips-stack-1'])
   assert.ok(row.requests.some(r=>r.url.includes('/'+sample+'.ogg?v=')),`${sample} was requested with a content version before the title`);
  assert.equal(row.before.events.filter(e=>e.type==='sfx-start').length,0,'decoding does not play a cue');
  assert.ok(row.before.contexts.includes('suspended'),'autoplay policy still owns unlock');
  assert.equal(await page.locator('.title-home .load-card-seat').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.ok(row.before.frames.some(f=>f.loading&&f.total>=20&&f.value<1));
  await page.screenshot({path:`${out}/${name}-ensemble.png`});
  if(width===390){await page.waitForTimeout(1050);await page.screenshot({path:`${out}/${name}-ensemble-cast.png`});}
  const start=page.getByRole('button',{name:'开始新局',exact:true});const box=await start.boundingBox();assert.ok(box);
  if(touch){await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}else await page.mouse.dblclick(box.x+box.width/2,box.y+box.height/2,{delay:30});
  await page.waitForFunction(()=>!document.querySelector('.qiyu-ensemble-burst-canvas'));await waitScene(page,'game');
  await page.waitForFunction(()=>{const g=window.__harness.game.scene.getScene('game');return g.ready&&g.cardViews.length>0&&g.cardViews.every(v=>!v.dealing);},null,{timeout:20000});
  row.tutorial=await page.evaluate(()=>({mode:window.__harness.game.registry.get('runController')?.state.mode,runId:window.__harness.game.registry.get('runController')?.state.runId,seq:window.__harness.game.registry.get('runController')?.state.commandSeq}));
  assert.equal(row.tutorial.mode,'tutorial');await page.screenshot({path:`${out}/${name}-tutorial.png`});
  const beforeStarts=(await inspect(page)).events.filter(e=>e.type==='sfx-start').length;
  await tapUI(page,'game','card/hearts-5',touch);await tapUI(page,'game','card/clubs-5',touch);
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').selectedIds.size===2);
  await page.waitForTimeout(250);row.after=await inspect(page);
  assert.ok(row.after.contexts.includes('running'),'first trusted input resumes AudioContext');
  assert.ok(row.after.events.filter(e=>e.type==='sfx-start').length>beforeStarts,'real card selections schedule decoded effects');
  assert.ok(row.after.events.some(e=>e.type==='media-playing'),'menu or battle recording started after gesture');
  assert.ok(row.after.media.filter(m=>!m.paused).length<=1,'no duplicate BGM remains after the crossfade');
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',name);
 }catch(error){row.status='FAIL';row.error=String(error.stack);row.observed=await inspect(page).catch(()=>null);await page.screenshot({path:`${out}/${name}-failure.png`}).catch(()=>{});throw error;}finally{await context.close();}
}
async function cacheCase(){
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),row={name:'warm-cache',errors:[],responses:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 const cdp=await context.newCDPSession(page),urls=new Map();await cdp.send('Network.enable');
 cdp.on('Network.requestWillBeSent',e=>urls.set(e.requestId,e.request.url));
 cdp.on('Network.responseReceivedExtraInfo',e=>{const u=urls.get(e.requestId);if(u?.includes('/assets/audio/')&&e.statusCode===304)row.responses.push({url:u,status:304});});
 cdp.on('Network.responseReceived',e=>{if(e.response.url.includes('/assets/audio/')&&(e.response.fromDiskCache||e.response.fromPrefetchCache))row.responses.push({url:e.response.url,status:e.response.status,cached:true});});
 try{
  await page.goto(url);await ready(page);await page.waitForTimeout(600);const first=row.responses.length;
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);await page.waitForTimeout(500);
  row.reused=row.responses.slice(first);assert.ok(row.reused.some(e=>/foley-v1/.test(e.url)),'browser reused or revalidated sound bytes');
  assert.ok(row.reused.some(e=>/[?&]v=[0-9a-f]{12}/.test(e.url)),'sound cache keys carry the asset content version');
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.name);
 }finally{await context.close();}
}
async function failureCase(){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),row={name:'slow-and-failed-resources',errors:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 let release;let slideAttempts=0;const hold=new Promise(resolve=>release=resolve);
 await page.route('**/assets/**',async route=>{const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/amo.avatar.webp'))return route.fulfill({status:503,body:'controlled avatar failure'}).catch(()=>{});
  if(path.endsWith('/card-slide-1.ogg')&&++slideAttempts===1)return route.fulfill({status:503,body:'controlled temporary sound failure'}).catch(()=>{});
  if(/\/audio\/(foley-v1|gamefeel-rfc|score-impact|high-multiplier)\/.*\.(ogg|mp3)$/.test(path))await hold;
  await route.continue().catch(()=>{});
 });
 try{
  const started=Date.now();await page.goto(url,{waitUntil:'commit'});await ready(page);row.titleMs=Date.now()-started;
  assert.ok(row.titleMs<10000,'failed/slow optional resources cannot trap the player');
  row.before=await inspect(page);assert.ok(row.before.frames.some(f=>f.loading&&f.total>=20&&f.loaded<f.total));
  assert.ok(row.before.frames.filter(f=>f.loading&&f.total>=20&&f.loaded<f.total).every(f=>f.value<1),'incomplete resources never claim 100%');
  await page.screenshot({path:`${out}/failed-title.png`});
  await page.touchscreen.tap(24,85);await page.waitForTimeout(300);const count=(await inspect(page)).events.filter(e=>e.type==='sfx-start').length;
  release();await page.waitForTimeout(1800);row.after=await inspect(page);
  row.slideAttempts=slideAttempts;assert.ok(slideAttempts>=2,'a temporary sound failure retries in the background');
  assert.equal(row.after.events.filter(e=>e.type==='sfx-start').length,count,'late sample loads do not replay old cues');
  assert.ok(row.after.media.filter(m=>!m.paused).length<=1);assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.name,row.titleMs+'ms');
 }catch(error){row.status='FAIL';row.error=String(error.stack);row.observed=await inspect(page).catch(()=>null);await page.screenshot({path:`${out}/failed-case-error.png`,timeout:3000}).catch(()=>{});throw error;}
 finally{release();await context.close();}
}
async function mutedCase(){
 const context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true}),page=await context.newPage(),row={name:'saved-mute',errors:[],audioRequests:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 await context.addInitScript(()=>localStorage.setItem('tangsongpai-audio-v2',JSON.stringify({version:2,music:0,sfx:0})));
 page.on('request',r=>{if(/\/assets\/audio\/.*\.(ogg|mp3)(\?|$)/.test(r.url()))row.audioRequests.push(r.url());});
 try{
  await page.goto(url);await ready(page);await page.getByRole('button',{name:'开始新局',exact:true}).tap();await waitScene(page,'game');await page.waitForTimeout(500);
  row.state=await inspect(page);assert.equal(row.audioRequests.length,0);assert.equal(row.state.events.filter(e=>e.type==='sfx-start').length,0);assert.equal(row.state.events.filter(e=>e.type==='media-play-call').length,0);
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.name);
 }finally{await context.close();}
}
async function reconnectCase(){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage(),row={name:'offline-reconnect',errors:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 let offline=true,slideAttempts=0;
 await page.route('**/assets/audio/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(!/\.(ogg|mp3)$/.test(path)||path.includes('/bgm/'))return route.continue().catch(()=>{});
  if(path.endsWith('/card-slide-1.ogg'))slideAttempts++;
  if(offline)return route.fulfill({status:503,body:'controlled offline sound'}).catch(()=>{});
  return route.continue().catch(()=>{});
 });
 try{
  await page.goto(url,{waitUntil:'commit'});await ready(page);
  for(let n=0;n<100&&slideAttempts<3;n++)await page.waitForTimeout(100);
  assert.ok(slideAttempts>=3,'initial finite retry budget was exercised');
  const before=slideAttempts;offline=false;
  await page.evaluate(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('online'));});
  await page.waitForFunction(()=>window.__startup.events.filter(e=>e.type==='decode-ready').length>=10,null,{timeout:15000});
  row.state=await inspect(page);row.attemptsBefore=before;row.attemptsAfter=slideAttempts;
  assert.equal(slideAttempts,before+1,'reconnect retries the missing recording once without duplicate workers');
  assert.equal(row.state.events.filter(e=>e.type==='sfx-start').length,0,'reconnect cannot replay an expired sound');
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.name);
 }finally{await context.close();}
}
async function lifecycleCase(){
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),row={name:'visibility-and-reentry',errors:[]};report.cases.push(row);errorCheck(page,row);await instrument(context);
 try{
  await page.goto(url);await ready(page);await page.mouse.click(30,60);await page.waitForFunction(()=>window.__startup.contexts.some(c=>c.state==='running'));
  await page.waitForFunction(()=>window.__startup.media.some(a=>!a.paused),null,{timeout:12000});
  // Dispatch the browser's visibility lifecycle with a controlled hidden value.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__startup.media.every(a=>a.paused)&&window.__startup.contexts.every(c=>c.state==='suspended'));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>window.__startup.contexts.some(c=>c.state==='running')&&window.__startup.media.some(a=>!a.paused),null,{timeout:10000});
  for(let i=0;i<2;i++){
   await tapUI(page,'title','action/skip-tutorial');await waitScene(page,'character-select');await tapUI(page,'character-select','action/cancel-character');await waitScene(page,'title');
   assert.equal(await page.locator('.qiyu-ensemble-burst-canvas').count(),0,'returning home does not replay the title entrance');
  }
  await page.waitForTimeout(500);row.state=await inspect(page);assert.ok(row.state.media.filter(m=>!m.paused).length<=1);assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.name);
 }finally{await context.close();}
}
try{
 const only=process.env.STARTUP_CASE;
 for(const [w,h] of [[1366,768],[390,844],[320,568]])if(!only||only===`cold-${w}`)await cold(w,h);
 if(!only||only==='warm-cache')await cacheCase();if(!only||only==='slow-and-failed-resources')await failureCase();
 if(!only||only==='saved-mute')await mutedCase();if(!only||only==='offline-reconnect')await reconnectCase();if(!only||only==='visibility-and-reentry')await lifecycleCase();report.status='PASS';
}
catch(error){report.status='FAIL';report.error=String(error.stack);console.error(error);process.exitCode=1;}
finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
