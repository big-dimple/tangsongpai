/**
 * First-player browser evidence. The preflight intentionally does not claim
 * that the guided match has been accepted: it only checks the recording rig.
 * Run `node harness/novice-guide.mjs --preflight` while integration is pending.
 * Real game actions must use DOM or pointer input, never controller dispatch.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, symlink, unlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build, createServer, preview} from 'vite';
import {tapUI, waitScene, openMenuSection, openRunMenu, confirmHeroRoute, enterOpeningShop} from './ui.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.resolve(root,process.env.NOVICE_EVIDENCE_DIR||'shots/novice-guide');
const preflight=process.argv.includes('--preflight');
const cases=[
  {name:'narrow',viewport:{width:320,height:740},touch:true},
  {name:'phone',viewport:{width:390,height:740},touch:true},
  {name:'short',viewport:{width:320,height:568},touch:true,short:true},
  {name:'desktop',viewport:{width:1366,height:768},touch:false},
].filter(row=>!process.env.NOVICE_CASE||row.name===process.env.NOVICE_CASE);
assert.ok(cases.length,'NOVICE_CASE must be desktop, narrow, phone or short');
await mkdir(out,{recursive:true});

// Playwright's recorder normally expects its own ffmpeg download. In this
// environment system ffmpeg is present; use an isolated temporary browser
// registry rather than installing binaries or modifying the project.
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&process.platform==='linux'&&existsSync('/usr/bin/ffmpeg')){
  const registry=await mkdtemp(path.join(os.tmpdir(),'novice-playwright-'));
  const manifest=JSON.parse(await readFile(path.join(path.dirname(require.resolve('playwright-core/package.json')),'browsers.json'),'utf8'));
  const revision=manifest.browsers.find(row=>row.name==='ffmpeg')?.revision;
  assert.ok(revision,'Playwright ffmpeg revision');
  const ffmpegDir=path.join(registry,`ffmpeg-${revision}`);
  await mkdir(ffmpegDir,{recursive:true});
  await symlink('/usr/bin/ffmpeg',path.join(ffmpegDir,'ffmpeg-linux'));
  process.env.PLAYWRIGHT_BROWSERS_PATH=registry;
}
const {chromium}=await import('playwright');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
function sourceFingerprint(){
  const hash=createHash('sha256');
  const paths=['src','public','index.html','vite.config.ts','package.json','package-lock.json','harness/novice-guide.mjs','harness/ui.mjs'];
  const tracked=execFileSync('git',['diff','--binary','HEAD','--',...paths],{cwd:root});
  hash.update(tracked);
  const untracked=git('ls-files','--others','--exclude-standard','--',...paths);
  for(const relative of untracked?untracked.split('\n'):[]){hash.update(relative);hash.update(execFileSync('cat',[relative],{cwd:root}));}
  return hash.digest('hex');
}
const report={
  scope:preflight?'recording and clean-start preflight only':'guided-match acceptance',
  testedCommit:git('rev-parse','HEAD'),dirtyAtBuild:git('status','--porcelain=v1'),
  sourceBeforeBuild:sourceFingerprint(),node:process.version,browser:null,
  acceptance:'NOT_RUN',cases:[],
  limitations:['Chromium desktop and emulated touchscreen; physical phones and human comprehension are not tested.',
    'The e2e-only observer reads state; all player actions use real DOM, mouse or touch inputs.'],
};
let server,browser,ssr,domain;

async function legacyBundle(){
  // Keep the baseline pinned to the committed version before this feature.
  // Rebuild it from git when a previously captured clean bundle is unavailable.
  const ref=process.env.NOVICE_LEGACY_REF||'c665a78410e84919e7e04485983fa44e9f3140e4';
  const commit=git('rev-parse',`${ref}^{commit}`);
  const candidate=path.resolve(root,process.env.NOVICE_LEGACY_BUILD||'shots/novice-guide-preflight/build');
  try{
    const old=JSON.parse(await readFile(path.join(path.dirname(candidate),'report.json'),'utf8'));
    const empty=createHash('sha256').digest('hex');
    if(old.testedCommit===commit&&old.sourceBeforeBuild===empty&&old.sourceAfterBuild===empty&&existsSync(path.join(candidate,'index.html')))
      return {directory:candidate,commit,provenance:'previous clean preflight bundle'};
  }catch{/* A clean archive build below is equally valid. */}
  const source=await mkdtemp(path.join(out,'legacy-source-'));
  const archive=execFileSync('git',['archive','--format=tar',commit],{cwd:root,maxBuffer:256*1024*1024});
  execFileSync('tar',['-xf','-','-C',source],{input:archive});
  await symlink(path.join(root,'node_modules'),path.join(source,'node_modules'),'dir');
  const directory=path.join(source,'dist-e2e');
  await build({root:source,mode:'e2e',build:{outDir:directory,emptyOutDir:true},logLevel:'error'});
  return {directory,commit,provenance:'git archive of previous commit'};
}

