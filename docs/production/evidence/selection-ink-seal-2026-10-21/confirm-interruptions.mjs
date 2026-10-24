import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openSelector,tapUI} from '../../../../harness/ui.mjs';
const out='docs/production/evidence/selection-ink-seal-2026-10-21/confirm-interruptions';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5594,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const report={sourceSha256:createHash('sha256').update(await readFile('src/game/SelectionEntryParticles.ts')).digest('hex'),cases:[],errors:[],scope:'Three explicit interruptions during the real saved-confirmation animation. confirm wrapper forwards and observes the original Promise without changing its result or timing. Isolated local browser contexts; no rules changes.'};
try{
 for(const kind of ['blur','resize','exit']){
  const width=kind==='resize'?1366:390,height=kind==='resize'?768:740,touch=width<640,context=await browser.newContext({viewport:{width,height},hasTouch:touch,recordVideo:{dir:out,size:{width,height}}}),page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5594/?harness=1');await openSelector(page,touch);await page.waitForTimeout(500);await tapUI(page,'character-select','character/erxiang',touch);await tapUI(page,'character-select','action/confirm-character',touch);await tapUI(page,'character-select','route/straight',touch);await page.waitForTimeout(600);
  await page.evaluate(()=>{
   const game=window.__harness.game,s=game.scene.getScene('character-select'),p=s.entryParticles,confirm=p.confirm;
   window.confirmProbe={calls:0,settlements:0,shopEntrances:0};let wasShop=false;
   game.events.on('poststep',()=>{const active=game.scene.isActive('shop');if(active&&!wasShop)window.confirmProbe.shopEntrances++;wasShop=active;});
   p.confirm=function(...args){window.confirmProbe.calls++;const promise=confirm.apply(this,args);window.observedConfirmPromise=promise;promise.then(()=>{window.confirmProbe.settlements++;});return promise;};
  });
  await tapUI(page,'character-select','action/confirm-character',touch);
  await page.waitForFunction(()=>{const p=window.__harness.game.scene.getScene('character-select').entryParticles;return p.seal?.visible&&p.seal.alpha>.2&&p.gathering.length>=4;});
  const before=await page.evaluate(async()=>{
   const s=window.__harness.game.scene.getScene('character-select'),p=s.entryParticles,c=window.__harness.game.registry.get('runController');window.confirmOldLayer=p;window.confirmOldController=c;
   const slots=await c.store.read();if(!p.motion||!p.seal.visible||!p.gathering.length)throw Error('missed confirmation interruption window');
   return {motion:!!p.motion,seal:p.seal.visible,alpha:p.seal.alpha,gather:p.gathering.length,nodes:p.nodes.length,probe:{...window.confirmProbe},revision:slots.revision,state:slots.current.state};
  });assert.equal(before.probe.calls,1);assert.equal(before.probe.settlements,0);
  if(kind==='resize')await page.setViewportSize({width:1280,height:720});
  else await page.evaluate(kind=>{if(kind==='blur')window.dispatchEvent(new Event('blur'));else window.__harness.game.scene.getScene('character-select').scene.start('title');},kind);
  await page.waitForFunction(()=>window.confirmProbe.settlements===1);
  if(kind==='exit')await page.waitForFunction(()=>window.__harness.game.scene.isActive('title'));
  else await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));
  // A subsequent focus/settle event cannot resume the old one-shot or create another run.
  await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('tangsongpai-presentation'));});await page.waitForTimeout(700);
  const after=await page.evaluate(async()=>{
   const game=window.__harness.game,p=window.confirmOldLayer,c=game.registry.get('runController'),slots=await c.store.read();
   return {motion:!!p.motion,seal:!!p.seal?.visible,gather:p.gathering.length,nodes:p.nodes.length,listening:p.listening,destroyed:p.destroyed,finishPending:!!p.finishFeedback,probe:window.confirmProbe,sameController:c===window.confirmOldController,revision:slots.revision,state:slots.current.state,shop:game.scene.isActive('shop'),title:game.scene.isActive('title')};
  });assert.equal(after.motion,false);assert.equal(after.seal,false);assert.equal(after.gather,0);assert.equal(after.nodes,0);assert.equal(after.listening,false);assert.equal(after.destroyed,true);assert.equal(after.finishPending,false);assert.equal(after.probe.calls,1);assert.equal(after.probe.settlements,1);assert.equal(after.probe.shopEntrances,kind==='exit'?0:1);assert.equal(after.sameController,true);assert.equal(after.revision,before.revision);assert.deepEqual(after.state,before.state);
  report.cases.push({kind,before,after});const video=page.video();await context.close();await rename(await video.path(),out+'/'+kind+'-continuous.webm');console.log(kind,'PASS');
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack??String(e);console.error(report.error);process.exitCode=1;}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();console.log(report.status);}
