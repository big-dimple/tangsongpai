import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {waitScene,tapUI} from './ui.mjs';

const out=process.env.DOM_TEXT_OUT??'shots/dom-large-text';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
let initial=createRun({seed:'mobile-tool-controlled',runId:'controlled/large-tool',characterId:'amo',rulesVersion:'r2',r2Identity:newRunIdentity('amo','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
const result=applyCommand(initial,{runId:initial.runId,commandId:initial.runId+'/fixture/1',expectedSeq:initial.commandSeq,action:{type:'RerollShop'}});assert.ok(result.ok);initial=result.state;
initial.gold=30;initial.consumables=[{instanceId:'held/T08',definitionId:'T08'}];const stockId=initial.shop.toolOffers[0].offerId;initial.shop.toolOffers=[{offerId:stockId,definitionId:'S01',price:8,consumed:false}];
const donor=initial.deckInstances.find(c=>c.id==='spades-13');donor.enhancement='heat-paper';donor.edition='foil';assert.ok(readCheckpoint(makeCheckpoint(initial,[])).ok);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--disable-gpu']});
const cases=[];
try {
 for(const spec of [{name:'320-auto-24-tool',width:320,height:568,defaultSize:24},{name:'390-auto-24-tool',width:390,height:844,defaultSize:24},{name:'320-large',width:320,height:568,mode:'large'},{name:'390-large',width:390,height:844,mode:'large'},{name:'390-standard-tool',width:390,height:844,mode:'standard'}]) {
  const profile=spec.defaultSize?await mkdtemp(join(tmpdir(),'tsp-tool-font-')):undefined;
  if(profile){await mkdir(join(profile,'Default'));await writeFile(join(profile,'Default','Preferences'),JSON.stringify({webkit:{webprefs:{default_font_size:spec.defaultSize}}}));}
  const options={viewport:{width:spec.width,height:spec.height},hasTouch:true,reducedMotion:'reduce'};
  const context=profile?await chromium.launchPersistentContext(profile,{...options,executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--disable-gpu']}):await browser.newContext(options),page=await context.newPage();page.setDefaultTimeout(20000);page.on('dialog',d=>d.accept());
  try {
   if(spec.mode)await page.addInitScript(mode=>localStorage.setItem('tangsongpai-canvas-size-v1',mode),spec.mode);
   await page.goto(server.resolvedUrls.local[0]+'?harness=1');await waitScene(page,'title');
   if(spec.defaultSize)assert.equal(await page.evaluate(()=>{const e=document.createElement('span');e.style.fontSize='medium';document.body.append(e);const size=parseFloat(getComputedStyle(e).fontSize);e.remove();return size;}),spec.defaultSize);
   // Seed a validated checkpoint using the production import transaction; interactions below are native.
   assert.ok(await page.evaluate(async checkpoint=>{const {gameSession}=await import('/src/game/session.ts');const session=gameSession();if(!session.lease.writable)await session.takeOver();return session.importJSON(JSON.stringify(checkpoint));},makeCheckpoint(initial,[])));
   await page.reload();await waitScene(page,'title');await page.getByRole('button',{name:'继续本局',exact:true}).tap();
   await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
   await tapUI(page,'shop','action/shelf-tools',true);await tapUI(page,'shop','offer/'+stockId,true);await page.locator('.make-cards-purchase[open]').waitFor();
   const purchase=page.getByRole('button',{name:'购买 · 8 金',exact:true});await purchase.scrollIntoViewIfNeeded();await purchase.focus();assert.equal(await purchase.evaluate(e=>document.activeElement===e),true);await page.screenshot({path:`${out}/${spec.name}-purchase.png`});await purchase.tap();
   const tool=page.locator('.make-cards-tool[open]');await tool.waitFor();
   for(const [role,id] of [['donor','spades-13'],['target','clubs-9']]) {const input=page.locator('input[name$="/'+role+'"][value="'+id+'"]');await input.scrollIntoViewIfNeeded();await input.focus();await page.keyboard.press('Space');assert.ok(await input.isChecked());assert.equal(await input.evaluate(e=>document.activeElement===e),true);}
   assert.ok(await page.locator('input[name$="/donor"][value="spades-13"]').isChecked());assert.ok(await page.locator('input[name$="/target"][value="clubs-9"]').isChecked());
   await page.screenshot({path:`${out}/${spec.name}-tool-selected.png`});
   const confirm=tool.locator('.dialog-primary');await confirm.scrollIntoViewIfNeeded();await confirm.focus();assert.equal(await confirm.evaluate(e=>document.activeElement===e),true);assert.ok(await confirm.isEnabled());
   const info=await tool.evaluate(d=>({width:d.clientWidth,scrollWidth:d.scrollWidth,height:d.clientHeight,scrollHeight:d.scrollHeight,bodyFont:getComputedStyle(d.querySelector('.tool-short-instruction')).fontSize}));assert.ok(info.scrollWidth<=info.width+1,JSON.stringify(info));
   await page.screenshot({path:`${out}/${spec.name}-tool-confirm.png`});
   await confirm.tap();await page.locator('.tool-saved-result[open]').waitFor();
   const state=await page.evaluate(()=>window.__harness.game.registry.get('runController').state);assert.ok(state.destroyedIds.includes('spades-13'));assert.equal(state.gold,22);
   cases.push({spec,info,committed:true});console.log('PASS',spec.name);
  } catch(error) {await page.screenshot({path:`${out}/${spec.name}-failure.png`});throw error;} finally {await context.close();if(profile)await rm(profile,{recursive:true,force:true});}
 }
 await writeFile(`${out}/tool-report.json`,JSON.stringify({cases},null,2));
} finally {await browser.close();await server.close();}
