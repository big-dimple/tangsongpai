import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openMenuSection} from './ui.mjs';

const variant=process.env.Q1_VARIANT??'after',out=resolve(process.env.Q1_OUT??'shots/q1-six-hero/'+variant),port=5719;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve('shots/q1-vite'),optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null},logLevel:'error'});await server.listen();
const {localPayoffFixture}=await server.ssrLoadModule('/harness/fixtures/hero-local-payoff.ts'),{makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts'),{applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const report={variant,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Current identity; validated controlled checkpoint bootstrap before app launch, actual pointer/touch skill choices and play/discard. No domain/draft/presentation injection after startup. Software Chromium; not natural acquisition, physical phone/GPU, hearing or user acceptance.',sourceHashes:{},cases:[],status:'RUNNING'};
for(const name of ['GameScene','HeroTargetAttachment','HeroScoreStrike','JokerScoreStrike','HeroScoreAction','ScorePhrase','XinRefillSequence','SushiMultiplierFloat','SushiKingCharge']){try{report.sourceHashes[name]=createHash('sha256').update(await readFile('src/game/'+name+'.ts')).digest('hex');}catch{}}
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});report.browser=browser.version();
const snapshot=page=>page.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal};});
try{for(const phone of [false,true])for(const hero of ['amo','erxiang','laohuan','touye','azao','xiemu']){
 const key=(phone?'390':'1366')+'-'+hero;if(process.env.Q1_CASES&&!process.env.Q1_CASES.split(',').includes(key))continue;
 const dir=resolve(out,key);await mkdir(dir,{recursive:true});const viewport={width:phone?390:1366,height:phone?844:768},row={key,hero,viewport,errors:[],status:'RUNNING'};report.cases.push(row);
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:phone,recordVideo:{dir:resolve(dir,'raw'),size:viewport}}),page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>row.errors.push(String(e)));page.on('dialog',d=>d.accept());
 try{
  await page.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:2,reducedMotion:false})));
  const fixture=await localPayoffFixture(hero),checkpoint=makeCheckpoint(fixture.state,[]);assert.ok(readCheckpoint(checkpoint).ok);await writeFile(resolve(dir,'input.json'),JSON.stringify(checkpoint));
  await page.route('**/__q1-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<html><title>Controlled checkpoint setup</title></html>'}));await page.goto('http://127.0.0.1:'+port+'/__q1-bootstrap');
  await page.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
  await page.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(page,'title');await tapUI(page,'title','action/title-continue',phone);await waitScene(page,'game');
  await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});if(await page.locator('.detail-dialog[open]').count())await page.keyboard.press('Escape');
  row.before=await snapshot(page);
  await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game'),p=window.q1Probe={frames:[],shots:{}};const walk=list=>list.flatMap(o=>[...(o.name?.startsWith('hero/')||o.name?.startsWith('score/strike')?[{name:o.name,text:o.text,eventId:o.getData?.('eventId'),targetId:o.getData?.('targetId'),targetIds:o.getData?.('targetIds'),phase:o.getData?.('phase'),bounds:o.getBounds?.()}]:[]),...(o.list?walk(o.list):[])]);let last='';const tick=()=>{if(!s.scene.isActive())return;const objects=walk(s.children.list),event=s.scoreTotal?.getData('eventId'),phase=s.scoreTotal?.getData('eventPhase'),frame={at:performance.now(),event,phase,objects,readouts:[s.scoreHeat,s.scoreMult,s.scoreTotal].map(o=>({text:o.text,alpha:o.alpha,bounds:o.getBounds(),scale:o.scaleX})),cards:[...s.settledCards.values()].map(v=>({id:v.card.id,x:v.container.x,y:v.container.y,sx:v.container.scaleX,sy:v.container.scaleY,motion:v.container.getData('scoreMotionPhase'),strike:v.container.getData('strike'),parent:v.container.parentContainer?.name}))};if(p.frames.length<4000)p.frames.push(frame);if(phase==='impact'&&event&&event!==last){last=event;if(objects.some(o=>o.name==='hero/local-payoff')||s.presentation?.score.events.find(e=>e.eventId===event)?.sourceType==='character')p.shots['impact-'+Object.keys(p.shots).length]=g.canvas.toDataURL('image/png').split('base64,')[1];}if(objects.some(o=>o.name==='hero/xin-refill-lock')&&!p.shots.eyes)p.shots.eyes=g.canvas.toDataURL('image/png').split('base64,')[1];};g.events.on('postrender',tick);p.stop=()=>g.events.off('postrender',tick);});
  for(const id of fixture.selectedIds)await tapUI(page,'game','card/'+id,phone);
  if(['amo','erxiang','azao','xiemu'].includes(hero)){
   await tapUI(page,'game','hero/action-shortcut',phone);const names=await page.locator('dialog[open] button').allTextContents();row.choiceButtons=names;
   const match=hero==='amo'?/本手使用贬谪/:hero==='erxiang'?/第\d+张 · 8♠/:hero==='azao'?/释放.*1.5/:/^付10金/;
   const choice=page.locator('dialog[open]').getByRole('button',{name:match}).first();if(phone)await choice.tap();else await choice.click();
  }
  await page.screenshot({path:resolve(dir,'chosen.png'),scale:'css'});assert.deepEqual(await snapshot(page),row.before,'draft must not change saved state');
  console.log(variant+' '+key+': actual UI');
  if(hero==='laohuan'){
   await tapUI(page,'game','action/discard',phone);await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.pendingRefill&&s.ready&&!s.playing&&s.cardViews.every(v=>!v.dealing);});
   const ids=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return s.pendingRefill.candidateIds.slice(0,s.pendingRefill.required);});for(const id of ids)await tapUI(page,'game','card/'+id,phone);await page.screenshot({path:resolve(dir,'candidates.png'),scale:'css'});
  }
  await tapUI(page,'game','action/play',phone);
  await page.waitForFunction(seq=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.registry.get('runController').state.commandSeq>seq&&(g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation&&!s.refillPresentation);},fixture.state.commandSeq);
  row.after=await snapshot(page);let expected=row.before.state;for(const command of row.after.journal){const result=applyCommand(expected,command);assert.ok(result.ok);expected=result.state;}assert.deepEqual(row.after.state,expected,'UI saved result equals canonical commands');
  const observed=await page.evaluate(()=>{q1Probe.stop();return{frames:q1Probe.frames,shots:q1Probe.shots};});row.frames=observed.frames;for(const [name,data]of Object.entries(observed.shots))await writeFile(resolve(dir,name+'.png'),Buffer.from(data,'base64'));
  await page.screenshot({path:resolve(dir,'settled.png'),scale:'css'});assert.deepEqual(row.errors,[]);row.status='PASS';console.log(variant+' '+key+': PASS');
 }catch(e){row.status='FAIL';row.failure=String(e.stack||e);await page.screenshot({path:resolve(dir,'failure.png'),scale:'css'}).catch(()=>{});throw e;}
 finally{const video=page.video();await context.close();if(video)await rename(await video.path(),resolve(dir,'process.webm'));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}report.status='PASS';}catch(e){report.status='FAIL';throw e;}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();}
