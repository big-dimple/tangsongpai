import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {writeFile,mkdir} from 'node:fs/promises';
import {openSelector,tapUI} from '../../../../harness/ui.mjs';
const out='docs/production/evidence/selection-ink-seal-2026-10-21/lifecycle';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5592,strictPort:true},logLevel:'error'});await server.listen();const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const report={cases:[],errors:[],scope:'Local native touch inputs with explicit lifecycle/fault interruptions; no gameplay mutations.'};
const p=await browser.newPage({viewport:{width:390,height:740},hasTouch:true});p.on('pageerror',e=>report.errors.push(String(e)));
const tap=name=>tapUI(p,'character-select',name,true);
const snap=()=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('character-select'),e=s.entryParticles;return {selected:s.selectedId,motion:!!e.motion,seal:!!e.seal?.visible,nodes:e.nodes.length,listening:e.listening,destroyed:e.destroyed,updates:s.events.listenerCount('update'),feedback:s.view.root.list.filter(o=>o.name==='opening/choice-feedback').length,run:window.__harness.game.registry.get('runController')?.state??null};});
async function check(label){const state=await snap();report.cases.push({label,state});assert.ok(state.feedback<=1);assert.equal(state.nodes,32);assert.equal(state.seal,false);return state;}
try{
 await p.goto('http://127.0.0.1:5592/?harness=1');await openSelector(p,true);await p.waitForTimeout(500);const initial=await snap();
 await tap('character/amo');await tap('character/touye');assert.equal((await check('rapid-switch')).selected,'touye');
 await tap('action/cancel-character');assert.equal((await check('cancel-mid-ink')).motion,false);assert.equal((await snap()).selected,undefined);
 await tap('character/amo');await tap('opening/portrait-full');await p.locator('dialog[open]').waitFor();await p.waitForTimeout(50);assert.equal((await check('dialog-interruption')).motion,false);assert.equal((await snap()).listening,false);await p.keyboard.press('Escape');await p.waitForTimeout(380);assert.equal((await snap()).motion,false);
 await tap('character/touye');await p.setViewportSize({width:320,height:640});await p.waitForTimeout(150);assert.equal((await check('resize-mid-ink')).motion,false);assert.equal((await snap()).selected,'touye');
 await tap('character/azao');await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(50);assert.equal((await check('reduce-mid-ink')).motion,false);assert.equal((await snap()).listening,false);
 await p.emulateMedia({reducedMotion:'no-preference'});await tap('character/erxiang');
 await p.evaluate(()=>{window.oldSelectionParticles=window.__harness.game.scene.getScene('character-select').entryParticles;window.__harness.game.scene.getScene('character-select').scene.start('title');});
 await p.waitForFunction(()=>window.__harness.game.scene.isActive('title'));
 const old=await p.evaluate(()=>{const e=window.oldSelectionParticles;return {destroyed:e.destroyed,nodes:e.nodes.length,motion:!!e.motion,listening:e.listening};});assert.deepEqual(old,{destroyed:true,nodes:0,motion:false,listening:false});report.cases.push({label:'scene-shutdown-mid-ink',old});
 await openSelector(p,true);await p.waitForTimeout(400);assert.equal((await check('scene-reentry')).updates,initial.updates);
 // Real existing-save overwrite prompt cancellation never starts a confirmation effect.
 await tap('character/erxiang');await tap('action/confirm-character');await tap('route/group');await p.waitForTimeout(500);await tap('action/confirm-character');await p.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));
 await p.evaluate(()=>window.__harness.game.scene.getScene('shop').scene.start('character-select'));await p.waitForFunction(()=>window.__harness.game.scene.isActive('character-select'));await p.waitForTimeout(400);
 await tap('character/amo');await tap('action/confirm-character');await tap('route/straight');await tap('action/confirm-character');await p.locator('dialog[open]').waitFor();const prior=(await snap()).run;await p.getByRole('button',{name:'取消',exact:true}).click();await p.waitForTimeout(380);assert.equal((await check('cancel-overwrite-prompt')).motion,false);assert.deepEqual((await snap()).run,prior);
 await tap('action/confirm-character');await p.getByRole('button',{name:'确认开始新局',exact:true}).click();await p.waitForFunction(()=>window.__harness.game.scene.getScene('character-select').entryParticles.seal?.visible);const confirmed=await snap();assert.equal(confirmed.run.characterId,'amo');assert.equal(confirmed.run.openingRoute,'straight');report.cases.push({label:'saved-overwrite-stamp',state:confirmed});
 await p.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack??String(e);console.error(report.error);process.exitCode=1;await p.screenshot({path:out+'/FAIL.png'});}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();console.log(report.status);}