async function inspect(page){
  return page.evaluate(()=>{
    const game=window.__harness?.game,controller=game?.registry.get('runController');
    return {
      scenes:game?.scene.getScenes(true).map(scene=>scene.scene.key)??[],
      run:controller?{state:controller.state,journal:controller.journal,status:controller.status}:null,
      visibleButtons:[...document.querySelectorAll('button')].filter(button=>button.getClientRects().length)
        .map(button=>({name:button.getAttribute('aria-label')||button.innerText.trim(),disabled:button.disabled,ui:button.dataset.ui??null})),
      dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>dialog.innerText),
    };
  });
}

/** Each screenshot is paired with a read-only, timestamped state observation. */
async function capture(test,name){
  const index=String(test.record.steps.length).padStart(2,'0');
  const filename=`${index}-${name}.png`;
  await test.page.screenshot({path:path.join(test.dir,filename),scale:'css'});
  const observation=await inspect(test.page);
  test.record.steps.push({name,at:new Date().toISOString(),screenshot:filename,observation});
  console.log(`${test.record.name}: ${name}`);
  return observation;
}

async function startCase(spec,url){
  const dir=path.join(out,spec.name);await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:spec.viewport,hasTouch:spec.touch,deviceScaleFactor:1,
    recordVideo:{dir,size:spec.viewport}});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const record={...spec,status:'IN_PROGRESS',input:spec.touch?'touchscreen':'mouse',steps:[],errors:[],failedRequests:[]};
  page.on('pageerror',error=>record.errors.push(error.stack||String(error)));
  page.on('requestfailed',request=>record.failedRequests.push({url:request.url(),failure:request.failure()?.errorText}));
  page.on('dialog',dialog=>dialog.dismiss());
  await context.tracing.start({screenshots:true,snapshots:true});
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__harness?.game);
  return {context,page,record,dir,touch:spec.touch};
}

async function finishCase(test){
  const video=test.page.video();
  await test.context.tracing.stop({path:path.join(test.dir,'trace.zip')}).catch(()=>{});
  await test.context.close();
  if(video){
    const source=await video.path(),target=path.join(test.dir,'session.webm');
    await video.saveAs(target);if(source!==target)await unlink(source);
    test.record.video=path.basename(target);
  }
  await writeFile(path.join(test.dir,'report.json'),JSON.stringify(test.record,null,2)+'\n');
}

async function cleanStart(test){
  const {page}=test;
  await waitScene(page,'title');
  const entry=await capture(test,'clean-entry');
  assert.equal(entry.run,null,'a fresh browser context must not load a run');
  assert.deepEqual(test.record.errors,[],'no uncaught page errors at the first screen');
}

async function click(test,locator){if(test.touch)await locator.tap();else await locator.click();}

