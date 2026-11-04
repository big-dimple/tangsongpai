import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {tapUI,waitScene} from './ui.mjs';

// Controlled valid checkpoints exercise the real scene and saved command. No manual
// call to the drawing function: a frame counts only when the scene owns the line.
const out=resolve(process.env.HERO_ELECTRIC_OUT??'/tmp/tangsongpai-hero-electric'),port=Number(process.env.HERO_ELECTRIC_PORT??5747);
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve(`/tmp/tangsongpai-electric-vite-${port}`),optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const {heroAttachmentIntensityFixture:fixture}=await server.ssrLoadModule('/harness/fixtures/hero-attachment-intensity.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {applyCommand,createRun}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {energySend}=await server.ssrLoadModule('/harness/fixtures/score-energy.ts');
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??(process.platform==='win32'?undefined:'/usr/bin/chromium'),args:['--disable-gpu','--disable-software-rasterizer']});
const native=process.env.HERO_ELECTRIC_NATIVE!=='0';
const report={scope:'Controlled legal checkpoints, native hero/play inputs and real GameScene save/presentation; Chromium software renderer. Not natural acquisition, physical hardware, listening or aesthetic acceptance.',nativeInput:native,browser:browser.version(),cases:[],status:'RUNNING'};
report.sourceHashes={};for(const path of ['src/game/GameScene.ts','src/game/HeroLineCurrent.ts','src/game/HeroTargetAttachment.ts','src/game/HeroCardAttachmentAtmosphere.ts','src/game/SushiDiscardCardPresentation.ts','src/game/HeroSkillStage.ts','src/game/LiueListeningStage.ts','src/game/XinRefillSequence.ts'])try{report.sourceHashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');}catch(error){if(error.code==='ENOENT')report.sourceHashes[path]='absent';else throw error;}
const heroes=['amo','erxiang','touye','azao','xiemu','laohuan'];
function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
async function difference(a,b,controls,heads,protectedBoxes,protectedPolygons){const x=await sharp(Buffer.from(a,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true}),y=await sharp(Buffer.from(b,'base64')).ensureAlpha().raw().toBuffer();const r={total:0,nearHeads:0,controls:0,protected:0};for(let py=0;py<x.info.height;py++)for(let px=0;px<x.info.width;px++){const i=(py*x.info.width+px)*4;if(Math.max(Math.abs(x.data[i]-y[i]),Math.abs(x.data[i+1]-y[i+1]),Math.abs(x.data[i+2]-y[i+2]))<=8)continue;r.total++;if(heads.some(h=>Math.hypot(px-h.x,py-h.y)<12))r.nearHeads++;if(controls.some(c=>px>=c.x&&px<c.x+c.width&&py>=c.y&&py<c.y+c.height))r.controls++;if(protectedBoxes.some(c=>px>c.x+1&&px<c.x+c.width-1&&py>c.y+1&&py<c.y+c.height-1)||protectedPolygons.some(p=>insidePolygon(px+.5,py+.5,p)))r.protected++;}return r;}
try{for(const phone of [false,true])for(const hero of heroes)for(const mode of (process.env.HERO_ELECTRIC_MODES??'normal').split(',')){
 const key=`${phone?'390':'1366'}-${hero}-${mode}`;if(process.env.HERO_ELECTRIC_CASES&&!process.env.HERO_ELECTRIC_CASES.split(',').includes(key))continue;
 const dir=resolve(out,key);await mkdir(dir,{recursive:true});const f=fixture(hero);if(hero==='azao'&&process.env.HERO_ELECTRIC_FIVE==='1')f.selectedIds=[...f.selectedIds,'clubs-2'];if(hero==='laohuan'&&process.env.HERO_ELECTRIC_XIN_DISCARD==='1'){let state=createRun({seed:'group-natural-17',runId:'controlled/electric/xin',characterId:hero,rulesVersion:'r2',r2Identity:newRunIdentity(hero,'group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});state=energySend(energySend(state,{type:'LeaveShop'}),{type:'EnterStage'});f.state=state;f.selectedIds=state.handOrder.slice(0,3);}const checkpoint=makeCheckpoint(f.state,[]);assert.ok(readCheckpoint(checkpoint).ok);
 const context=await browser.newContext({viewport:{width:phone?390:1366,height:phone?844:768},deviceScaleFactor:1,hasTouch:phone,reducedMotion:mode==='reduce'?'reduce':'no-preference'}),p=await context.newPage(),row={key,errors:[],status:'RUNNING'};report.cases.push(row);p.setDefaultTimeout(30000);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
 try{
  await p.addInitScript(m=>{localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:m==='speed2'?2:m==='speed4'?4:1,reducedMotion:m==='reduce'}));if(m==='muted')localStorage.setItem('tangsongpai-audio-v2',JSON.stringify({version:2,music:0,sfx:0}));},mode);
  await p.route('**/__electric-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<html><title>Controlled checkpoint</title></html>'}));await p.goto(`http://127.0.0.1:${port}/__electric-bootstrap`);await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');await tapUI(p,'title','action/title-continue',phone);await waitScene(p,'game');await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.ready&&!s.playing&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
  if(mode==='muted')assert.deepEqual(await p.evaluate(()=>{const a=window.__harness.game.scene.getScene('game').audio;return [a.getVolume('music'),a.getVolume('sfx')];}),[0,0]);
  const before=await p.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal};});
  await p.evaluate(mode=>{const g=window.__harness.game,s=g.scene.getScene('game'),probe=window.electricProbe={frames:[],samples:[],last:{},pending:null,lockStart:null,lockEnd:null};
   // Capture guards at the rendered pose, after the card landing transform.
   // Never pause the scene clock just to observe pixels.
   const geometry=o=>{
    const m=o.getWorldTransformMatrix(),stats=o.getData('stats')??{electricSegments:o.getData('electricSegments'),electricHeads:o.getData('electricHeads')};
    const heads=(stats.electricHeads??[]).map(q=>{const p=m.transformPoint(q.x,q.y);return{x:p.x,y:p.y};});
    const controls=[s.heroActionButton,s.inventoryButton,s.playButton,s.discardButton,s.rankButton,s.suitButton,s.aiButton].filter(o=>o?.active&&o.visible&&o.input?.enabled).map(o=>{const b=o.getBounds();return {x:b.x,y:b.y,width:b.width,height:b.height};});
    const corners=(b,m)=>[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y])=>{const p=m.transformPoint(x,y);return{x:p.x,y:p.y};});
    const box=points=>{const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};};
    let protectedBoxes,protectedPolygons=[];
    if(o.name==='hero/target-afterglow'&&s.targetAttachment?.glowMaskSupplier){
     const root=s.view.root.getWorldTransformMatrix(),walk=list=>list.flatMap(node=>!node.active||!node.visible||node.alpha<.01?[]:[node,...(node.list?walk(node.list):[])]),cardIds=new Set();
     // A rotated card's world AABB includes empty corner wedges. Protect the
     // real transformed paper polygon instead of labelling that empty space.
     for(const card of walk(s.view.root.list).filter(node=>node.active&&node.visible&&node.getData?.('cardFace'))){
      const body=card.getData('cardBodyRoot'),carrier=body?.active?body:card,width=Number(card.getData('width')),height=Number(card.getData('height'));
      if(!(width>0&&height>0))continue;const cm=carrier.getWorldTransformMatrix(),sum=cm.a*cm.a+cm.b*cm.b+cm.c*cm.c+cm.d*cm.d,det=cm.a*cm.d-cm.b*cm.c,maxScale=Math.sqrt((sum+Math.sqrt(Math.max(0,sum*sum-4*det*det)))/2),minScale=Math.abs(det)/maxScale,pad=1.5/Math.max(.01,minScale);
      cardIds.add(String(card.getData('cardId')));protectedPolygons.push(corners({x:-width/2-pad,y:-height/2-pad,width:width+2*pad,height:height+2*pad},cm));
     }
     protectedBoxes=s.targetAttachment.glowMaskSupplier().filter(b=>!(b.ownerId&&cardIds.has(b.ownerId)&&(b.inkKind==='face'||b.inkKind==='paper'))).map(b=>box(corners(b,root)));
    }else protectedBoxes=(o.getData('protectedBoxes')??[]).map(b=>box(corners(b,m)));
    return{stats,heads,controls,protectedBoxes,protectedPolygons};
   };
   const tick=()=>{
    if(probe.replaying)return;
    if(s.playing&&probe.lockStart===null)probe.lockStart=performance.now();else if(!s.playing&&probe.lockStart!==null&&probe.lockEnd===null)probe.lockEnd=performance.now();
    if(['timing','throttle','normal','muted'].includes(mode)){
     const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]),names=['hero/target-current','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current'];
     // Object visibility, parent alpha and retained draw stats describe a real
     // rendered stroke without changing the presentation's clock or commands.
     const visible=walk(s.view.root?.list??[]).filter(o=>{if(!names.includes(o.name)||!o.active||!o.visible)return false;let a=o;while(a){if(!a.visible||a.alpha<=.1)return false;a=a.parentContainer;}return (o.getData('stats')?.electricSegments??o.getData('electricSegments')??0)>0;}).map(o=>({name:o.name,progress:o.getData('progress'),segments:o.getData('stats')?.electricSegments??o.getData('electricSegments')}));
     probe.samples.push({at:performance.now(),visible:visible.map(o=>o.name),progress:Object.fromEntries(visible.filter(o=>Number.isFinite(o.progress)).map(o=>[o.name,o.progress])),segments:Object.fromEntries(visible.map(o=>[o.name,o.segments])),attachment:{elapsed:s.targetAttachment?.sourceElapsed,visibleFrames:s.targetAttachment?.sourceVisibleFrames,pendingLanding:!!s.targetAttachment?.pendingLanding}});
    }
    if(['skip','destroy','background'].includes(mode)&&!probe.seen&&s.scene.isActive()){const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);probe.seen=walk(s.view.root?.list??[]).some(o=>['hero/target-current','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current'].includes(o.name)&&o.active&&o.visible&&(o.getData('stats')?.electricSegments??o.getData('electricSegments')??0)>0);}
    if(['timing','throttle','skip','skip-afterglow','destroy','repeat','background'].includes(mode)||!s.scene.isActive())return;
    if(mode==='afterglow-impact'&&!probe.arrived){if(s.targetAttachment?.state?.value?.phase!=='release')return;probe.arrived=true;}
    const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]),objects=walk(s.view.root?.list??[]);
    for(const o of objects){
     if(!(mode.startsWith('afterglow')?['hero/target-afterglow']:['hero/target-current','hero/target-afterglow','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current']).includes(o.name))continue;
     const stats=o.getData('stats')??{electricSegments:o.getData('electricSegments'),electricHeads:o.getData('electricHeads')};if(!o.active||!o.visible||!stats?.electricSegments)continue;
     const now=performance.now();if(now-(probe.last[o.name]??-Infinity)<60||probe.frames.filter(f=>f.name===o.name).length>=12)continue;probe.last[o.name]=now;
     const frame={at:now,name:o.name,playing:s.playing,ready:s.ready};Object.assign(frame,geometry(o));frame.on=g.canvas.toDataURL('image/png').split('base64,')[1];
     // Re-render the same scene at the same animation time, solely to obtain
     // an isolated pixel pair. No pause, tween advance or queued resume exists.
     probe.replaying=true;
     const redraw=()=>{const processing=g.scene.isProcessing;g.renderer.preRender();g.scene.render(g.renderer);g.scene.isProcessing=processing;g.renderer.postRender();};
     try{o.setVisible(false);redraw();frame.off=g.canvas.toDataURL('image/png').split('base64,')[1];probe.frames.push(frame);}finally{if(o.active)o.setVisible(true);redraw();probe.replaying=false;}break;
    }
   };
   g.events.on('postrender',tick);probe.stop=()=>g.events.off('postrender',tick);},mode);
  if(mode==='throttle'){const cdp=await context.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});row.cpuThrottle=4;}
  if(native){
   const dom=locator=>phone?locator.tap():locator.click();
   for(const id of f.selectedIds)await tapUI(p,'game','card/'+id,phone);
   if(hero!=='laohuan'){
    await tapUI(p,'game','hero/action-shortcut',phone);
    if(hero==='amo')await dom(p.getByRole('button',{name:/^本手使用贬谪/}));
    if(hero==='erxiang'){const index=before.state.handOrder.indexOf(f.targetId)+1;await dom(p.getByRole('button',{name:new RegExp('^第'+index+'张 · ')}));}
    if(hero==='azao')await dom(p.getByRole('button',{name:/^本手释放 ×/}));
    if(hero==='xiemu')await dom(p.getByRole('button',{name:/10金 ×2/,exact:true}));
   }
   row.nativeInput={hero,selection:f.selectedIds,trigger:hero==='laohuan'?process.env.HERO_ELECTRIC_XIN_DISCARD==='1'?'action/discard':'saved-skill-refill-choice':'hero/action-shortcut'};
  }else await p.evaluate(f=>{const s=window.__harness.game.scene.getScene('game');s.selectedIds=new Set(f.selectedIds);s.erxiangTargetId=f.targetId??null;s.azaoRelease=!!f.action.azaoRelease;s.xiemuBurn=f.action.xiemuBurn??0;s.refreshSelection();},f);
  const preview=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),c=window.__harness.game.registry.get('runController');return {playing:s.playing,ready:s.ready,state:c.state,journal:c.journal};});assert.deepEqual(preview.state,before.state);assert.deepEqual(preview.journal,before.journal);assert.equal(preview.playing,false);assert.equal(preview.ready,true);
  // Repeated view refresh is deliberately not a second command.
  await p.evaluate(()=>window.__harness.game.scene.getScene('game').refreshSelection());
  if(native)await tapUI(p,'game',hero==='laohuan'&&process.env.HERO_ELECTRIC_XIN_DISCARD==='1'?'action/discard':'action/play',phone);
  else if(hero==='amo')await tapUI(p,'game','action/play',phone);else if(hero==='laohuan'&&process.env.HERO_ELECTRIC_XIN_DISCARD==='1')await tapUI(p,'game','action/discard',phone);else await p.evaluate(hero=>{const s=window.__harness.game.scene.getScene('game');if(hero==='laohuan')void s.chooseRefill();else void s.playSelected(true);},hero);
  await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,f.state.commandSeq);
  if(mode==='skip'||mode==='destroy'||mode==='background')await p.waitForFunction(()=>window.electricProbe.seen===true);
  if(mode==='background'){
   row.background=await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));return {simulatedVisibility:true};});
   await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return !s.playing&&!s.presentation;});
   await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(350);
   row.background.noLateReplay=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);return !walk(s.view.root?.list??[]).some(o=>o.active&&['hero/target-current','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current','hero/target-afterglow'].includes(o.name));});assert.ok(row.background.noLateReplay,'background return replayed or retained a hero effect');
   await p.screenshot({path:resolve(dir,'background-restored.png')});
  }
  if(mode==='skip-afterglow'){
   await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game'),walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);return walk(s.view.root?.list??[]).some(o=>o.name==='hero/target-afterglow'&&o.active&&o.visible&&o.getData('electricSegments')>0);});
   row.skippedDuringAfterglow=true;
  }
  if(mode==='skip'||mode==='skip-afterglow')await p.evaluate(()=>window.__harness.game.scene.getScene('game').fastForward());
  if(mode==='destroy'){row.destroyed=await p.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game');s.targetAttachment.destroy();return !s.view.root.getByName('hero/target-current')&&!s.view.root.getByName('hero/sushi-discard-current');});assert.ok(row.destroyed);}
  await p.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.ready&&!s.playing&&!s.presentation&&!s.refillPresentation&&s.cardViews.every(v=>!v.dealing);});
  await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return !s.view.root?.getByName('hero/target-current')&&!s.view.root?.getByName('hero/sushi-discard-current');},null,{timeout:3000});
  const after=await p.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game'),c=g.registry.get('runController');electricProbe.stop();return{state:c.state,journal:c.journal,frames:electricProbe.frames,samples:electricProbe.samples,lockMs:electricProbe.lockStart!==null?(electricProbe.lockEnd??performance.now())-electricProbe.lockStart:null,clean:(()=>{const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);return !walk(s.view.root?.list??[]).some(o=>o.active&&['hero/target-current','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current','hero/target-afterglow'].includes(o.name));})()};});assert.equal(after.journal.length,before.journal.length+1);const canonical=applyCommand(before.state,after.journal.at(-1));assert.ok(canonical.ok);assert.deepEqual(after.state,canonical.state);assert.ok(after.clean);row.command=after.journal.at(-1);row.cleaned=after.clean;row.lockMs=after.lockMs;if(mode==='timing'||mode==='throttle'){row.visibility={};for(const name of new Set(after.samples.flatMap(s=>s.visible))){const frames=after.samples.filter(s=>s.visible.includes(name));let visibleMs=0,runs=0,previous=false;for(let i=0;i<after.samples.length;i++){const current=after.samples[i].visible.includes(name);if(current&&!previous)runs++;if(current&&previous)visibleMs+=after.samples[i].at-after.samples[i-1].at;previous=current;}row.visibility[name]={samples:frames.length,spanMs:frames.at(-1).at-frames[0].at,visibleMs,runs,firstProgress:frames[0].progress[name],lastProgress:frames.at(-1).progress[name]};}}if(mode==='timing')assert.ok(row.lockMs>0,'playing lock not observed');
  if(mode==='timing'&&(hero==='amo'||hero==='erxiang')){const name=hero==='amo'?'hero/sushi-discard-current':'hero/target-current',v=row.visibility[name];assert.ok(v&&v.samples>=10&&v.visibleMs>=500,`${key}: ${name} was not continuously visible for at least 500ms across 10 samples`);assert.ok(v.lastProgress-v.firstProgress>=.3,`${key}: ${name} made insufficient progress`);}
  if(mode==='repeat'&&await p.evaluate(()=>{const g=window.__harness.game;return g.scene.isActive('game')&&g.scene.getScene('game').ready;})){await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');s.refreshSelection();s.refreshSelection();});await p.waitForTimeout(300);const replay=await p.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game'),c=g.registry.get('runController');return{current:(()=>{const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);return walk(s.view.root?.list??[]).some(o=>o.active&&['hero/target-current','hero/sushi-discard-current','hero/skill-stage-current','hero/liue-sound-current','hero/xin-candidate-current','hero/target-afterglow'].includes(o.name));})(),state:c.state,journal:c.journal};});assert.equal(replay.current,false,'repeated refresh replayed source');assert.deepEqual(replay.state,after.state);assert.deepEqual(replay.journal,after.journal);row.repeatClean=true;}
  if(mode==='throttle'){
   row.travelSamples=after.samples;row.pixelIsolation='NOT_RUN: per-frame canvas pausing perturbs the measured throttle clock; normal/muted modes own the isolated-pixel occlusion checks.';
   assert.ok(row.lockMs>0,`${key}: playing lock not observed`);
   const expected=hero==='amo'?['hero/sushi-discard-current','hero/skill-stage-current']:hero==='erxiang'?['hero/target-current','hero/liue-sound-current']:hero==='laohuan'&&process.env.HERO_ELECTRIC_XIN_DISCARD==='1'?['hero/skill-stage-current','hero/xin-candidate-current']:hero==='laohuan'?['hero/target-current']:['hero/skill-stage-current'];
   for(const name of expected){const samples=after.samples.filter(s=>s.visible.includes(name));assert.ok(samples.length>=3,`${key}: ${name} lacks three actual rendered electric frames`);
    if(['hero/target-current','hero/sushi-discard-current'].includes(name)){
     const progress=samples.map(s=>s.progress[name]);assert.ok(progress.every(Number.isFinite),`${key}: ${name} lacks source progress`);
     assert.ok(progress.every((p,i)=>i===0||p>=progress[i-1]),`${key}: ${name} reversed its advancing front`);assert.ok(new Set(progress).size>=3,`${key}: ${name} lacks three distinct travel frames`);
     assert.ok(progress.some(p=>p>=.45&&p<.85),`${key}: ${name} skipped its visible travel phase`);assert.ok(progress.at(-1)-progress[0]>=.3,`${key}: ${name} made insufficient visible progress`);
    }
   }
  }
  if(['normal','muted','timing','throttle'].includes(mode))row.travelSamples=after.samples;
  const frames=after.frames;row.frames=frames.map(({on,off,...v})=>v);if(mode==='normal'||mode==='muted'||mode.startsWith('afterglow')){
   row.pixelIsolation='Same-clock synchronous scene redraw; scene pause/time advancement NOT_USED. Controlled-observation overhead is not a device frame-time benchmark.';
   assert.ok(frames.length>=3,`${key}: fewer than three consecutive electric frames`);assert.ok(frames.every(x=>x.stats.electricSegments>0));const byName=Object.groupBy(frames,x=>x.name);row.movingNames=[];for(const [name,sequence] of Object.entries(byName)){if(sequence.length<3)continue;const moved=sequence.some((a,i)=>i>0&&a.heads.length&&sequence[i-1].heads.length&&Math.hypot(a.heads[0].x-sequence[i-1].heads[0].x,a.heads[0].y-sequence[i-1].heads[0].y)>1);if(moved)row.movingNames.push(name);}assert.ok(row.movingNames.length,`${key}: no measured moving electric head`);
   row.isolatedPixels=[];for(const frame of frames){const pixels=await difference(frame.on,frame.off,frame.controls,frame.heads,frame.protectedBoxes,frame.protectedPolygons);row.isolatedPixels.push(pixels);}
   assert.ok(row.isolatedPixels.filter(x=>x.total>0&&x.nearHeads>0).length>=3,`${key}: isolated current produced no pixels around its heads`);
   assert.ok(row.isolatedPixels.every(x=>x.controls===0),`${key}: current covers a control`);assert.ok(row.isolatedPixels.every(x=>x.protected===0),`${key}: current covers a protected print or scoreboard`);for(const frame of frames.filter(f=>['hero/target-current','hero/sushi-discard-current'].includes(f.name)))assert.ok(frame.protectedBoxes.length,`${key}: source protection boxes missing`);
   const expected=mode.startsWith('afterglow')?['hero/target-afterglow']:hero==='amo'?['hero/sushi-discard-current','hero/skill-stage-current']:hero==='erxiang'?['hero/target-current','hero/liue-sound-current']:hero==='laohuan'&&process.env.HERO_ELECTRIC_XIN_DISCARD==='1'?['hero/skill-stage-current','hero/xin-candidate-current']:hero==='laohuan'?['hero/target-current']:['hero/skill-stage-current'];for(const name of expected){const samples=frames.map((frame,i)=>({frame,pixels:row.isolatedPixels[i]})).filter(x=>x.frame.name===name&&x.pixels.nearHeads>0);const positions=new Set(samples.map(x=>x.frame.heads[0]&&`${Math.round(x.frame.heads[0].x)},${Math.round(x.frame.heads[0].y)}`));assert.ok(samples.length>=3&&positions.size>=3,`${key}: ${name} lacks three visibly moving isolated head positions`);}
   for(let i=0;i<frames.length;i++){await writeFile(resolve(dir,`frame-${String(i).padStart(2,'0')}-on.png`),Buffer.from(frames[i].on,'base64'));await writeFile(resolve(dir,`frame-${String(i).padStart(2,'0')}-off.png`),Buffer.from(frames[i].off,'base64'));}
  }else if(mode==='reduce')assert.equal(frames.length,0,`${key}: electric line visible with reduced motion`);
  assert.deepEqual(row.errors,[]);row.status='PASS';console.log(key+' PASS frames='+frames.length);
 }catch(e){row.status='FAIL';row.error=String(e.stack??e);row.travelSamples??=await p.evaluate(()=>window.electricProbe?.samples??[]).catch(()=>[]);await p.screenshot({path:resolve(dir,'failure.png')}).catch(()=>{});throw e;}finally{await context.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
}report.status='PASS';}catch(e){report.status='FAIL';report.error=String(e.stack??e);process.exitCode=1;}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();console.log(report.status,report.error??'');}
