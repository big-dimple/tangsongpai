import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openSelector,tapUI,waitScene} from '../../../../harness/ui.mjs';

const base='docs/production/evidence/selection-ink-seal-2026-10-21',out=process.env.SELECTION_REVIEW_OUT??base+'/after';
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5591,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const paths=['src/game/CharacterSelectScene.ts','src/game/SelectionEntryParticles.ts','src/game/EntryDepthParticles.ts','src/game/SelectionLayout.ts','src/game/OpeningShowcaseLayout.ts'];
const hashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hashes,browser:browser.version(),scope:'Local Chromium; native pointer/keyboard inputs. Observer reads private presentation state only. No deployment, human aesthetics, audio or physical device acceptance.',cases:[],errors:[]};
const state=page=>page.evaluate(()=>{const s=window.__harness.game.scene.getScene('character-select'),p=s.entryParticles;return {selected:s.selectedId,route:s.selectedRoute,step:s.step,choosing:s.choosing,notice:s.notice,motion:!!p?.motion,gather:p?.gathering.length,seal:!!p?.seal?.visible,nodes:p?.nodes.length,listening:p?.listening,destroyed:p?.destroyed,updates:s.events.listenerCount('update'),texts:s.view.root.list.filter(o=>o.name==='opening/status').map(o=>o.text),run:window.__harness.game.registry.get('runController')?.state??null};});
async function tap(page,name,touch){await tapUI(page,'character-select',name,touch);}
async function observe(page){await page.evaluate(()=>{window.selectionFrames=[];const s=window.__harness.game.scene.getScene('character-select');s.events.on('postupdate',()=>{const p=s.entryParticles;window.selectionFrames.push({at:performance.now(),step:s.step,id:s.selectedId,motion:!!p?.motion,gather:p?.gathering.length,gatherFront:p?.gathering.filter(i=>p.nodes[i].parentContainer===p.front).length,seal:!!p?.seal?.visible,choosing:s.choosing,nodes:p?.nodes.length,commands:p?.feedback?.commandBuffer?.length??0});});});}
async function frames(page,label){const all=await page.evaluate(()=>{const a=window.selectionFrames;window.selectionFrames=[];return a;});report.cases.push({label,frames:all});return all;}
const idle=page=>page.waitForTimeout(680);
try{
 for(const [width,height]of [[1366,768],[390,740],[320,640]]){
  const touch=width<640,context=await browser.newContext({viewport:{width,height},hasTouch:touch,recordVideo:width===320?undefined:{dir:out,size:{width,height}}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.goto('http://127.0.0.1:5591/?harness=1&seed=selection-ink-review');await openSelector(page,touch);await idle(page);await observe(page);
  const before=await state(page);assert.equal(before.run,null);assert.equal(before.nodes,touch?32:64);
  for(const id of ['amo','touye','laohuan','erxiang','azao','xiemu']){
   await tap(page,'character/'+id,touch);await idle(page);const samples=await frames(page,width+'-switch-'+id);
   assert.ok(samples.some(f=>f.motion&&f.commands>0),'switch draws ink');assert.ok(samples.every(f=>!f.seal&&f.gather===0),'browse never stamps');assert.equal((await state(page)).selected,id);
  }
  await page.screenshot({path:out+'/'+width+'x'+height+'-xiemu.png',scale:'css'});
  await tap(page,'character/xiemu',touch);await idle(page);assert.ok((await frames(page,width+'-same-hero')).every(f=>!f.motion&&!f.seal));
  await tap(page,'action/confirm-character',touch);await idle(page);assert.equal((await state(page)).step,'route');assert.equal((await state(page)).run,null);assert.ok((await frames(page,width+'-hero-to-route')).every(f=>!f.seal));
  await tap(page,'route/flush',touch);await idle(page);assert.ok((await frames(page,width+'-route-preview')).every(f=>!f.seal));
  await page.screenshot({path:out+'/'+width+'x'+height+'-route-flush.png',scale:'css'});
  await tap(page,'action/cancel-character',touch);assert.equal((await state(page)).selected,'xiemu');assert.equal((await state(page)).run,null);
  await tap(page,'action/cancel-character',touch);assert.equal((await state(page)).selected,undefined);assert.equal((await state(page)).run,null);
  await tap(page,'character/amo',touch);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state(page)).motion,false);assert.equal((await state(page)).listening,false);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await idle(page);assert.equal((await state(page)).motion,false);
  await tap(page,'character/touye',touch);await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').render());assert.equal((await state(page)).motion,false);assert.equal((await state(page)).nodes,touch?32:64);
  await page.emulateMedia({reducedMotion:'reduce'});await tap(page,'character/azao',touch);await idle(page);assert.equal((await state(page)).motion,false);assert.equal((await state(page)).listening,false);
  const staticChoice=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('character-select');return s.view.root.list.find(o=>o.name==='character/azao')?.getData('selected');});assert.equal(staticChoice,true);
  await page.screenshot({path:out+'/'+width+'x'+height+'-reduced.png',scale:'css'});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await tap(page,'character/xiemu',touch);await idle(page);
  await tap(page,'action/confirm-character',touch);await tap(page,'route/flush',touch);await idle(page);await frames(page,width+'-before-start');
  await tap(page,'action/confirm-character',touch);await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop')&&window.__harness.game.scene.getScene('shop').ready);
  const saved=await page.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,storage:await c.store.read()};});assert.equal(saved.state.characterId,'xiemu');assert.equal(saved.state.openingRoute,'flush');assert.deepEqual(saved.storage.current.state,saved.state);
  const confirmation=await frames(page,width+'-saved-confirmation');assert.ok(confirmation.some(f=>f.seal&&f.gather===9&&f.gatherFront===9),'saved confirmation borrows eight gold strokes and one glow brush above the portrait');assert.ok(confirmation.filter(f=>f.seal).every(f=>f.choosing),'seal only while real confirmation is locked');
  const ended=await state(page);assert.equal(ended.destroyed,true);assert.equal(ended.nodes,0);assert.equal(ended.motion,false);assert.equal(ended.listening,false);
  await page.reload();await waitScene(page,'title');await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.state);assert.deepEqual((await page.evaluate(()=>window.__harness.game.registry.get('runController').state)),saved.state);
  report.cases.push({label:width+'-start-and-cold-restore',character:'xiemu',route:'flush',saved:true,cleanup:ended,staticChoice});
  const video=page.video();await context.close();if(video)await rename(await video.path(),out+'/'+width+'x'+height+'-continuous.webm');console.log('PASS',width,height);
 }
 // Isolated storage-fault injection: native confirmation must not stamp an unsaved candidate.
 const context=await browser.newContext({viewport:{width:390,height:740},hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));await page.goto('http://127.0.0.1:5591/?harness=1');await openSelector(page,true);await idle(page);await observe(page);
 await tap(page,'character/erxiang',true);await tap(page,'action/confirm-character',true);await tap(page,'route/group',true);await idle(page);await frames(page,'fault-before');
 await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('selection-review injected quota','QuotaExceededError');};});await tap(page,'action/confirm-character',true);await page.waitForFunction(()=>!!window.__harness.game.scene.getScene('character-select').notice);await idle(page);
 assert.ok((await frames(page,'save-failure')).every(f=>!f.seal&&f.gather===0));assert.equal((await state(page)).run,null);report.cases.push({label:'unsaved-candidate-no-stamp',state:await state(page)});await context.close();
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack??String(e);process.exitCode=1;console.error(report.error);}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();console.log(report.status);}