const readRun=page=>page.evaluate(()=>{
  const controller=window.__harness.game.registry.get('runController');
  return controller?{state:controller.state,journal:controller.journal,status:controller.status}:null;
});
const readSelection=page=>page.evaluate(()=>{
  const scene=window.__harness.game.scene.getScene('game');
  return [...scene.selectedIds];
});
async function settleGame(page){
  await page.waitForFunction(()=>{
    const scene=window.__harness.game.scene.getScene('game');
    return scene.scene.isActive()&&scene.ready&&!scene.playing&&!scene.presentation&&scene.cardViews.length>0&&
      scene.cardViews.every(card=>!card.dealing&&!scene.tweens.isTweening(card.container));
  },null,{timeout:30000});
}
async function guideStep(test,expected){
  const guide=test.page.locator('[data-novice-guide]');
  await guide.waitFor({state:'visible'});
  await test.page.waitForFunction(step=>document.querySelector('[data-novice-guide]')?.getAttribute('data-novice-guide-step')===step,expected);
  const panel=guide.locator('[data-novice-guide-panel]');
  await panel.waitFor({state:'visible'});
  const box=await panel.boundingBox();assert.ok(box,'guide remains visible');
  const {width,height}=test.record.viewport;
  assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+.5&&box.y+box.height<=height+.5,'guide fits inside viewport');
}
async function pairHighlightColumns(test){
  if(!test.touch)return;
  const geometry=await test.page.evaluate(()=>{
    const scene=window.__harness.game.scene.getScene('game'),layout=scene.view.layout;
    const canvas=window.__harness.game.canvas.getBoundingClientRect(),sx=canvas.width/layout.width;
    const ids=['clubs-5','hearts-5'];
    const targets=ids.map(id=>{
      const index=scene.hand.findIndex(card=>card.id===id),seat=layout.cards[index];
      return {id,visible:seat?.visible,left:canvas.left+seat.hit.x*sx,width:seat.hit.width*sx,
        visualWidth:seat.visual.width*sx};
    });
    const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].map(node=>{
      const r=node.getBoundingClientRect();return {left:r.left,width:r.width};
    });
    return {targets,rings};
  });
  assert.equal(geometry.rings.length,2,'exactly the two recommended cards are highlighted');
  for(const target of geometry.targets){
    assert.equal(target.visible,true,`${target.id} is in the visible hand`);
    const expectedWidth=Math.min(target.width,target.visualWidth);
    const ring=geometry.rings.find(row=>Math.abs(row.left-target.left)<1.5);
    assert.ok(ring,`${target.id} highlight starts at its own clickable column`);
    assert.ok(Math.abs(ring.width-expectedWidth)<1.5,`${target.id} highlight ends at its own clickable column, before a neighbour`);
    assert.ok(ring.left+ring.width<=target.left+target.width+1.5,'highlight cannot extend into the next clickable column');
  }
  test.record.highlightColumns=geometry;
}
async function selectCards(test,ids){
  const before=await readRun(test.page);assert.ok(before);
  for(const id of ids){
    assert.ok(before.state.handOrder.includes(id),`${id} is on the visible hand`);
    await tapUI(test.page,'game','card/'+id,test.touch);
  }
  assert.deepEqual(new Set(await readSelection(test.page)),new Set(ids),'each chosen card was selected by the player');
  assert.deepEqual(await readRun(test.page),before,'selection by itself does not alter the saved run');
}
/** Compare the real UI-submitted command with the actual domain transition. */
async function committed(test,before,expectedAction){
  await test.page.waitForFunction(seq=>{
    const controller=window.__harness.game.registry.get('runController');
    return controller?.state.commandSeq===seq+1&&controller.status==='idle';
  },before.state.commandSeq,{timeout:30000});
  const after=await readRun(test.page),command=after.journal.at(-1);
  assert.equal(after.status,'idle','command is durably published before accepting it');
  assert.equal(after.state.commandSeq,before.state.commandSeq+1);
  if(expectedAction.selectedIds){
    assert.equal(command.action.type,expectedAction.type,'the expected action was committed');
    assert.equal(command.action.selectedIds.length,expectedAction.selectedIds.length);
    assert.deepEqual(new Set(command.action.selectedIds),new Set(expectedAction.selectedIds),'exactly the chosen cards were committed');
    const {selectedIds:actualIds,...actualRest}=command.action;
    const {selectedIds:expectedIds,...expectedRest}=expectedAction;
    assert.deepEqual(actualRest,expectedRest,'no unchosen action parameters were added');
  }else assert.deepEqual(command.action,expectedAction,'only the chosen player action was committed');
  const result=domain.applyCommand(before.state,command);
  assert.ok(result.ok,JSON.stringify(result));
  assert.deepEqual(after.state,result.state,'browser and rule transition agree');
  assert.deepEqual(after.journal,[...before.journal,command]);
  return after;
}
async function play(test,ids,expectedScore){
  await settleGame(test.page);
  const before=await readRun(test.page);await selectCards(test,ids);
  await capture(test,'selected-'+(before.state.stage.playIndex+1));
  await tapUI(test.page,'game','action/play',test.touch);
  const reminder=test.page.getByRole('button',{name:'继续出牌',exact:true});
  if(await reminder.isVisible()){
    await capture(test,'skill-reminder');
    assert.fail('The first two guided stages must not interrupt a hand with the unexplained hero skill reminder');
  }
  const after=await committed(test,before,{type:'PlayHand',selectedIds:ids});
  assert.equal(after.state.stage.handsLeft,before.state.stage.handsLeft-1);
  if(expectedScore!==undefined)assert.equal(after.state.lastTrace.finalScore,String(expectedScore));
  const score=after.state.lastTrace.finalScore;
  assert.ok(/^\d+$/.test(score)&&BigInt(score)>0n,'real hand scores a positive integer');
  assert.deepEqual(new Set(after.state.lastTrace.sets.playedIds),new Set(ids));
  assert.equal(BigInt(after.state.stage.heat),BigInt(before.state.stage.heat)+BigInt(score));
  return {before,after};
}
async function discard(test,ids){
  await settleGame(test.page);
  const before=await readRun(test.page);await selectCards(test,ids);
  await capture(test,'discard-selected');
  await tapUI(test.page,'game','action/discard',test.touch);
  const after=await committed(test,before,{type:'DiscardHand',selectedIds:ids});
  assert.equal(after.state.stage.discardsLeft,before.state.stage.discardsLeft-1);
  assert.equal(after.state.stage.handsLeft,before.state.stage.handsLeft);
  assert.equal(after.state.handOrder.length,before.state.handOrder.length);
  assert.ok(ids.every(id=>!after.state.handOrder.includes(id)&&after.state.discardPile.includes(id)),'chosen cards actually left the hand');
  assert.equal(after.state.handOrder.filter(id=>!before.state.handOrder.includes(id)).length,ids.length,'the real draw replaced each discarded card');
  return {before,after};
}

