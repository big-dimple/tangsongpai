import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from '/workspace/tangsongpai/node_modules/vite/dist/node/index.js';
import {chromium} from '/workspace/tangsongpai/node_modules/playwright/index.mjs';
import {tapUI,waitScene,openRunMenu,toggleRunMenu,point} from '/workspace/tangsongpai/harness/ui.mjs';

const out=resolve(process.env.LIUE_PAYOFF_OUT??'/tmp/liue-skill-payoff'),port=5745;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const {liueSkillPayoffFixture}=await server.ssrLoadModule('/harness/fixtures/liue-skill-payoff.ts'),{applyCommand}=await server.ssrLoadModule('/src/domain/run.ts'),{makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu']});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}),browser:browser.version(),scope:'Controlled valid current-identity checkpoints, IndexedDbSave bootstrap then real continue/selection/skill/cancel/play/menu input. Local Chromium software GPU. Lifecycle blur/hidden/scene-stop/destroy explicitly injected. No deployed site, natural acquisition, physical-device, hearing or aesthetic acceptance.',cases:[]};
const normal=[1366,390].flatMap(width=>[8,10].map(points=>({width,points,mode:'normal'})));
const checks=['skip','reduce','live-reduce','resize','blur','hidden','exit','destroy','special','replay','speed4'].map(mode=>({width:390,points:mode==='special'?10:mode==='replay'?2:8,mode}));
let specs=process.env.LIUE_PAYOFF_MODE==='checks'?checks:normal;
if(process.env.LIUE_PAYOFF_CASES)specs=specs.filter(s=>process.env.LIUE_PAYOFF_CASES.split(',').includes(s.width+'-'+s.points+'-'+s.mode));
const snapshot=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};});
const settled=p=>p.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
const clean=p=>p.evaluate(()=>{const s=window.__harness.game.scene.keys.game;if(!s)return true;return !s.view?.root?.active||!s.view.root.getByName('hero/liue-skill-flight')&&!s.view.root.getByName('hero/liue-listening-stage')&&!(s.heroActionButton?.active&&s.heroActionButton.getData('liueSkillPayoff'));});
try{for(const spec of specs){
 const {width,points,mode}=spec,key=width+'-'+points+'-'+mode,touch=width<600,viewport={width,height:touch?844:768},dir=out+'/'+key;await mkdir(dir,{recursive:true});
 const fixture=await liueSkillPayoffFixture(points,mode==='special'),checkpoint=makeCheckpoint(fixture.state,[]);assert.ok(readCheckpoint(checkpoint).ok);
 const context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:mode==='reduce'?'reduce':'no-preference',recordVideo:{dir:dir+'/raw',size:viewport}}),p=await context.newPage(),row={...spec,key,errors:[]};report.cases.push(row);p.setDefaultTimeout(45000);p.on('pageerror',e=>row.errors.push(String(e.stack||e)));p.on('dialog',d=>d.accept());
 try{
  await p.addInitScript(speed=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed,reducedMotion:false})),mode==='speed4'?4:1);
  await p.route('**/__liue-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<title>Controlled checkpoint setup</title>'}));await p.goto('http://127.0.0.1:'+port+'/__liue-bootstrap');
  await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
  await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'game');await settled(p);if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
  for(const id of fixture.selectedIds)await tapUI(p,'game','card/'+id,touch);
  const before=await snapshot(p);assert.deepEqual(before.state,fixture.state);
  const choose=async()=>{await tapUI(p,'game','hero/action-shortcut',touch);const b=p.getByRole('button',{name:new RegExp('^(已选 )?第\\d+张 · '+(points===10?'K':String(points))+'♠$')});if(touch)await b.tap();else await b.click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));};
  await choose();assert.ok(await clean(p));await tapUI(p,'game','hero/action-shortcut',touch);await p.getByRole('button',{name:'取消本手选牌',exact:true}).click();assert.ok(await clean(p));assert.deepEqual(await snapshot(p),before);
  await choose();await tapUI(p,'game','card/'+fixture.targetId,touch);assert.ok(await p.evaluate(()=>!window.__harness.game.scene.getScene('game').erxiangTargetId));await tapUI(p,'game','card/'+fixture.targetId,touch);await choose();
  await p.screenshot({path:dir+'/before-play.png'});
  await p.evaluate(targetId=>{const g=window.__harness.game,s=g.scene.getScene('game');window.liueProbe={frames:[],images:{},seen:new Set()};const tick=()=>{const a=window.liueProbe,flight=s.view?.root?.getByName('hero/liue-skill-flight'),ear=s.view?.root?.getByName('hero/liue-listening-stage'),token=s.heroActionButton?.getData('liueSkillPayoff');if(!flight&&!ear&&!token)return;
   const packet=flight?.getByName('hero/liue-skill-packet'),source=s.settledCards.get(targetId),label=s.heroActionButton?.getData('label'),phase=flight?.getData('phase')??(token?.arrived?'settled':'reduced'),bounds=o=>{const b=o?.getBounds();return b&&{x:b.x,y:b.y,width:b.width,height:b.height};};
   const row={at:performance.now(),phase,eventId:token?.eventId,targetId:token?.targetId,amount:token?.amount,arrived:token?.arrived,progress:flight?.getData('progress'),origin:flight?.getData('origin'),destination:flight?.getData('destination'),packet:packet&&{text:packet.text,visible:packet.visible,alpha:packet.alpha,x:packet.x,y:packet.y,bounds:bounds(packet)},source:source&&{id:source.card.id,active:source.container.active,alpha:source.container.alpha,visible:source.container.visible,bounds:bounds(source.container)},label:label&&{text:label.text,bounds:bounds(label)},button:bounds(s.heroActionButton),M:s.scoreMult?.text,earScale:ear&&[ear.getByName('hero/liue-listening-ear')?.scaleX,ear.getByName('hero/liue-listening-ear')?.scaleY]};
   a.frames.push(row);a.seen.add(token?.eventId);if(!a.images[phase]&&(phase!=='charge'||row.progress>.55))a.images[phase]=g.canvas.toDataURL('image/png');};g.events.on('postrender',tick);window.liueProbe.stop=()=>g.events.off('postrender',tick);},fixture.targetId);
  // Real repeated pointer input while the first saved hand is presenting.
  const play=await point(p,'game','action/play');if(touch){await p.touchscreen.tap(play.x,play.y);await p.touchscreen.tap(play.x,play.y);}else await p.mouse.dblclick(play.x,play.y,{delay:35});
  await p.waitForFunction(()=>window.liueProbe.frames.length>0);
  if(mode==='skip')await p.evaluate(()=>window.__harness.game.scene.getScene('game').fastForward());
  if(mode==='live-reduce'){await openRunMenu(p,touch);await p.getByLabel('减少动态',{exact:false}).check();await toggleRunMenu(p,touch);}
  if(mode==='resize'){await p.setViewportSize({width:392,height:842});await p.setViewportSize(viewport);}
  if(mode==='blur'){await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(150);assert.ok(await p.evaluate(()=>!window.__harness.game.scene.getScene('game').view.root.getByName('hero/liue-skill-flight')));}
  if(mode==='hidden')await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  if(mode==='exit')await p.evaluate(()=>window.__harness.game.scene.getScene('game').scene.stop());
  if(mode==='destroy')await p.evaluate(()=>window.__harness.game.scene.remove('game'));
  if(!['exit','destroy'].includes(mode))await settled(p);else await p.waitForTimeout(250);
  const actual=await snapshot(p);assert.equal(actual.journal.length,1);const canonical=applyCommand(fixture.state,actual.journal[0]);assert.ok(canonical.ok);assert.deepEqual(actual.state,canonical.state);assert.ok(readCheckpoint(actual.storage.current).ok);
  const event=actual.state.lastTrace.events.find(e=>e.reasonKey==='erxiang.handoff');assert.equal(event.value.n,String(points));assert.equal(event.targetCardId,fixture.targetId);assert.equal(actual.state.lastTrace.events.filter(e=>e.reasonKey==='erxiang.handoff').length,1);assert.ok(!actual.state.discardPile.includes(fixture.targetId)&&!actual.state.destroyedIds.includes(fixture.targetId));
  const probe=await p.evaluate(()=>{liueProbe.stop();return {frames:liueProbe.frames,images:liueProbe.images,seen:[...liueProbe.seen]};});row.frames=probe.frames;row.savedEvent=event;row.finalAccumulator=actual.state.lastTrace.accumulator;row.finalScore=actual.state.lastTrace.finalScore;row.journal=actual.journal;row.revision=actual.storage.revision;row.checkpoint=actual.storage.current;row.phases=[...new Set(probe.frames.map(f=>f.phase))];
  assert.ok(probe.frames.every(f=>!f.earScale||f.earScale.every(s=>s===1)));assert.ok(probe.frames.every(f=>!f.source||f.source.active&&f.source.alpha>0&&f.source.visible));assert.deepEqual(probe.seen,[event.eventId]);
  if(['normal','special','resize'].includes(mode)){for(const phase of ['charge','flight','impact','settled'])assert.ok(row.phases.includes(phase),phase+' observed');assert.ok(probe.frames.some(f=>f.label?.text==='听政 +'+points+'倍率'&&f.arrived));assert.ok(probe.frames.some(f=>f.packet?.visible&&f.packet.text==='+'+points+' 倍率'));assert.ok(probe.frames.filter(f=>f.phase==='flight').length>=2);}
  if(mode==='reduce')assert.ok(probe.frames.every(f=>!f.packet));
  if(mode==='special'){assert.ok(actual.state.lastTrace.events.some(e=>e.retriggerDepth===1));assert.ok(actual.state.lastTrace.events.some(e=>e.reasonKey.startsWith('edition.')));}
  for(const [phase,data]of Object.entries(probe.images))await writeFile(dir+'/'+phase+'.png',Buffer.from(data.split(',')[1],'base64'));
  row.cleanup=await p.evaluate(()=>{const s=window.__harness.game.scene.keys.game;if(!s)return {removed:true};return {active:s.scene.isActive(),rootActive:s.view?.root?.active,flight:!!s.view?.root?.getByName('hero/liue-skill-flight'),ear:!!s.view?.root?.getByName('hero/liue-listening-stage'),token:s.heroActionButton?.active?s.heroActionButton.getData('liueSkillPayoff'):undefined};});assert.ok(await clean(p));await p.screenshot({path:dir+'/after-play.png'});
  // Normal rerender + replay must not remount a new transfer or save again.
  if(mode==='replay'){
   const saved=await snapshot(p);await p.evaluate(()=>window.__harness.game.scene.getScene('game').updateControls());assert.ok(await clean(p));
   await p.evaluate(()=>{const g=window.__harness.game;window.replayFlights=0;window.replayTick=()=>{const s=g.scene.getScene('game');if(s.view.root.getByName('hero/liue-skill-flight')||s.heroActionButton.getData('liueSkillPayoff'))window.replayFlights++;};g.events.on('postrender',window.replayTick);});
   await tapUI(p,'game','hero/action-shortcut',touch);await p.getByRole('button',{name:'上一手详情',exact:true}).click();await p.getByRole('button',{name:'回看演出',exact:true}).click();await p.waitForTimeout(120);await settled(p);assert.ok(await clean(p));assert.deepEqual(await snapshot(p),saved);assert.equal(await p.evaluate(()=>{window.__harness.game.events.off('postrender',window.replayTick);return window.replayFlights;}),0);
   row.replay='native replay: no new payoff, save, usage or score';
  }
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log(key+' PASS '+row.phases.join('/')+' score='+row.finalScore);
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);await p.screenshot({path:dir+'/FAIL.png'}).catch(()=>{});throw e;}finally{const video=p.video();await context.close();await rename(await video.path(),dir+'/process.webm');await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');}
}report.status='PASS';}catch(e){report.status='FAIL';report.error=String(e.stack||e);process.exitCode=1;}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
