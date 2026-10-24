import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openRunMenu,toggleRunMenu} from './ui.mjs';

const out=resolve(process.env.LIUE_STAGE_OUT??'shots/liue-listening-stage');await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5741,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const {currentHeroReceipt}=await server.ssrLoadModule('/tests/fixtures/current-hero-receipt.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={scope:'Controlled valid checkpoint bootstrap before startup; actual native UI play/discard commands at speed 1, desktop 1366x768 and touch viewport 390x844. Not natural acquisition or physical-device acceptance.',cases:[]};
const cases=process.env.LIUE_STAGE_MODE==='checks'?['skip','reduce','live-reduce','full-rack'].map(mode=>({phone:true,mode})):[false,true].map(phone=>({phone,mode:process.env.LIUE_STAGE_MODE??'normal'}));
try{for(const {phone,mode} of cases){
 const key=(phone?'390':'1366')+'-erxiang';if(process.env.LIUE_STAGE_CASES&&!process.env.LIUE_STAGE_CASES.split(',').includes(key))continue;
 const dir=resolve(out,key+(mode==='normal'?'':'-'+mode));await mkdir(dir,{recursive:true});const viewport={width:phone?390:1366,height:phone?844:768},f={state:(await currentHeroReceipt('erxiang')).before,selectedIds:['spades-8','hearts-8']};
 if(mode==='full-rack'){f.state.jokers=['b02','e11','e01','e04','b10'].map(id=>r2CreateJoker(id,'controlled/held/'+id,8,'none',f.state));f.state.stage.initialJokerIds=f.state.jokers.map(j=>j.instanceId);}
 const checkpoint=makeCheckpoint(f.state,[]);assert.ok(readCheckpoint(checkpoint).ok);
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:phone,reducedMotion:mode==='reduce'?'reduce':'no-preference',recordVideo:{dir:dir+'/raw',size:viewport}}),p=await context.newPage();p.setDefaultTimeout(90000);
 const row={key,contentVersion:f.state.contentVersion,mode,errors:[],frames:[],status:'RUNNING'};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
 try{
  await p.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:false})));
  await p.route('**/__skill-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<html><title>Controlled checkpoint setup</title></html>'}));await p.goto('http://127.0.0.1:5741/__skill-bootstrap');await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);await p.goto('http://127.0.0.1:5741/?harness=1');await waitScene(p,'title');await tapUI(p,'title','action/title-continue',phone);
  await waitScene(p,'game');await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
  for(const id of f.selectedIds)await tapUI(p,'game','card/'+id,phone);
   const saved=await p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};});
   const choose=async()=>{await tapUI(p,'game','hero/action-shortcut',phone);await p.getByRole('button',{name:/^(已选 )?第1张 · 8♠$/}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));};
   await choose();assert.equal(await p.evaluate(()=>window.__harness.game.scene.getScene('game').erxiangTargetId),'spades-8');
   await tapUI(p,'game','hero/action-shortcut',phone);await p.getByRole('button',{name:'取消本手选牌',exact:true}).click();
   assert.ok(await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return !s.erxiangTargetId&&!s.view.root.getByName('hero/liue-listening-stage')&&s.targetAttachment.handoffEarExclusions().length===0;}));
   assert.deepEqual(await p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};}),saved);
   await choose();
   await tapUI(p,'game','card/spades-8',phone);
   assert.ok(await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return !s.erxiangTargetId&&s.targetAttachment.handoffEarExclusions().length===0;}));
   await tapUI(p,'game','card/spades-8',phone);await choose();
   await openRunMenu(p,phone);await toggleRunMenu(p,phone);
   row.selectionChecks=['native target choice','cancel removes target ear without saving','deselect invalidates draft','native reselect and menu return'];
  await p.screenshot({path:dir+'/before.png'});
  await p.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game');window.skillProbe={frames:[],images:[],last:0};const tick=()=>{const stage=s.view.root?.getByName('hero/liue-listening-stage');const focus=s.view.root?.getByName('hero/xin-candidate-focus');if(!stage&&!focus)return;const a=window.skillProbe;const now=performance.now();a.frames.push({at:now,phase:stage?.getData('phase')??'candidate-focus',bounds:stage?.getBounds(),eventId:stage?.getData('eventId'),slot:stage?.getData('bounds'),protected:[s.view.layout.scoreBoard,...s.settledCards.values(),...s.jokerViews.values()].map(v=>v.container?v.container.getBounds():v.getBounds?v.getBounds():v),earScale:stage?.getByName('hero/liue-listening-ear')?.scaleX,earScaleY:stage?.getByName('hero/liue-listening-ear')?.scaleY,release:stage?.getData('release')});if(now-a.last>110){a.last=now;a.images.push(g.canvas.toDataURL('image/png'));}};g.events.on('postrender',tick);window.skillProbe.stop=()=>g.events.off('postrender',tick);});
  await tapUI(p,'game','action/play',phone);
  await p.waitForFunction(()=>window.skillProbe.frames.length>0);
  if(mode==='skip')await p.evaluate(()=>window.__harness.game.scene.getScene('game').fastForward());
  if(mode==='live-reduce'){await openRunMenu(p,phone);await p.getByLabel('减少动态',{exact:false}).check();if(await p.locator('.run-menu-modal').evaluate(d=>d.open))await toggleRunMenu(p,phone);}
  await p.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation&&!s.refillPresentation&&s.cardViews.every(v=>!v.dealing);});
  const actual=await p.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal};});assert.equal(actual.journal.length,1);const canonical=applyCommand(f.state,actual.journal[0]);assert.ok(canonical.ok);assert.deepEqual(actual.state,canonical.state);
  const probe=await p.evaluate(()=>{skillProbe.stop();return {frames:skillProbe.frames,images:skillProbe.images};});row.frames=probe.frames;assert.ok(row.frames.some(f=>f.phase==='charge'));if(!['skip','live-reduce'].includes(mode)){if(mode!=='reduce'){assert.ok(row.frames.some(f=>f.phase==='listen'));assert.ok(row.frames.some(f=>f.phase==='release'));assert.ok(row.frames.some(f=>f.phase==='impact'));}if(mode!=='reduce')assert.ok(row.frames.at(-1).at-row.frames[0].at>700);}
  for(let i=0;i<probe.images.length;i++)await writeFile(dir+'/stage-'+String(i).padStart(2,'0')+'.png',Buffer.from(probe.images[i].split(',')[1],'base64'));
  assert.ok(row.frames.every(f=>f.earScale===1&&f.earScaleY===1),'ear anatomy never scales or stretches');assert.ok(row.frames.every(f=>f.protected.every(b=>f.slot.x+f.slot.width<=b.x||f.slot.x>=b.x+b.width||f.slot.y+f.slot.height<=b.y||f.slot.y>=b.y+b.height)),'ear stage stays clear of real faces and score');row.command=actual.journal[0];row.savedOnce=true;row.stageMilliseconds=row.frames.at(-1).at-row.frames[0].at;row.cleaned=await p.evaluate(()=>!window.__harness.game.scene.getScene('game').view.root?.getByName('hero/liue-listening-stage'));assert.ok(row.cleaned);assert.deepEqual(row.errors,[]);
  await p.screenshot({path:dir+'/after.png'});row.status='PASS';console.log(key+' PASS '+Math.round(row.stageMilliseconds)+'ms');
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);await p.screenshot({path:dir+'/FAIL.png'});throw e;}finally{const video=p.video();await context.close();await rename(await video.path(),dir+'/process.webm');await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