async function guidedMatch(test){
  const {page,touch}=test;
  await tapUI(page,'title','action/title-start',touch);
  await waitScene(page,'game');await settleGame(page);
  let current=await readRun(page);
  assert.equal(current.state.mode,'tutorial');
  assert.equal(current.state.seed,'r2/tutorial/core-v1');
  assert.equal(current.state.characterId,'erxiang');
  assert.equal(current.state.stageIndex,0);assert.equal(current.state.phase,'await-input');
  assert.deepEqual(current.journal.map(command=>command.action.type),['LeaveShop','EnterStage']);
  await guideStep(test,'pair');await capture(test,'first-hand-guide');await pairHighlightColumns(test);

  const pair=await play(test,['hearts-5','clubs-5'],90);
  assert.equal(pair.after.state.lastTrace.handType,'pair');
  await settleGame(page);await guideStep(test,'discard');await capture(test,'real-pair-score');
  // Closing the hint and opening it again must neither choose cards nor change a save.
  const saved=await readRun(page);
  await click(test,page.getByRole('button',{name:'收起引导',exact:true}));
  await click(test,page.getByRole('button',{name:'查看新手引导',exact:true}));
  await guideStep(test,'discard');assert.deepEqual(await readRun(page),saved);
  // A genuine reload ends the browser page; continue through the actual title UI.
  await page.reload();await waitScene(page,'title');
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='idle');
  assert.deepEqual(await readRun(page),saved,'reload restored the saved state and journal');
  await capture(test,'title-after-reload');
  await tapUI(page,'title','action/title-continue',touch);
  await waitScene(page,'game');await settleGame(page);await guideStep(test,'discard');
  assert.deepEqual(await readRun(page),saved,'continuing cannot replay the pair or advance the guide');
  await capture(test,'restored-discard-guide');
  await discard(test,['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']);
  await settleGame(page);await guideStep(test,'independent');await capture(test,'real-replacement');

  current=await readRun(page);
  const flush=current.state.handOrder.filter(id=>id.startsWith('hearts-')).slice(0,5);
  assert.equal(flush.length,5,'five public hearts available after the actual draw');
  const firstClear=await play(test,flush,704);
  assert.equal(firstClear.after.state.lastTrace.handType,'flush');
  assert.equal(firstClear.after.state.phase,'stage-cleared');
  await waitScene(page,'intermission');await guideStep(test,'shop');await capture(test,'first-battle-cleared');

  const won=await readRun(page);
  await tapUI(page,'intermission','action/continue-stage',touch);
  const shopEntry=await committed(test,won,{type:'OpenShop'});
  await waitScene(page,'shop');
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  await guideStep(test,'shop');
  // Preserve the normal animation in the recording, then capture the actual
  // unobscured instructions after the entry cut-in has left the page.
  await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached'});
  await capture(test,'first-shop');
  const offer=shopEntry.state.shop.offers.find(row=>row.definitionId==='b02'&&!row.consumed);
  assert.ok(offer,'the understandable recommended card is offered');
  assert.equal(offer.price,4);assert.ok(shopEntry.state.gold>=offer.price);
  await tapUI(page,'shop','offer/'+offer.offerId,touch);
  const dialog=page.locator('dialog[open]').last();await dialog.waitFor();
  assert.match(await dialog.innerText(),/心有灵犀/);
  await capture(test,'purchase-details');
  const buy=dialog.getByRole('button',{name:'购买 · 4 金',exact:true});
  if(touch)await buy.tap();else await buy.click();
  const bought=await committed(test,shopEntry,{type:'BuyOffer',offerId:offer.offerId});
  assert.equal(bought.state.gold,shopEntry.state.gold-4);
  const owned=bought.state.jokers.find(row=>row.definitionId==='b02');assert.ok(owned);
  assert.equal(bought.state.jokers.length,shopEntry.state.jokers.length+1);
  await guideStep(test,'payoff');await capture(test,'purchase-saved');

  await tapUI(page,'shop','action/start-stage',touch);
  await page.waitForFunction(()=>{
    const run=window.__harness.game.registry.get('runController')?.state;
    return run?.stageIndex===1&&run.phase==='await-input'||[...document.querySelectorAll('button')].some(b=>b.getClientRects().length&&/^进入正场/.test(b.innerText));
  },null,{timeout:30000});
  const enter=page.getByRole('button',{name:/^进入正场/});
  if(await enter.isVisible()){if(touch)await enter.tap();else await enter.click();}
  await waitScene(page,'game');await settleGame(page);
  current=await readRun(page);
  assert.equal(current.state.stageIndex,1);assert.equal(current.state.phase,'await-input');
  const entries=current.journal.slice(bought.journal.length);
  assert.deepEqual(entries.map(command=>command.action.type),['LeaveShop','EnterStage']);
  let expected=bought.state;
  for(const command of entries){const result=domain.applyCommand(expected,command);assert.ok(result.ok);expected=result.state;}
  assert.deepEqual(current.state,expected,'next battle was entered by real commands');
  await guideStep(test,'payoff');await capture(test,'next-battle');
  const payoff=await play(test,['clubs-6','spades-6']);
  const actual=payoff.after.state.lastTrace.events.find(event=>event.sourceInstanceId===owned.instanceId&&event.sourceDefinitionId==='b02'&&event.operation==='add-multiplier');
  assert.ok(actual,'the purchased card really contributed multiplier to the next hand');
  await page.waitForFunction(()=>{
    const game=window.__harness.game,s=game.scene.getScene('game');
    return game.scene.isActive('intermission')||s.scene.isActive()&&!s.playing&&!s.presentation;
  },null,{timeout:30000});
  await guideStep(test,'complete');await capture(test,'card-effect');
  assert.deepEqual(test.record.errors,[],'journey has no uncaught page errors');
  test.record.journey={status:'PASS',pairScore:'90',flushScore:'704',offer:'b02',price:4,
    payoffScore:payoff.after.state.lastTrace.finalScore,payoffEvent:actual};
  const finished=await readRun(page);
  await openMenuSection(page,'more',touch);
  await click(test,page.getByRole('button',{name:'重玩新手教程',exact:true}));
  await waitScene(page,'game');await settleGame(page);
  await page.waitForFunction(id=>{
    const state=window.__harness.game.registry.get('runController')?.state;
    return state?.runId!==id&&state?.phase==='await-input';
  },finished.state.runId);
  const replay=await readRun(page);
  assert.notEqual(replay.state.runId,finished.state.runId);
  assert.equal(replay.state.seed,'r2/tutorial/core-v1');assert.equal(replay.state.stageIndex,0);
  assert.equal(replay.state.stage.heat,'0');assert.equal(replay.state.stage.playIndex,0);
  assert.deepEqual(replay.journal.map(command=>command.action.type),['LeaveShop','EnterStage']);
  await guideStep(test,'pair');await capture(test,'replay-fresh');
  test.record.recoveryAndReplay='PASS';
}

