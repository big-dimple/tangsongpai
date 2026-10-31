/** Five owned jokers, actual saved high-multiplier event and visual observation. */
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out=resolve(process.env.FULLRACK_OUT??'shots/hero-high-aura-fullrack');
const port=Number(process.env.FULLRACK_PORT??5783);
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:`/tmp/tsp-fullrack-vite-${port}`,optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
let fixtureServer=server,legacyDirectory,legacyCommit;
if(process.env.FULLRACK_LEGACY_REF){
 legacyCommit=execFileSync('git',['rev-parse',`${process.env.FULLRACK_LEGACY_REF}^{commit}`],{encoding:'utf8'}).trim();
 legacyDirectory=await mkdtemp(join(tmpdir(),'tsp-fullrack-legacy-'));
 const archive=execFileSync('git',['archive','--format=tar',legacyCommit],{maxBuffer:256*1024*1024});
 execFileSync('tar',['-xf','-','-C',legacyDirectory],{input:archive});
 await symlink(resolve('node_modules'),join(legacyDirectory,'node_modules'),'dir');
 fixtureServer=await createServer({root:legacyDirectory,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom',logLevel:'error'});
}
const {createRun}=await fixtureServer.ssrLoadModule('/src/domain/run.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await fixtureServer.ssrLoadModule('/src/game/RunLaunch.ts');
const {energySend}=await fixtureServer.ssrLoadModule('/harness/fixtures/score-energy.ts');
const {r2CreateJoker}=await fixtureServer.ssrLoadModule('/src/domain/r2Run.ts');
const {makeCheckpoint}=await fixtureServer.ssrLoadModule('/src/application/checkpoint.ts');
const {readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
let state=createRun({seed:'five-aura-1',runId:'controlled/five-aura',characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
state=energySend(energySend(state,{type:'LeaveShop'}),{type:'EnterStage'});
// A controlled public hand and inventory, not natural shop acquisition; the
// actual checkpoint is validated and all later inputs and scoring are real.
state.handOrder=['spades-8','hearts-8','clubs-7','diamonds-7','spades-13','hearts-13','clubs-2','diamonds-4'];
state.drawPile=state.deckInstances.map(c=>c.id).filter(id=>!state.handOrder.includes(id));state.gold=40;
state.jokers=['pengci','jiedongfeng','b04','f09','e08'].map((id,i)=>r2CreateJoker(id,`controlled/five/${i}`,8,'none',state));
state.stage.initialJokerIds=state.jokers.map(j=>j.instanceId);
// Five played cards also exercise the narrow space below the score panel.
const selectedIds=state.handOrder.slice(0,process.env.FULLRACK_PLAY_FIVE==='0'?2:5),checkpoint=makeCheckpoint(state,[]);assert.ok(readCheckpoint(checkpoint).ok);
const oracle=applyCommand(state,{runId:state.runId,commandId:'controlled/five/oracle',expectedSeq:state.commandSeq,action:{type:'PlayHand',selectedIds,erxiangTargetId:selectedIds[0]}});
assert.ok(oracle.ok,'controlled hand must be a legal real command');
assert.ok(oracle.state.lastTrace.events.some(e=>e.reasonKey==='erxiang.handoff'&&BigInt(e.before.M.n)<10n*BigInt(e.before.M.d)&&BigInt(e.after.M.n)>=10n*BigInt(e.after.M.d)));
const all=[{name:'pc',width:1366,height:768,phone:false},{name:'phone390',width:390,height:844,phone:true},{name:'phone320',width:320,height:568,phone:true}];
const names=(process.env.FULLRACK_VIEWPORTS??'pc,phone390,phone320').split(',');
const modes=(process.env.FULLRACK_MODES??'normal').split(',');
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={scope:'Validated controlled five-joker inventory and public hand; actual GameScene, native skill/play input, saved score events and post-mix browser audio. Chromium software emulation; not natural acquisition, live site, physical hardware, human listening or aesthetic acceptance.',legacyCommit:legacyCommit??null,cases:[]};
try {
 for(const spec of all.filter(x=>names.includes(x.name)))for(const mode of modes){
  const row={...spec,mode,errors:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:1,hasTouch:spec.phone,reducedMotion:mode==='reduced'?'reduce':'no-preference'}),page=await context.newPage();
  page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error)));
  try {
   await page.addInitScript(mode=>{
    const speed=mode==='speed2'?2:mode==='speed4'?4:1;
    localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed,reducedMotion:mode==='reduced'}));
    localStorage.setItem('tangsongpai-audio-v2',JSON.stringify({version:2,music:0,sfx:mode==='muted'?0:.8}));
    const original=AudioContext.prototype.createWaveShaper;
    AudioContext.prototype.createWaveShaper=function(...args){const node=original.apply(this,args);window.__fullrackCeiling=node;return node;};
   },mode);
   await page.route('**/__fullrack-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>controlled checkpoint</title>'}));
   await page.goto(`http://127.0.0.1:${port}/__fullrack-bootstrap`);
   await page.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
   await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');await tapUI(page,'title','action/title-continue',spec.phone);await waitScene(page,'game');
   await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});
   if(await page.locator('.detail-dialog[open]').count())await page.keyboard.press('Escape');
   const before=await page.evaluate(()=>window.__harness.game.registry.get('runController').state);assert.equal(before.jokers.length,5);assert.deepEqual(before.handOrder,state.handOrder);
   await page.screenshot({path:resolve(out,`${spec.name}-${mode}-before.png`)});
   for(const id of selectedIds)await tapUI(page,'game','card/'+id,spec.phone);
   await tapUI(page,'game','hero/action-shortcut',spec.phone);
   const index=before.handOrder.indexOf(selectedIds[0])+1,choice=page.getByRole('button',{name:new RegExp('^第'+index+'张 · ')});if(spec.phone)await choice.tap();else await choice.click();
   await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.audio?.context?.state==='running'&&window.__fullrackCeiling;});
   await page.evaluate(()=>{
    const g=window.__harness.game,s=g.scene.getScene('game'),engine=s.audio,dest=engine.context.createMediaStreamDestination();window.__fullrackCeiling.connect(dest);
    const capture=g.canvas.captureStream(25),stream=new MediaStream([...capture.getVideoTracks(),...dest.stream.getAudioTracks()]),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus'}),chunks=[];
    recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
    const p=window.__fullrack={recorder,chunks,stream,dest,frames:[],sources:[],shots:{},events:[],fires:[]};
    const originalEvent=s.showScoreEvent;s.showScoreEvent=function(event,...args){p.events.push({at:performance.now(),eventId:event.eventId});return originalEvent.call(this,event,...args);};
    const originalFire=engine.playHighMultiplierFire;engine.playHighMultiplierFire=function(options){const result=originalFire.call(this,options);p.fires.push({at:performance.now(),active:[...this.voices].some(v=>v.highMultiplierFire)});return result;};
    const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);
    p.tick=()=>{if(!s.scene.isActive())return;const objects=walk(s.view.root?.list??[]),current=objects.find(o=>o.name==='hero/target-current'&&o.active&&o.visible&&(o.getData('stats')?.electricSegments??0)>0);if(current){const stats=current.getData('stats');const progress=current.getData('progress');p.sources.push({at:performance.now(),eventId:current.getData('eventId'),progress,front:stats.front,head:stats.electricHeads?.[0],route:stats.route,burstSegments:stats.sourceBurstSegments??0,fallbackSegments:stats.scoreFallbackSegments??0});if(!p.shots.current)p.shots.current=g.canvas.toDataURL('image/png').split('base64,')[1];for(const [label,threshold] of [['ignite',.08],['advance',.35],['approach',.63],['arrival',.83]])if(progress>=threshold&&!p.shots[label])p.shots[label]=g.canvas.toDataURL('image/png').split('base64,')[1];if(stats.scoreFallbackSegments>0&&!p.shots.fallback)p.shots.fallback=g.canvas.toDataURL('image/png').split('base64,')[1];}const a=objects.find(o=>o.name==='score/high-multiplier-aura'&&o.active&&o.visible);if(!a)return;const count=a.getData('visibleSegments')??0;p.frames.push({at:performance.now(),elapsed:a.getData('elapsed'),segments:count,eventId:a.getData('eventId'),eventCount:p.events.length,fireVoices:[...engine.voices].filter(v=>v.highMultiplierFire).length});if(count>0&&!p.shots.first)p.shots.first=g.canvas.toDataURL('image/png').split('base64,')[1];if(count>0&&a.getData('elapsed')>=600&&!p.shots.peak)p.shots.peak=g.canvas.toDataURL('image/png').split('base64,')[1];if(count>0&&p.events.length>=2&&!p.shots.scoring)p.shots.scoring=g.canvas.toDataURL('image/png').split('base64,')[1];};g.events.on('postrender',p.tick);
   });
   await tapUI(page,'game','action/play',spec.phone);
   await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,before.commandSeq);
   const after=await page.evaluate(()=>window.__harness.game.registry.get('runController').state),crossing=after.lastTrace.events.find(e=>e.reasonKey==='erxiang.handoff'&&BigInt(e.before.M.n)<10n*BigInt(e.before.M.d)&&BigInt(e.after.M.n)>=10n*BigInt(e.after.M.d));assert.ok(crossing);
   assert.equal(after.lastTrace.finalScore,oracle.state.lastTrace.finalScore,'presentation must preserve the canonical domain score');
   if(mode==='skip'){await page.waitForFunction(()=>window.__fullrack.frames.some(f=>f.segments>0));await page.evaluate(()=>window.__harness.game.scene.getScene('game').fastForward());}
   if(mode==='speedchange'){
    await page.waitForFunction(()=>window.__fullrack.frames.some(f=>f.segments>0));
    row.speedChangeClean=await page.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts');gameSession().preferences(4,false);const s=window.__harness.game.scene.getScene('game');return !s.view.root?.getByName('score/high-multiplier-aura');});
    assert.equal(row.speedChangeClean,true,'changing speed releases the existing visual immediately');
   }
   await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation;});
   const result=await page.evaluate(async()=>{const g=window.__harness.game,p=window.__fullrack,s=g.scene.getScene('game');g.events.off('postrender',p.tick);await new Promise(resolve=>{p.recorder.onstop=resolve;p.recorder.stop();});const bytes=[...new Uint8Array(await new Blob(p.chunks,{type:'video/webm'}).arrayBuffer())];for(const t of p.stream.getTracks())t.stop();window.__fullrackCeiling.disconnect(p.dest);return{bytes,frames:p.frames,sources:p.sources,events:p.events,fires:p.fires,voices:[...s.audio.voices].filter(v=>v.highMultiplierFire).length,shots:p.shots};});
   await writeFile(resolve(out,`${spec.name}-${mode}.webm`),Buffer.from(result.bytes));for(const [k,v]of Object.entries(result.shots))await writeFile(resolve(out,`${spec.name}-${mode}-${k}.png`),Buffer.from(v,'base64'));
   row.frames=result.frames;row.sources=result.sources;row.events=result.events;row.fires=result.fires;row.remainingFireVoices=result.voices;row.score=after.lastTrace.finalScore;row.crossing=crossing.eventId;
   if(mode==='reduced')assert.equal(result.frames.length,0,'reduced motion has no animated aura');else assert.ok(result.frames.some(f=>f.segments>0),'full rack must not eliminate every flame');
   if(mode==='normal'){
    assert.ok(result.sources.some(s=>s.eventId===crossing.eventId),'full rack needs a visible source cue for the actual committed event');
    const visible=result.frames.filter(f=>f.segments>0);assert.ok(result.events.length>1);
    assert.ok(visible[0].at<result.events[0].at,'flames start before the first actual scoring event');
    assert.ok(visible.at(-1).at>=result.events.at(-1).at,'flames persist through the last scoring event');
    assert.ok(result.fires.some(f=>f.active),'the fire audio voice actually started');
    assert.ok(visible.filter(f=>f.at>=result.fires[0].at&&f.at<=result.events.at(-1).at).every(f=>f.fireVoices===1),'the fire stays active through the scoring events');
   }
   assert.ok(result.frames.every(f=>f.fireVoices<=1),'the fire audio must not stack');
   assert.equal(result.voices,0,'no fire voice remains after presentation');
   if(mode==='muted')assert.ok(result.fires.every(f=>!f.active),'muted fire does not start an audio voice');
   assert.deepEqual(row.errors,[]);row.status='PASS';console.log(`${spec.name}-${mode} PASS score=${row.score} frames=${row.frames.length}`);
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);console.error(row.error);await page.screenshot({path:resolve(out,`${spec.name}-${mode}-failure.png`)}).catch(()=>{});}
  finally{await context.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
 }
}finally{await browser.close();if(fixtureServer!==server)await fixtureServer.close();await server.close();if(legacyDirectory)await rm(legacyDirectory,{recursive:true,force:true});await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
if(report.cases.some(c=>c.status!=='PASS'))process.exitCode=1;
