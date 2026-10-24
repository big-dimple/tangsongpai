import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out=resolve(process.env.SIX_SKILL_OUT??'shots/six-hero-skill-stage');await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5741,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const {heroAttachmentIntensityFixture:fixture}=await server.ssrLoadModule('/harness/fixtures/hero-attachment-intensity.ts');
const {currentHeroReceipt}=await server.ssrLoadModule('/tests/fixtures/current-hero-receipt.ts');
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {energySend}=await server.ssrLoadModule('/harness/fixtures/score-energy.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={scope:'Controlled valid checkpoint bootstrap before startup; actual native UI play/discard commands at speed 1, desktop 1366x768 and touch viewport 390x844. Not natural acquisition or physical-device acceptance.',cases:[]};
try{for(const phone of [false,true])for(const hero of ['amo','erxiang','touye','azao','xiemu','laohuan']){
 const key=(phone?'390':'1366')+'-'+hero;if(process.env.SIX_SKILL_CASES&&!process.env.SIX_SKILL_CASES.split(',').includes(key))continue;
 const dir=resolve(out,key+(process.env.SIX_SKILL_MODE?'-'+process.env.SIX_SKILL_MODE:''));await mkdir(dir,{recursive:true});const viewport={width:phone?390:1366,height:phone?844:768},f=fixture(hero);
 if(hero==='laohuan'){let state=createRun({seed:'group-natural-17',runId:'controlled/skill-stage/xin',characterId:hero,rulesVersion:'r2',r2Identity:newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});state=energySend(energySend(state,{type:'LeaveShop'}),{type:'EnterStage'});f.state=state;f.selectedIds=state.handOrder.slice(0,3);}
 if(hero!=='laohuan')f.state=(await currentHeroReceipt(hero)).before;
 const checkpoint=makeCheckpoint(f.state,[]);assert.ok(readCheckpoint(checkpoint).ok);
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:phone,reducedMotion:process.env.SIX_SKILL_MODE==='reduce'?'reduce':'no-preference',recordVideo:{dir:dir+'/raw',size:viewport}}),p=await context.newPage();p.setDefaultTimeout(30000);
 const row={key,contentVersion:f.state.contentVersion,mode:process.env.SIX_SKILL_MODE??'normal',errors:[],frames:[],status:'RUNNING'};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
 try{
  await p.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:false})));
  await p.route('**/__skill-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<html><title>Controlled checkpoint setup</title></html>'}));await p.goto('http://127.0.0.1:5741/__skill-bootstrap');await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);await p.goto('http://127.0.0.1:5741/?harness=1');await waitScene(p,'title');await tapUI(p,'title','action/title-continue',phone);
  await waitScene(p,'game');await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
  for(const id of f.selectedIds)await tapUI(p,'game','card/'+id,phone);
  if(hero==='amo'){await tapUI(p,'game','hero/action-shortcut',phone);await p.getByRole('button',{name:/^本手使用贬谪/}).click();}
  else if(hero!=='laohuan')await p.evaluate(f=>{const s=window.__harness.game.scene.getScene('game');s.erxiangTargetId=f.targetId??null;s.azaoRelease=!!f.action.azaoRelease;s.xiemuBurn=f.action.xiemuBurn??0;s.refreshSelection();},f);
  await p.screenshot({path:dir+'/before.png'});
  await p.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game');window.skillProbe={frames:[],images:[],last:0};const tick=()=>{const stage=s.view.root?.getByName('hero/skill-stage');const focus=s.view.root?.getByName('hero/xin-candidate-focus');if(!stage&&!focus)return;const a=window.skillProbe;const now=performance.now();a.frames.push({at:now,phase:stage?.getData('phase')??'candidate-focus',bounds:stage?.getBounds(),eventId:stage?.getData('eventId')});if(now-a.last>110){a.last=now;a.images.push(g.canvas.toDataURL('image/png'));}};g.events.on('postrender',tick);window.skillProbe.stop=()=>g.events.off('postrender',tick);});
  await tapUI(p,'game',hero==='laohuan'?'action/discard':'action/play',phone);
  await p.waitForFunction(()=>window.skillProbe.frames.length>0);
  if(process.env.SIX_SKILL_MODE==='skip')await p.evaluate(()=>window.__harness.game.scene.getScene('game').fastForward());
  await p.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation&&!s.refillPresentation&&s.cardViews.every(v=>!v.dealing);});
  const actual=await p.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal};});assert.equal(actual.journal.length,1);const canonical=applyCommand(f.state,actual.journal[0]);assert.ok(canonical.ok);assert.deepEqual(actual.state,canonical.state);
  const probe=await p.evaluate(()=>{skillProbe.stop();return {frames:skillProbe.frames,images:skillProbe.images};});row.frames=probe.frames;assert.ok(row.frames.some(f=>f.phase==='charge'));if(process.env.SIX_SKILL_MODE!=='skip'){assert.ok(row.frames.some(f=>f.phase==='strike'));assert.ok(row.frames.some(f=>f.phase==='settle'));if(process.env.SIX_SKILL_MODE!=='reduce')assert.ok(row.frames.at(-1).at-row.frames[0].at>700);}
  for(let i=0;i<probe.images.length;i++)await writeFile(dir+'/stage-'+String(i).padStart(2,'0')+'.png',Buffer.from(probe.images[i].split(',')[1],'base64'));
  row.command=actual.journal[0];row.savedOnce=true;row.stageMilliseconds=row.frames.at(-1).at-row.frames[0].at;row.cleaned=await p.evaluate(()=>!window.__harness.game.scene.getScene('game').view.root?.getByName('hero/skill-stage'));assert.ok(row.cleaned);assert.deepEqual(row.errors,[]);
  await p.screenshot({path:dir+'/after.png'});row.status='PASS';console.log(key+' PASS '+Math.round(row.stageMilliseconds)+'ms');
 }catch(e){row.status='FAIL';row.error=String(e.stack||e);await p.screenshot({path:dir+'/FAIL.png'});throw e;}finally{const video=p.video();await context.close();await rename(await video.path(),dir+'/process.webm');await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
}}finally{await browser.close();await server.close();await writeFile(out+'/report.json',JSON.stringify(report,null,2));}
