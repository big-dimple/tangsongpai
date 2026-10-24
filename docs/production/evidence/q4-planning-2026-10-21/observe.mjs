/** Bounded read-only review: four surfaces, one short and one long real PlayHand. */
import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openSelector,confirmHeroRoute} from '../../../../harness/ui.mjs';
const out=new URL('./',import.meta.url).pathname;await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5794,strictPort:true,hmr:false,watch:null},logLevel:'error'});await server.listen();
const {currentHeroReceipt}=await server.ssrLoadModule('/tests/fixtures/current-hero-receipt.ts');
const {r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={taskId:'P08',testedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Stable main source, e2e observers; native mouse/touch/DOM input. Controlled valid current-identity checkpoints, not natural acquisition/balance or human/device/hearing approval.',status:'RUNNING',cases:[],surfaces:[],hearing:'NOT_RUN',priorAttempts:[{status:'FAIL',action:'first video context startup',reason:'Playwright ffmpeg cache missing; system /usr/bin/ffmpeg exists',commandsPlayed:0,resolution:'PLAYWRIGHT_BROWSERS_PATH=/tmp/q4-browsers, ffmpeg-1011/ffmpeg-linux symlink to installed system binary; no source change'}]};
const compactReport=()=>{const result=structuredClone(report);for(const c of result.cases){const o=c.observation;if(!o?.frames)continue;const frames=o.frames,impacts=o.calls.filter(x=>x.name==='consumePerformance'&&x.phase==='impact'),matches=[];for(const x of impacts){const fs=frames.filter(f=>f.score.some(t=>t.eventId===x.eventId));if(fs.length){const f=fs.reduce((a,b)=>Math.abs(a.at-x.at)<Math.abs(b.at-x.at)?a:b);matches.push({eventId:x.eventId,cueAt:x.at,frameAt:f.at,deltaMs:Math.abs(f.at-x.at),visibleNumbers:f.score.map(t=>t.text)});}}c.alignment={impacts:impacts.length,matchedNumericEventIds:matches.length,nearestSampleMaxMs:Math.max(...matches.map(m=>m.deltaMs)),samplingLimitMs:80,scope:'same-event scheduling, not audible/physical latency',matches};o.sampleCount=frames.length;o.visualPhaseTransitions=[];let last;for(const f of frames){const phase=f.skill??f.scene;if(phase!==last)o.visualPhaseTransitions.push({at:f.at,phase});last=phase;}delete o.frames;}return result;};
const save=()=>writeFile(out+'index.json',JSON.stringify(compactReport(),null,2)+'\n');
const settled=p=>p.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&!s.refillPresentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});
try{
 // Actual title -> hero -> route -> shop. This separate route does not play a hand.
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await c.newPage();p.setDefaultTimeout(60000);
 await p.goto('http://127.0.0.1:5794/?harness=1');await openSelector(p,true);await tapUI(p,'character-select','character/erxiang',true);await p.screenshot({path:out+'01-selection-390.png'});report.surfaces.push({surface:'selection',viewport:'390x844',input:'title start -> select Liu E',file:'01-selection-390.png'});
 await confirmHeroRoute(p,true);await waitScene(p,'shop');await p.waitForFunction(()=>document.fonts.status==='loaded');await p.screenshot({path:out+'02-preparation-390.png'});report.surfaces.push({surface:'preparation',viewport:'390x844',input:'confirm hero -> group route -> confirm',file:'02-preparation-390.png'});await c.close();
 for(const spec of [{key:'short',width:390,height:844,touch:true},{key:'long',width:1366,height:768,touch:false}]){
  const row={key:spec.key,errors:[],audioResources:[],status:'RUNNING'};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,recordVideo:{dir:out+'raw',size:{width:spec.width,height:spec.height}}}),p=await context.newPage();p.setDefaultTimeout(90000);
  p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());p.on('response',r=>{if(/assets\/audio\//.test(r.url()))row.audioResources.push({file:r.url().split('/assets/')[1],status:r.status()});});
  try{
   const f=await currentHeroReceipt('erxiang');let before=f.before;const ids=spec.key==='short'?['spades-8','hearts-8']:['spades-8','hearts-8','clubs-7','diamonds-7'];
   if(spec.key==='long'){
    // Reuse existing families and stock values; controlled ownership disclosed, no balance edits.
    before.jokers=['b06','f09','e03','mantangcai','b08'].map((id,i)=>r2CreateJoker(id,'controlled/q4/'+id,8,i===0?'holographic':'none',before));
    before.stage.initialJokerIds=before.jokers.map(j=>j.instanceId);
    Object.assign(before.deckInstances.find(c=>c.id===ids[0]),{enhancement:'multiplier-paper',edition:'polychrome'});
   }
   const cp=makeCheckpoint(before,[]);assert.ok(readCheckpoint(cp).ok);row.contentVersion=before.contentVersion;row.contentHash=before.contentHash;row.controlled={gold:before.gold,jokers:before.jokers.map(j=>({definitionId:j.definitionId,growth:j.growth,edition:j.edition})),enhancedCards:before.deckInstances.filter(c=>c.enhancement||c.edition).map(c=>({id:c.id,enhancement:c.enhancement,edition:c.edition}))};
   await p.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:false})));
   await p.route('**/__q4-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<html><title>Controlled checkpoint</title></html>'}));await p.goto('http://127.0.0.1:5794/__q4-bootstrap');await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},cp);await p.goto('http://127.0.0.1:5794/?harness=1');await waitScene(p,'title');await tapUI(p,'title','action/title-continue',spec.touch);await waitScene(p,'game');await settled(p);if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
   for(const id of ids)await tapUI(p,'game','card/'+id,spec.touch);
   await tapUI(p,'game','hero/action-shortcut',spec.touch);await p.getByRole('button',{name:/^(已选 )?第1张 · 8♠$/}).click();await p.waitForFunction(()=>!document.querySelector('dialog[open]'));
   await p.screenshot({path:out+(spec.key==='short'?'03-table-390.png':'05-long-before-1366.png')});
   await p.evaluate(async()=>{const {AudioEngine}=await import('/src/audio/AudioEngine.ts'),a=AudioEngine.shared,g=window.__harness.game;window.q4={calls:[],frames:[],start:performance.now(),last:0,originals:{}};
    for(const name of ['consumePerformance','scoreImpact','scoreRebound','success','setScene']){if(typeof a[name]!=='function')continue;const original=a[name];q4.originals[name]=original;a[name]=function(...args){q4.calls.push({name,at:performance.now(),eventId:typeof args[1]==='string'?args[1]:args[0]?.eventId,phase:args[0]?.phase,kind:args[2],audioTime:a.context?.currentTime,context:a.context?.state,scene:typeof args[0]==='string'?args[0]:undefined});return original.apply(this,args);};}
    const tick=()=>{const s=g.scene.getScene('game'),now=performance.now();if(now-q4.last<80)return;q4.last=now;const score=[s.scoreHeat,s.scoreMult,s.scoreTotal].filter(Boolean).map(t=>({text:t.text,eventId:t.getData('eventId'),phase:t.getData('eventPhase'),box:t.getBounds()}));q4.frames.push({at:now,score,skill:s.view.root?.getByName('hero/liue-listening-stage')?.getData('phase'),scene:g.scene.isActive('intermission')?'intermission':'game'});};g.events.on('postrender',tick);q4.stop=()=>g.events.off('postrender',tick);
   });
   const start=Date.now();await tapUI(p,'game','action/play',spec.touch);await p.waitForFunction(()=>window.q4.frames.some(f=>f.skill));await p.screenshot({path:out+(spec.key==='short'?'04-short-impact-390.png':'06-long-impact-1366.png')});await settled(p);row.durationMs=Date.now()-start;
   const actual=await p.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal};});assert.equal(actual.journal.length,1);const canonical=applyCommand(before,actual.journal[0]);assert.ok(canonical.ok);assert.deepEqual(actual.state,canonical.state);row.command=actual.journal[0];row.finalScore=actual.state.lastTrace.finalScore;row.phase=actual.state.phase;row.events=actual.state.lastTrace.events.map(e=>({eventId:e.eventId,sourceType:e.sourceType,sourceDefinitionId:e.sourceDefinitionId,operation:e.operation,value:e.value,phase:e.phase}));
   row.observation=await p.evaluate(async()=>{q4.stop();const {AudioEngine}=await import('/src/audio/AudioEngine.ts'),a=AudioEngine.shared;return {calls:q4.calls,frames:q4.frames,context:a.context?.state,decodedSampleCount:a.scoreSamples?.size,musicTitle:a.musicTitle,musicElements:a.musicSlots?.map(s=>({path:s.path,ready:s.element.readyState,paused:s.element.paused,time:s.element.currentTime})),liveVoices:a.voices?.size,skillClean:!window.__harness.game.scene.getScene('game').view.root?.getByName('hero/liue-listening-stage')};});
   assert.equal(row.errors.length,0);assert.ok(row.observation.skillClean);row.status='PASS';await p.screenshot({path:out+(spec.key==='long'?'07-result-1366.png':'short-after-390.png')});
   if(spec.key==='long')report.surfaces.push({surface:'result',viewport:'1366x768',phase:row.phase,file:'07-result-1366.png'});
  }catch(e){row.status='FAIL';row.error=String(e.stack||e);await p.screenshot({path:out+spec.key+'-FAIL.png'});throw e;}finally{const video=p.video();await context.close();await rename(await video.path(),out+spec.key+'-process.webm');await save();}
 }
 report.surfaces.push({surface:'table',viewport:'390x844',file:'03-table-390.png'});report.status='PASS';
}catch(e){report.status='FAIL';report.error=String(e.stack||e);process.exitCode=1;}finally{await browser.close();await server.close();await save();console.log(JSON.stringify({status:report.status,error:report.error,cases:report.cases.map(c=>({key:c.key,status:c.status,score:c.finalScore,duration:c.durationMs,events:c.events?.length}))}));}
