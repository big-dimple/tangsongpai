import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build,preview} from 'vite';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {chooseCharacter,openRunMenu,toggleRunMenu,tapUI,waitScene} from './ui.mjs';

const out='shots/canvas-size';await mkdir(out,{recursive:true});
const buildDir=resolve(out,'build');await build({mode:'e2e',build:{outDir:buildDir,emptyOutDir:true},logLevel:'error'});
const server=await preview({build:{outDir:buildDir},preview:{host:'127.0.0.1',port:5596,strictPort:true},logLevel:'error'});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
try{
 for(const viewport of [{width:1920,height:1080},{width:1366,height:768},{width:390,height:844},{width:320,height:568}]){
  const touch=viewport.width<700,context=await browser.newContext({viewport,hasTouch:touch,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
  try{
   await page.goto('http://127.0.0.1:5596/?harness=1');console.log('begin',viewport);await chooseCharacter(page,'azao',touch);console.log('shop',viewport);
   await tapUI(page,'shop','action/start-stage',touch);await waitScene(page,'game');
   await page.getByRole('button',{name:'进入暖场 ›',exact:true}).click();
   await page.waitForFunction(()=>{const g=window.__harness.game.scene.getScene('game');return g.ready&&!g.playing&&!g.presentation&&g.cardViews.length&&g.cardViews.every(c=>!c.dealing);});
   const geometry=()=>page.evaluate(()=>{const game=window.__harness.game,g=game.scene.getScene('game'),canvas=game.canvas.getBoundingClientRect(),b=o=>{const x=o.getBounds();return {x:x.x,y:x.y,width:x.width,height:x.height};};return {logical:g.view.layout,canvas:{width:canvas.width,height:canvas.height},font:g.resourceCounts.play.style.fontSize,text:b(g.resourceCounts.play),play:b(g.playButton),discard:b(g.discardButton),cards:g.cardViews.filter(c=>c.hit.visible).map(c=>b(c.hit)),id:g.cardViews.find(c=>c.hit.visible).card.id};});
   const standard=await geometry();if(viewport.width===320)await page.screenshot({path:`${out}/320-standard-game.png`});assert.equal(await page.locator('html').getAttribute('data-text-size'),'normal');await tapUI(page,'game','card/'+standard.id,touch);await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').selectedIds.size===1);await openRunMenu(page,touch);await page.getByLabel('画面大小').selectOption('large');assert.equal(await page.getByLabel('画面大小').inputValue(),'large');assert.equal(await page.locator('html').getAttribute('data-text-size'),'large');await toggleRunMenu(page,touch);
   await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').view?.layout);assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('game').selectedIds.size),1,'selection survives the size change');
   const large=await geometry(),factor=large.canvas.width/large.logical.width,oldFactor=standard.canvas.width/standard.logical.width;
   assert.ok(parseFloat(large.font)*factor>=parseFloat(standard.font)*oldFactor*(viewport.width===320?1.09:1.19),'canvas text is physically larger');
   for(const b of [large.play,large.discard,...large.cards])assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=large.logical.width+1&&b.y+b.height<=large.logical.height+1,'hit stays on screen '+JSON.stringify(b));
   await page.waitForTimeout(1300);await page.screenshot({path:`${out}/${viewport.width}-game.png`});await tapUI(page,'game','card/'+large.id,touch);await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').selectedIds.size===0);await tapUI(page,'game','card/'+large.id,touch);await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').selectedIds.size===1);
   if(!touch){const target=page.locator('[data-pc-keyboard-action="play"]');if(await target.count()){await target.focus();assert.equal(await target.evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').run.commandSeq>1);}else{await page.locator('canvas').focus();assert.equal(await page.locator('canvas').evaluate(e=>document.activeElement===e),true);}}
   await page.reload();await waitScene(page,'title');await openRunMenu(page,touch);assert.equal(await page.getByLabel('画面大小').inputValue(),'large');assert.match(await page.locator('.canvas-size-hint').textContent(),viewport.width===320?/当前画布 110%/:/当前画布 120%/);await toggleRunMenu(page,touch);await tapUI(page,'title','action/title-continue',touch);await waitScene(page,'game');await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').ready);const resumed=await geometry();assert.ok(Math.abs(resumed.canvas.width/resumed.logical.width-factor)<.01,'size survives scene changes');
   assert.deepEqual(errors,[]);console.log('PASS',viewport,JSON.stringify({factor,standardFont:standard.font,largeFont:large.font,score:large.logical.scoreBoard,hand:large.logical.hand}));
  }catch(e){console.error('STATE',await page.evaluate(()=>({scenes:window.__harness?.game.scene.getScenes(true).map(s=>s.sys.settings.key),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.outerHTML.slice(0,300)),errors:window.__harness?.game.registry.get('uiDiagnostics')})));await page.screenshot({path:`${out}/${viewport.width}-failure.png`});throw e;}finally{await context.close();}
 }
 // A real Chromium profile preference changes CSS medium; this does not fake a root font size.
 const profile=await mkdtemp(resolve(tmpdir(),'tsp-font-'));await mkdir(resolve(profile,'Default'));await writeFile(resolve(profile,'Default/Preferences'),JSON.stringify({webkit:{webprefs:{default_font_size:24}}}));
 const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,viewport:{width:1366,height:768},args:['--no-sandbox']});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5596/?harness=1');
  const medium=await page.evaluate(()=>{const e=document.createElement('span');e.style.fontSize='medium';document.body.append(e);const size=getComputedStyle(e).fontSize;e.remove();return size;});assert.equal(medium,'24px');
  await chooseCharacter(page,'azao',false);await tapUI(page,'shop','action/start-stage');await waitScene(page,'game');await page.getByRole('button',{name:'进入暖场 ›',exact:true}).click();await page.waitForFunction(()=>{const g=window.__harness.game.scene.getScene('game');return g.ready&&!g.playing&&!g.presentation&&g.cardViews.length&&g.cardViews.every(c=>!c.dealing);});
  const measurement=()=>page.evaluate(()=>{const game=window.__harness.game,g=game.scene.getScene('game');return {factor:game.canvas.getBoundingClientRect().width/g.view.layout.width,font:parseFloat(g.resourceCounts.play.style.fontSize)};});
  const automatic=await measurement();assert.equal(await page.locator('html').getAttribute('data-text-size'),'large');assert.ok(Math.abs(automatic.factor-1.2)<.01);await page.screenshot({path:`${out}/browser-font-24.png`});await openRunMenu(page);assert.equal(await page.getByLabel('画面大小').inputValue(),'auto');await page.getByLabel('画面大小').selectOption('standard');assert.equal(await page.locator('html').getAttribute('data-text-size'),'normal');await toggleRunMenu(page);const standard=await measurement();assert.ok(Math.abs(standard.factor-1)<.01);assert.ok(automatic.font*automatic.factor>=standard.font*standard.factor*1.19);
  await page.reload();await waitScene(page,'title');await openRunMenu(page);assert.equal(await page.getByLabel('画面大小').inputValue(),'standard');await page.getByLabel('画面大小').selectOption('auto');await toggleRunMenu(page);await tapUI(page,'title','action/title-continue');await waitScene(page,'game');await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').ready);assert.ok(Math.abs((await measurement()).factor-1.2)<.01);assert.deepEqual(errors,[]);console.log('PASS real Chromium default font 24px',automatic,standard);
 }finally{await context.close();await rm(profile,{recursive:true,force:true});}
}finally{await browser.close();await server.close();}