// An optional skill can win the tutorial's opening hand immediately. Exercise
// the real high-multiplier presentation and then resume the unfinished lesson.
async function heroEarlyClear(test){
  const {page,touch}=test;
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'game');await settleGame(page);
  await guideStep(test,'pair');const before=await readRun(page);
  await selectCards(test,['hearts-5','clubs-5']);
  await tapUI(page,'game','hero/action-shortcut',touch);
  const index=before.state.handOrder.indexOf('hearts-5')+1;
  await click(test,page.getByRole('button',{name:new RegExp('^第'+index+'张 · ')}));
  await page.evaluate(()=>{
    const game=window.__harness.game,scene=game.scene.getScene('game');
    const observation=window.__noviceHero={frames:0,guideDuringPresentation:0,shot:null};
    const walk=list=>list.flatMap(item=>[item,...(item.list?walk(item.list):[])]);
    observation.tick=()=>{
      if(!scene.scene.isActive()||!scene.presentation)return;
      if(document.querySelector('[data-novice-guide-panel]'))observation.guideDuringPresentation++;
      const aura=walk(scene.view.root?.list??[]).find(item=>item.name==='score/high-multiplier-aura'&&item.active&&item.visible&&(item.getData('visibleSegments')??0)>0);
      if(aura){
        observation.frames++;
        if(!observation.shot)observation.shot=game.canvas.toDataURL('image/png').split('base64,')[1];
      }
    };
    game.events.on('postrender',observation.tick);
  });
  await tapUI(page,'game','action/play',touch);
  const after=await committed(test,before,{type:'PlayHand',selectedIds:['hearts-5','clubs-5'],erxiangTargetId:'hearts-5'});
  assert.equal(after.state.lastTrace.finalScore,'420');assert.equal(after.state.phase,'stage-cleared');
  assert.ok(after.state.lastTrace.events.some(event=>event.reasonKey==='erxiang.handoff'&&
    BigInt(event.before.M.n)<10n*BigInt(event.before.M.d)&&BigInt(event.after.M.n)>=10n*BigInt(event.after.M.d)));
  await waitScene(page,'intermission');await guideStep(test,'replay');
  const observed=await page.evaluate(()=>{
    const game=window.__harness.game,scene=game.scene.getScene('game'),o=window.__noviceHero;
    game.events.off('postrender',o.tick);
    return {frames:o.frames,guideDuringPresentation:o.guideDuringPresentation,shot:o.shot};
  });
  assert.ok(observed.frames>0,'the real tutorial skill event shows the high-multiplier flame');
  assert.equal(observed.guideDuringPresentation,0,'the guide does not obstruct the scoring presentation');
  if(observed.shot)await writeFile(path.join(test.dir,'hero-flame.png'),Buffer.from(observed.shot,'base64'));
  await capture(test,'early-win-offers-retry');
  await page.reload();await waitScene(page,'title');
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='idle');
  assert.deepEqual(await readRun(page),after,'the early victory and its journal survive reload');
  await tapUI(page,'title','action/title-continue',touch);await waitScene(page,'intermission');await guideStep(test,'replay');
  await click(test,page.getByRole('button',{name:'重新练习',exact:true}));
  await page.waitForFunction(id=>{
    const state=window.__harness.game.registry.get('runController')?.state;
    return state?.runId!==id&&state?.phase==='await-input';
  },after.state.runId,{timeout:30000});
  await waitScene(page,'game');await settleGame(page);await guideStep(test,'pair');
  const retry=await readRun(page);assert.equal(retry.state.stage.playIndex,0);assert.equal(retry.state.stage.heat,'0');
  await capture(test,'hero-win-retried-first-hand');assert.deepEqual(test.record.errors,[]);
  test.record.heroEarlyClear={status:'PASS',score:after.state.lastTrace.finalScore,frames:observed.frames};
}

