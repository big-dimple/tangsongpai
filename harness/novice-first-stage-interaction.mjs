/** First-stage tutorial evidence: all player actions use the real browser UI. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,symlink,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {point,tapUI,waitScene} from './ui.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.NOVICE_FIRST_OUT??'shots/novice-first-stage');
await mkdir(out,{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
function sourceFingerprint(){
  const hash=createHash('sha256'),paths=['src','public','index.html','vite.config.ts','package.json','package-lock.json','harness/novice-first-stage-interaction.mjs','harness/ui.mjs'];
  hash.update(execFileSync('git',['diff','--binary','HEAD','--',...paths],{cwd:root}));
  const untracked=execFileSync('git',['ls-files','-z','--others','--exclude-standard','--',...paths],{cwd:root,encoding:'utf8'});
  for(const relative of untracked.split('\0').filter(Boolean)){hash.update(relative);hash.update(readFileSync(join(root,relative)));}
  return hash.digest('hex');
}
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('/usr/bin/ffmpeg')){
  const dir=await mkdtemp(join(tmpdir(),'tsp-first-stage-video-'));
  const manifest=JSON.parse(await readFile(join(dirname(require.resolve('playwright-core/package.json')),'browsers.json'),'utf8'));
  const revision=manifest.browsers.find(row=>row.name==='ffmpeg')?.revision;
  assert.ok(revision,'Playwright ffmpeg revision is available');
  await mkdir(join(dir,`ffmpeg-${revision}`));
  await symlink('/usr/bin/ffmpeg',join(dir,`ffmpeg-${revision}`,'ffmpeg-linux'));
  process.env.PLAYWRIGHT_BROWSERS_PATH=dir;
}
const {chromium}=await import('playwright');
const port=Number(process.env.NOVICE_FIRST_PORT??5794);
const server=await createServer({root,mode:'e2e',cacheDir:`/tmp/tsp-first-stage-${port}`,optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const cases=[
  {name:'desktop-two',width:1366,height:768,touch:false,discardCount:2,choiceIndex:1},
  {name:'phone-one',width:390,height:740,touch:true,discardCount:1,choiceIndex:0},
  {name:'phone-two',width:390,height:740,touch:true,discardCount:2,choiceIndex:1},
  {name:'narrow-one',width:320,height:568,touch:true,discardCount:1,choiceIndex:1},
  {name:'narrow-two',width:320,height:568,touch:true,discardCount:2,choiceIndex:0},
  {name:'desktop-play',width:1920,height:1080,touch:false,flow:'play'},
  {name:'phone-play',width:390,height:740,touch:true,flow:'play'},
  {name:'phone-skip',width:390,height:740,touch:true,flow:'skip'},
].filter(s=>!process.env.NOVICE_FIRST_CASE||process.env.NOVICE_FIRST_CASE.split(',').includes(s.name));
assert.ok(cases.length,'NOVICE_FIRST_CASE must name a case');
const report={scope:'Fresh guided first stage via mouse or emulated touch. State is read only for observations; player actions use real pointer or DOM controls.',testedCommit:git('rev-parse','HEAD'),sourceBefore:sourceFingerprint(),dirtyAtStart:git('status','--porcelain=v1'),cases:[]};
const overlap=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
const sameBox=(a,b)=>Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;

try {for(const spec of cases){
  const dir=join(out,spec.name);await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,recordVideo:{dir,size:{width:spec.width,height:spec.height}}});
  const page=await context.newPage(),cdp=spec.touch?await context.newCDPSession(page):undefined,row={...spec,steps:[],errors:[]};report.cases.push(row);
  page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error)));
  const state=()=>page.evaluate(()=>window.__harness.game.registry.get('runController')?.state);
  const journal=()=>page.evaluate(()=>window.__harness.game.registry.get('runController')?.journal);
  const selection=()=>page.evaluate(()=>[...window.__harness.game.scene.getScene('game').selectedIds]);
  const waitReady=()=>page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));},null,{timeout:30000});
  const guide=async step=>{
    await page.waitForFunction(s=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep===s,step,{timeout:30000});
    await page.locator('[data-novice-guide-panel]:visible').waitFor();
  };
  const measure=()=>page.evaluate(()=>{
    const game=window.__harness.game,scene=game.scene.getScene('game'),panel=document.querySelector('[data-novice-guide-panel]');
    if(!panel)return null;
    const p=panel.getBoundingClientRect(),layout=scene.view?.layout,canvas=game.canvas.getBoundingClientRect(),sx=layout?canvas.width/layout.width:1,sy=layout?canvas.height/layout.height:1;
    const map=b=>b&&({x:canvas.left+b.x*sx,y:canvas.top+b.y*sy,width:b.width*sx,height:b.height*sy});
    const protectedBoxes=scene.scene.isActive()&&layout?[layout.hud,layout.scoreBoard,layout.playedArea,layout.hand,layout.actions,layout.heroAction,layout.inventoryEntry,layout.helpEntry,...scene.run.jokers.map((_,i)=>layout.slots[i])].filter(Boolean).map(map):[];
    const playedArea=scene.scene.isActive()&&layout?map(layout.playedArea):null;
    const cards=scene.scene.isActive()&&layout?scene.hand.flatMap((card,i)=>{
      const view=scene.cardViews[i],seat=layout.cards[i];if(!view?.container.active||!view.container.visible||!seat?.visible)return [];
      const width=Number(view.container.getData('width')),height=Number(view.container.getData('height')),matrix=view.container.getWorldTransformMatrix();
      const a=matrix.transformPoint(-width/2,-height/2),b=matrix.transformPoint(width/2,height/2);
      return [{id:card.id,suit:card.suit,...map({x:a.x,y:a.y,width:Math.min(b.x-a.x,seat.hit.width),height:b.y-a.y})}];
    }):[];
    const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].map(el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};});
    const choices=[...panel.querySelectorAll('[data-novice-guide-choice]')].map(el=>{
      const b=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);
      return {text:el.innerText,id:el.dataset.noviceGuideChoice,ids:el.dataset.cardIds,pressed:el.getAttribute('aria-pressed'),
        box:{x:b.x,y:b.y,width:b.width,height:b.height},scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,
        textBoxes:[...range.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))};
    });
    const scroll=document.scrollingElement;
    return {step:document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep,title:panel.querySelector('.novice-guide-title')?.textContent,body:panel.querySelector('.novice-guide-body')?.textContent,text:panel.innerText,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight,panel:{x:p.x,y:p.y,width:p.width,height:p.height},protectedBoxes,playedArea,rings,cards,choices,documentScroll:{width:scroll?.scrollWidth,clientWidth:scroll?.clientWidth,height:scroll?.scrollHeight,clientHeight:scroll?.clientHeight}};
  });
  const capture=async(name,check=true)=>{
    const info=await measure();
    if(check){
      assert.ok(info,`${name}: guide is visible`);
      assert.ok(info.scrollHeight<=info.clientHeight+1,`${name}: guide needs internal scrolling: ${JSON.stringify(info)}`);
      assert.ok(info.panel.x>=0&&info.panel.y>=0&&info.panel.x+info.panel.width<=spec.width+.5&&info.panel.y+info.panel.height<=spec.height+.5,`${name}: guide leaves viewport`);
      for(const b of info.protectedBoxes)assert.ok(!overlap(info.panel,b),`${name}: guide covers the live table: ${JSON.stringify({panel:info.panel,b})}`);
      assert.ok(info.documentScroll.width<=info.documentScroll.clientWidth+1&&info.documentScroll.height<=info.documentScroll.clientHeight+1,`${name}: page scrolls: ${JSON.stringify(info.documentScroll)}`);
      for(const choice of info.choices){
        assert.ok(choice.box.width>=43&&choice.box.height>=43,`${name}: choice has an undersized hit area: ${JSON.stringify(choice)}`);
        assert.ok(choice.scrollWidth<=choice.clientWidth+1&&choice.scrollHeight<=choice.clientHeight+1,`${name}: choice text overflows: ${JSON.stringify(choice)}`);
        if(!choice.id.startsWith('flush-'))assert.match(choice.text,/预计\s*\d+(?:\s*[–~-]\s*\d+)?\s*分/,`${name}: complete score estimate is visible`);
        for(const b of choice.textBoxes)assert.ok(b.x>=choice.box.x-1&&b.y>=choice.box.y-1&&b.x+b.width<=choice.box.x+choice.box.width+1&&b.y+b.height<=choice.box.y+choice.box.height+1,`${name}: choice text leaves its button: ${JSON.stringify(choice)}`);
      }
    }
    await page.screenshot({path:join(dir,name+'.png'),scale:'css'});row.steps.push({name,...info});
    console.log(spec.name,name,info?.step,info?.title,info?.body);
    return info;
  };
  const waitSelection=ids=>page.waitForFunction(wanted=>{const actual=[...window.__harness.game.scene.getScene('game').selectedIds].sort();return JSON.stringify(actual)===JSON.stringify([...wanted].sort());},ids);
  const select=async id=>{await tapUI(page,'game','card/'+id,spec.touch);};
  const settleAfterAction=async before=>{
    await page.waitForFunction(seq=>window.__harness.game.registry.get('runController')?.state.commandSeq>seq,before.commandSeq,{timeout:30000});
    await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation;},null,{timeout:30000});
  };
  try {
    await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');
    await tapUI(page,'title','action/title-start',spec.touch);await waitScene(page,'game');await waitReady();await guide('pair');
    await capture('01-pair-start');
    const initial=await state(),wrong=initial.handOrder.find(id=>id!=='clubs-5'&&id!=='hearts-5');assert.ok(wrong);
    await select(wrong);await waitSelection([wrong]);await capture('02-wrong-pair');
    await select(wrong);await waitSelection([]);
    await tapUI(page,'game','action/sort-rank',spec.touch);await waitReady();await capture('03-sorted');
    await select('clubs-5');await waitSelection(['clubs-5']);const one=await capture('04-one-five');
    const remaining=one.cards.find(card=>card.id==='hearts-5');assert.ok(remaining&&one.rings.some(ring=>sameBox(ring,remaining)),'ring follows the remaining five');
    await select('clubs-5');await waitSelection([]);await select('clubs-5');await select('hearts-5');await waitSelection(['clubs-5','hearts-5']);await capture('05-pair-ready');
    let before=await state();await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);await waitReady();await guide('discard');
    let current=await state();assert.equal(current.lastTrace.handType,'pair');assert.equal(current.lastTrace.finalScore,'90');
    await capture('06-pair-score');
    await page.waitForTimeout(3000);await capture('07-discard-instruction');
    const saved={runId:current.runId,seq:current.commandSeq};await page.reload();await waitScene(page,'title');await tapUI(page,'title','action/title-continue',spec.touch);await waitScene(page,'game');await waitReady();await guide('discard');
    current=await state();assert.equal(current.runId,saved.runId);assert.equal(current.commandSeq,saved.seq);await capture('08-restored');
    if(process.env.NOVICE_FIRST_OPENING_ONLY==='1'){row.status='OPENING_ONLY';continue;}
    if(spec.flow==='play'){
      await select('spades-14');await waitSelection(['spades-14']);await capture('09-free-play-selected');
      assert.equal((await point(page,'game','action/play')).enabled,true,'the player may bypass the example');
      before=await state();await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);await waitReady();await guide('independent');
      current=await state();assert.equal((await journal()).at(-1).action.type,'PlayHand');assert.equal(current.stage.discardsLeft,before.stage.discardsLeft);
      await capture('10-free-play-continues');assert.deepEqual(row.errors,[]);row.status='PASS';continue;
    }
    if(spec.flow==='skip'){
      const view=await measure(),candidates=view.cards.filter(card=>view.rings.some(ring=>sameBox(ring,card))).map(card=>card.id);
      const ordinary=current.handOrder.find(id=>!candidates.includes(id));assert.ok(ordinary,'an unhighlighted hand card is available');
      const close=page.locator('[data-novice-guide-close]');if(spec.touch)await close.tap();else await close.click();
      await page.locator('[data-novice-guide-panel]').waitFor({state:'hidden'});await select(ordinary);await waitSelection([ordinary]);
      assert.equal((await point(page,'game','action/discard')).enabled,true,'closing the guide restores ordinary discard selection');
      const reopen=page.locator('[data-novice-guide-reopen]');if(spec.touch)await reopen.tap();else await reopen.click();
      await guide('discard');await capture('09-reopen-alternative-selection');
      assert.equal((await point(page,'game','action/discard')).enabled,true,'reopening the guide never blocks a legal selection');
      await select(ordinary);await waitSelection([]);await capture('10-reopen-corrected');
      const skip=page.locator('[data-novice-guide-skip]');if(spec.touch)await skip.tap();else await skip.click();
      await waitScene(page,'character-select');current=await state();assert.equal(current.runId,saved.runId);assert.equal(current.commandSeq,saved.seq);
      row.skip='after reload, the skip control reaches the normal-game entry without altering the saved tutorial';
      assert.deepEqual(row.errors,[]);row.status='PASS';continue;
    }

    // A shorter, legal exchange remains possible at every step of the example.
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='先看看三张红桃');
    await capture('09-three-hearts');
    const intro=page.locator('[data-novice-guide-choice="flush-intro"]');if(spec.touch)await intro.tap();else await intro.click();
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='让同花色排在一起');await capture('09a-sort-instruction');
    before=await state();await tapUI(page,'game','action/sort-suit',spec.touch);await waitReady();
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='三张红桃排在一起了');current=await state();
    assert.ok(current.commandSeq>before.commandSeq);assert.equal((await journal()).at(-1).action.type,'ReorderHand');await capture('09b-sorted-hearts');
    const ack=page.locator('[data-novice-guide-choice="flush-sorted"]');if(spec.touch)await ack.tap();else await ack.click();
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='选左侧其他花色');
    await select('hearts-10');await waitSelection(['hearts-10']);const warning=await capture('10-heart-selected');
    assert.match(warning.body,/取消/);assert.equal((await point(page,'game','action/discard')).enabled,true,'even the alternative heart discard remains legal');
    await select('hearts-10');await waitSelection([]);
    const discarded=current.handOrder.filter(id=>!id.startsWith('hearts-')).slice(0,spec.discardCount);
    for(const id of discarded)await select(id);await waitSelection(discarded);await capture('11-alternative-discard');
    before=await state();await tapUI(page,'game','action/discard',spec.touch);await settleAfterAction(before);await waitReady();
    current=await state();assert.equal(current.stage.discardsLeft,before.stage.discardsLeft-1);assert.equal(current.stage.handsLeft,before.stage.handsLeft);
    assert.equal((await journal()).at(-1).action.type,'DiscardHand');assert.deepEqual(new Set((await journal()).at(-1).action.selectedIds),new Set(discarded));
    assert.ok(discarded.every(id=>!current.handOrder.includes(id)));row.discarded=discarded;row.replacement=current.handOrder.filter(id=>!before.handOrder.includes(id));
    assert.equal(row.replacement.length,discarded.length);

    const waitChoices=async()=>{
      await page.locator('[data-novice-guide-choice]').first().waitFor({state:'visible',timeout:30000});
      await page.waitForFunction(()=>{
        const hand=window.__harness.game.registry.get('runController').state.handOrder;
        const buttons=[...document.querySelectorAll('[data-novice-guide-choice]')].filter(el=>el.getClientRects().length);
        return buttons.length&&buttons.every(el=>{try {const ids=JSON.parse(el.dataset.cardIds);return ids.length&&ids.every(id=>hand.includes(id));}catch{return false;}});
      });
    };
    await waitChoices();
    const afterExchange=await capture('12-real-refill');const hearts=current.handOrder.filter(id=>id.startsWith('hearts-')).length;
    assert.match(afterExchange.body,new RegExp(hearts+'张红桃'),'the lesson reports the real replacement outcome');
    const used=[];
    for(let hand=0;hand<4;hand++){
      await waitChoices();
      const info=await capture(`13-${hand}-available-hands`);
      assert.ok(info.choices.length>=1&&info.choices.length<=2,'one or two actual choices are shown');
      if(hand===0)assert.equal(info.choices.length,2,'the player can compare two different hands after replacement');
      for(const choice of info.choices){
        const ids=JSON.parse(choice.ids);assert.ok(ids.length>=1&&ids.length<=5&&ids.every(id=>current.handOrder.includes(id)),`choice must use the actual hand: ${JSON.stringify(choice)}`);
        assert.match(choice.text,/\d+\s*分/,`a score estimate is shown: ${choice.text}`);
      }
      // On later turns choose the visibly higher estimate; the first choice is intentionally varied across cases.
      const estimate=c=>Number(c.text.match(/(\d+)\s*分/)?.[1]??0);
      const option=hand===0?Math.min(spec.choiceIndex,info.choices.length-1):info.choices.reduce((best,c,i)=>estimate(c)>estimate(info.choices[best])?i:best,0);
      const target=info.choices[option],ids=JSON.parse(target.ids);
      const choice=page.locator('[data-novice-guide-choice]').nth(option);if(spec.touch)await choice.tap();else await choice.click();
      assert.deepEqual(await selection(),[],'choosing a plan does not automatically choose cards');
      await page.waitForTimeout(180);let picked=await capture(`14-${hand}-plan-chosen`);
      assert.ok(ids.some(id=>{const card=picked.cards.find(card=>card.id===id);return card&&picked.rings.some(ring=>sameBox(ring,card));}),`the selected plan highlights actual cards: ${JSON.stringify({target,picked})}`);
      if(hand===0){
        // An incorrect card must be cancellable and the explanation must respond.
        const wrongId=current.handOrder.find(id=>!ids.includes(id));assert.ok(wrongId);
        await select(wrongId);await waitSelection([wrongId]);const error=await capture('15-wrong-card');
        assert.match(error.body,/取消|去掉|选错|先点/,'the guide tells the player how to correct a wrong selection');
        await select(wrongId);await waitSelection([]);await capture('16-corrected');
        await tapUI(page,'game','action/sort-suit',spec.touch);await waitReady();
        picked=await capture('17-sorted-plan');
        assert.ok(ids.some(id=>{const card=picked.cards.find(card=>card.id===id);return card&&picked.rings.some(ring=>sameBox(ring,card));}),'highlight follows the chosen cards after sorting');
      }
      const selected=[];
      while(selected.length<ids.length){
        const view=await measure();
        const next=ids.find(id=>!selected.includes(id)&&view.cards.some(card=>card.id===id&&view.rings.some(ring=>sameBox(ring,card))));
        assert.ok(next,`a remaining required card is visually highlighted: ${JSON.stringify({ids,selected,view})}`);
        await select(next);selected.push(next);await waitSelection(selected);await waitReady();
      }
      await capture(`18-${hand}-ready-to-play`);
      before=await state();await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);current=await state();
      assert.equal((await journal()).at(-1).action.type,'PlayHand');
      assert.deepEqual(new Set((await journal()).at(-1).action.selectedIds),new Set(ids));
      assert.equal(current.lastTrace.handType,target.id,'the chosen label matches the hand that scored');
      assert.equal(Number(current.lastTrace.finalScore),estimate(target),'the displayed first-stage estimate agrees with the actual score');
      used.push({choice:target.text,ids,score:current.lastTrace.finalScore,cumulative:current.stage.heat,target:current.stage.targetHeat});
      if(current.phase==='stage-cleared')break;
      assert.equal(current.phase,'await-input');await waitReady();
    }
    row.hands=used;assert.equal(current.phase,'stage-cleared','guided route reaches the first-stage goal');
    assert.ok(Number(current.stage.heat)>=400&&Number(current.stage.targetHeat)===400,'the original 400-point goal is reached');
    await waitScene(page,'intermission');await capture('19-stage-cleared',false);
    assert.deepEqual(row.errors,[]);row.status='PASS';
  } catch(error){
    row.status='FAIL';row.error=String(error.stack??error);console.error(spec.name,row.error);await page.screenshot({path:join(dir,'failure.png')}).catch(()=>{});
  } finally {
    await cdp?.detach();const video=page.video();await context.close();if(video){const source=await video.path(),target=join(dir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);}
    await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
}} finally {
  await browser.close();await server.close();
  report.commitAfter=git('rev-parse','HEAD');report.sourceAfter=sourceFingerprint();
  if(report.commitAfter!==report.testedCommit||report.sourceAfter!==report.sourceBefore){report.sourceChangedDuringRun=true;process.exitCode=1;}
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
}
if(report.cases.some(row=>row.status==='FAIL'))process.exitCode=1;