async function mistakesAndSkip(test){
  const {page,touch}=test;
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'game');await settleGame(page);
  await guideStep(test,'pair');
  const mistake=await play(test,['clubs-4']);
  assert.notEqual(mistake.after.state.lastTrace.handType,'pair');
  await settleGame(page);await guideStep(test,'pair');
  assert.match(await page.locator('[data-novice-guide-panel]').innerText(),/对子/);
  await capture(test,'wrong-hand-remains-correctable');
  const fixed=await play(test,['hearts-5','clubs-5'],90);
  assert.equal(fixed.after.state.lastTrace.handType,'pair');
  await settleGame(page);await guideStep(test,'discard');await capture(test,'corrected-pair');
  const beforeSkip=await readRun(page);
  await click(test,page.locator('[data-novice-guide-skip]'));
  await waitScene(page,'character-select');
  assert.deepEqual(await readRun(page),beforeSkip,'skipping exits without altering the saved tutorial run');
  await capture(test,'skipped-to-normal-selection');
  await openRunMenu(page,touch);
  await click(test,page.getByRole('button',{name:'继续游戏',exact:true}));
  await waitScene(page,'game');await settleGame(page);
  assert.deepEqual(await readRun(page),beforeSkip,'continuing after skip restores the same saved run');
  await capture(test,'continued-after-skip');
  assert.deepEqual(test.record.errors,[]);
  test.record.mistakeAndSkip='PASS';
}

async function defeatAndRetry(test,purchased){
  const {page,touch}=test;
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'game');await settleGame(page);
  await guideStep(test,'pair');
  await play(test,['hearts-5','clubs-5'],90);
  await settleGame(page);await guideStep(test,'discard');
  await discard(test,['clubs-4','diamonds-4','spades-14','clubs-7','spades-11']);
  await settleGame(page);await guideStep(test,'independent');
  const first=await readRun(page),flush=first.state.handOrder.filter(id=>id.startsWith('hearts-')).slice(0,5);
  assert.equal(flush.length,5);await play(test,flush,704);
  await waitScene(page,'intermission');
  const cleared=await readRun(page);await tapUI(page,'intermission','action/continue-stage',touch);
  let shop=await committed(test,cleared,{type:'OpenShop'});
  await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  if(purchased){
    const offer=shop.state.shop.offers.find(row=>row.definitionId==='b02'&&!row.consumed);
    assert.ok(offer);await tapUI(page,'shop','offer/'+offer.offerId,touch);
    await click(test,page.locator('dialog[open]').last().getByRole('button',{name:'购买 · 4 金',exact:true}));
    shop=await committed(test,shop,{type:'BuyOffer',offerId:offer.offerId});
    assert.ok(shop.state.jokers.some(row=>row.definitionId==='b02'));
  }else assert.equal(shop.state.jokers.length,0);
  await tapUI(page,'shop','action/start-stage',touch);
  await page.waitForFunction(()=>{
    const run=window.__harness.game.registry.get('runController')?.state;
    return run?.stageIndex===1&&run.phase==='await-input'||[...document.querySelectorAll('button')].some(b=>b.getClientRects().length&&/^进入正场/.test(b.innerText));
  },null,{timeout:30000});
  const enter=page.getByRole('button',{name:/^进入正场/});if(await enter.isVisible())await click(test,enter);
  await waitScene(page,'game');await settleGame(page);
  const second=await readRun(page);assert.equal(second.state.stageIndex,1);assert.equal(second.state.phase,'await-input');
  // Deliberately play only one visible low card on each turn. Even when b02
  // is owned, no pair is played and its condition cannot trigger.
  for(let turn=0;turn<4;turn++){
    const before=await readRun(page);assert.equal(before.state.phase,'await-input');
    const card=before.state.handOrder.map(id=>before.state.deckInstances.find(row=>row.id===id))
      .sort((a,b)=>a.rank-b.rank)[0];assert.ok(card);
    const result=await play(test,[card.id]);
    assert.equal(result.after.state.lastTrace.handType,'high-card');
    assert.ok(!result.after.state.lastTrace.events.some(event=>event.sourceDefinitionId==='b02'),'the bought card did not trigger');
  }
  const lost=await readRun(page);assert.equal(lost.state.phase,'run-lost');
  await waitScene(page,'intermission');await guideStep(test,'replay');await capture(test,'defeat-offers-retry');
  await tapUI(page,'intermission','action/retry-seed',touch);
  await page.waitForFunction(id=>{
    const state=window.__harness.game.registry.get('runController')?.state;
    return state?.runId!==id&&state?.phase==='await-input';
  },lost.state.runId,{timeout:30000});
  await waitScene(page,'game');await settleGame(page);
  const retry=await readRun(page);assert.notEqual(retry.state.runId,lost.state.runId);
  assert.equal(retry.state.seed,'r2/tutorial/core-v1');assert.equal(retry.state.stageIndex,0);
  assert.equal(retry.state.stage.playIndex,0);assert.equal(retry.state.stage.heat,'0');
  assert.deepEqual(retry.journal.map(command=>command.action.type),['LeaveShop','EnterStage']);
  await guideStep(test,'pair');await capture(test,'defeat-retried-first-hand');
  assert.deepEqual(test.record.errors,[]);
  test.record.defeatAndRetry={status:'PASS',purchased,triggered:false};
}

async function shortFirstHand(test){
  const {page,touch}=test;
  const leadIsVisible=async()=>{
    const result=await page.evaluate(()=>{
      const panel=document.querySelector('[data-novice-guide-panel]'),body=panel?.querySelector('.novice-guide-body'),text=body?.firstChild;
      if(!panel||!text)return {visible:false};
      const end=text.textContent.indexOf('。')+1;if(!end)return {visible:false};
      const range=document.createRange();range.setStart(text,0);range.setEnd(text,end);
      const box=panel.getBoundingClientRect(),bottom=box.bottom-(panel.classList.contains('is-constrained')?20:0);
      return {visible:[...range.getClientRects()].every(rect=>rect.top>=box.top&&rect.bottom<=bottom+1),lead:text.textContent.slice(0,end)};
    });
    assert.equal(result.visible,true,'the next action is visible without scrolling: '+result.lead);
  };
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'game');await settleGame(page);
  await guideStep(test,'pair');await leadIsVisible();await capture(test,'short-first-hand');await pairHighlightColumns(test);
  const pair=await play(test,['hearts-5','clubs-5'],90);
  assert.equal(pair.after.state.lastTrace.handType,'pair');
  await settleGame(page);await guideStep(test,'discard');await leadIsVisible();await capture(test,'short-first-score');
  assert.deepEqual(test.record.errors,[]);
  test.record.shortFirstHand='PASS';
}

async function failedSaveAndRetry(test){
  const {page,touch}=test;
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'game');await settleGame(page);
  await guideStep(test,'pair');
  const before=await readRun(page);
  const durableBefore=await page.evaluate(()=>window.__harness.game.registry.get('runController').store.read());
  // Controlled fault injection changes only the browser storage boundary. The
  // attempt, error, retry and all other game interactions are player inputs.
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){
      if(this.name==='saves'&&args[1]==='meta')throw new DOMException('injected quota failure','QuotaExceededError');
      return Reflect.apply(original,this,args);
    };
    window.__restoreNoviceStorage=()=>{IDBObjectStore.prototype.put=original;};
  });
  await selectCards(test,['hearts-5','clubs-5']);
  await tapUI(page,'game','action/play',touch);
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='paused');
  const paused=await readRun(page);
  assert.deepEqual(paused.state,before.state,'a failed save cannot publish a score');
  assert.deepEqual(paused.journal,before.journal);
  assert.deepEqual(await page.evaluate(()=>window.__harness.game.registry.get('runController').store.read()),durableBefore,'failed transaction rolls back storage');
  await capture(test,'injected-save-failure');
  await page.evaluate(()=>window.__restoreNoviceStorage());
  await openRunMenu(page,touch);
  const retry=page.getByRole('button',{name:'重试保存',exact:true});await retry.waitFor({state:'visible'});
  await capture(test,'visible-save-retry');
  await click(test,retry);
  await page.waitForFunction(seq=>{
    const controller=window.__harness.game.registry.get('runController');
    return controller?.status==='idle'&&controller.state.commandSeq===seq+1;
  },before.state.commandSeq,{timeout:30000});
  await waitScene(page,'game');await settleGame(page);
  const retried=await readRun(page),command=retried.journal.at(-1);
  assert.deepEqual(command.action,{type:'PlayHand',selectedIds:['hearts-5','clubs-5']});
  const result=domain.applyCommand(before.state,command);assert.ok(result.ok);
  assert.deepEqual(retried.state,result.state,'retry publishes the original action exactly once');
  assert.deepEqual(retried.journal,[...before.journal,command]);
  assert.equal(retried.state.lastTrace.finalScore,'90');
  await guideStep(test,'discard');await capture(test,'save-retried-once');
  assert.deepEqual(test.record.errors,[]);
  test.record.saveFailureAndRetry='PASS';
}

async function existingSave(test,origin){
  const {page,touch}=test;
  // The legacy build and the new build use the same origin. The checkpoint is
  // created through old UI, with no storage mutation or fabricated run state.
  await page.goto(origin+'/legacy/?harness=1&seed=r2%2Ftutorial%2Fcore-v1');await waitScene(page,'title');
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'character-select');
  await tapUI(page,'character-select','character/erxiang',touch);
  await confirmHeroRoute(page,touch);await enterOpeningShop(page,touch);
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='idle');
  const old=await readRun(page);assert.equal(old.state.mode,'standard');
  await capture(test,'legacy-save-created');
  await page.goto(origin+'/?harness=1');await waitScene(page,'title');
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController')?.status==='idle');
  assert.deepEqual(await readRun(page),old,'the real previous-version checkpoint survived upgrade');
  assert.equal(await page.locator('[data-novice-guide]').count(),0);
  await capture(test,'legacy-save-on-new-title');
  await tapUI(page,'title','action/title-start',touch);await waitScene(page,'character-select');
  assert.deepEqual(await readRun(page),old,'an established player is not enrolled or overwritten');
  assert.equal(await page.locator('[data-novice-guide]').count(),0);
  await capture(test,'legacy-save-skips-first-run');
  await openRunMenu(page,touch);
  await click(test,page.getByRole('button',{name:'继续游戏',exact:true}));
  await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  await tapUI(page,'shop','action/start-stage',touch);await waitScene(page,'game');
  const enter=page.getByRole('button',{name:/^进入暖场/});
  if(await enter.isVisible())await click(test,enter);
  await settleGame(page);
  const before=await readRun(page),groups=new Map();
  for(const id of before.state.handOrder){
    const card=before.state.deckInstances.find(row=>row.id===id),ids=groups.get(card.rank)||[];
    ids.push(id);groups.set(card.rank,ids);
  }
  const pair=[...groups.values()].find(ids=>ids.length>=2)?.slice(0,2);
  assert.ok(pair,'the actual ordinary-run hand has a pair for the existing reminder check');
  await selectCards(test,pair);await tapUI(page,'game','action/play',touch);
  const reminder=page.getByRole('button',{name:'继续出牌',exact:true});
  await reminder.waitFor({state:'visible'});
  assert.deepEqual(await readRun(page),before,'ordinary skill reminder appears before committing a hand');
  await capture(test,'ordinary-skill-reminder');
  await click(test,reminder);await committed(test,before,{type:'PlayHand',selectedIds:pair});
  assert.deepEqual(test.record.errors,[]);
  test.record.existingSave='PASS';
}

try{
  const buildDir=path.join(out,'build');
  await build({root,mode:'e2e',build:{outDir:buildDir,emptyOutDir:true},logLevel:'error'});
  report.sourceAfterBuild=sourceFingerprint();
  assert.equal(git('rev-parse','HEAD'),report.testedCommit,'HEAD changed while building; rebuild the evidence');
  assert.equal(report.sourceAfterBuild,report.sourceBeforeBuild,'source changed while building; rebuild the evidence');
  if(!preflight){
    report.legacyBuild=await legacyBundle();
    await symlink(report.legacyBuild.directory,path.join(buildDir,'legacy'),'dir');
    ssr=await createServer({root,server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
    domain=await ssr.ssrLoadModule('/src/domain/run.ts');
  }
  server=await preview({root,build:{outDir:buildDir},preview:{host:'127.0.0.1',port:0,strictPort:true},logLevel:'error'});
  const address=server.httpServer.address();
  assert.ok(address&&typeof address!=='string');
  const origin=`http://127.0.0.1:${address.port}`,url=origin+'/?harness=1';
  const executable=process.env.NOVICE_CHROMIUM||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({...(executable?{executablePath:executable}:{}),args:['--no-sandbox','--disable-gpu']});
  report.browser=browser.version();
  for(const spec of cases){
    const scenarios=(preflight?[{name:'preflight',run:async()=>{}}]:spec.short?[{name:'short-hand',run:shortFirstHand}]:[
      {name:'journey',run:guidedMatch},
      {name:'hero-early-clear',run:heroEarlyClear},
      {name:'mistake-and-skip',run:mistakesAndSkip},
      {name:'save-failure',run:failedSaveAndRetry},
      {name:'existing-save',run:test=>existingSave(test,origin)},
      {name:'loss-before-purchase',run:test=>defeatAndRetry(test,false)},
      {name:'loss-before-trigger',run:test=>defeatAndRetry(test,true)},
    ]).filter(scenario=>!process.env.NOVICE_SCENARIO||scenario.name===process.env.NOVICE_SCENARIO);
    if(!scenarios.length)continue;
    for(const scenario of scenarios){
      const caseSpec={...spec,name:preflight?spec.name:spec.name+'-'+scenario.name};
      let test;
      try{
        test=await startCase(caseSpec,url);report.cases.push(test.record);
        await cleanStart(test);await scenario.run(test);
        test.record.status=preflight?'PREFLIGHT_COMPLETE':'PASS';
      }catch(error){
        if(test){test.record.status='FAIL';test.record.error=error.stack||String(error);await capture(test,'failure').catch(()=>{});}
        else report.cases.push({...caseSpec,status:'FAIL',error:error.stack||String(error)});
        process.exitCode=1;
      }finally{if(test)await finishCase(test);}
    }
  }
  if(!preflight){
    assert.ok(report.cases.length,'NOVICE_SCENARIO must name a known scenario');
    const success=report.cases.every(row=>row.status==='PASS'),expected=cases.reduce((count,spec)=>count+(spec.short?1:7),0);
    report.acceptance=success&&!process.env.NOVICE_SCENARIO&&!process.env.NOVICE_CASE&&report.cases.length===expected?'PASS':success?'INCOMPLETE':'FAIL';
    if(report.acceptance!=='PASS')process.exitCode=1;
  }
}catch(error){report.error=error.stack||String(error);process.exitCode=1;}
finally{
  report.sourceAfterRun=sourceFingerprint();
  report.commitAfterRun=git('rev-parse','HEAD');
  if(report.commitAfterRun!==report.testedCommit||report.sourceAfterBuild&&report.sourceAfterRun!==report.sourceAfterBuild){report.sourceChangedDuringRun=true;report.acceptance='INVALID';process.exitCode=1;}
  await browser?.close();
  await new Promise(resolve=>server?.httpServer?server.httpServer.close(resolve):resolve());
  await ssr?.close();
  await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({scope:report.scope,acceptance:report.acceptance,cases:report.cases.map(({name,status,error})=>({name,status,error})),error:report.error}));
}
