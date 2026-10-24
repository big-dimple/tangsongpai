import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openRunMenu} from './ui.mjs';

const out=resolve(process.env.B03_RESCUE_OUTPUT??'shots/b03-rescue'),port=5734;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve(out,'vite'),server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
const report={status:'RUNNING',scope:'Controlled valid checkpoint in isolated browser contexts, real mouse/touch UI and IndexedDB transactions. Chromium PC 1366x768 and phone emulation 390x844/reduced motion. Not a user save, natural acquisition run, or physical device.',cases:[]};
let browser;
const snap=p=>p.evaluate(async()=>{const r=window.__harness.game.registry.get('runController');return {state:r.state,journal:r.journal,slots:await r.store.read()};});
async function settled(p){await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s?.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing);});}
async function start(p,touch){await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'game');for(const label of ['开始出牌','关闭']){const b=p.getByRole('button',{name:label,exact:true});if(await b.isVisible().catch(()=>false))await b.click();}await settled(p);}
const native=async(p,name,touch)=>{const b=p.getByRole('button',{name,exact:true});if(touch)await b.tap();else await b.click();};
const visible=p=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),b=s.bossSuitRescueButton;return {label:b?.getData('label')?.text,preview:s.bossSuitRescuePreview?.text,button:b?.getBounds(),caption:s.resultText.getBounds(),marks:s.cardViews.map(v=>({id:v.card.id,mark:v.scoringMark.text,pressure:!!v.container.getData('bossPressure'),suit:v.card.suit})),score:s.run.lastTrace?.finalScore};});
try{
  const {b03RescueFixture,rescueStep}=await server.ssrLoadModule('/tests/fixtures/b03-rescue.ts');
  const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
  const f=b03RescueFixture(),first=rescueStep(f.state,{type:'PlayHand',selectedIds:[f.state.handOrder[0]]});
  const initial=first.state,checkpoint=makeCheckpoint(initial,[...f.journal,first.command]);assert.ok(readCheckpoint(checkpoint).ok);assert.equal(initial.stage.handsLeft,3);
  await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'});
  report.browser=browser.version();
  for(const spec of [{width:1366,height:768,touch:false,reduced:false},{width:390,height:844,touch:true,reduced:true}]){
    const key=spec.touch?'phone-reduced':'pc',row={key,status:'RUNNING',errors:[]};report.cases.push(row);
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,isMobile:spec.touch});
    const p=await context.newPage();p.setDefaultTimeout(25000);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
    try{
      await p.addInitScript(reduced=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:4,reducedMotion:reduced})),spec.reduced);
      await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');
      await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const store=new IndexedDbSave();await store.commit((await store.read()).revision,cp,null);},checkpoint);await start(p,spec.touch);
      const before=await snap(p);assert.deepEqual(before.state,initial);
      await tapUI(p,'game','boss/suit-rescue',spec.touch);await p.screenshot({path:resolve(out,key+'-confirm.png')});await native(p,'返回牌桌',spec.touch);assert.deepEqual(await snap(p),before);row.cancelUnchanged=true;
      // Fail one real IndexedDB commit; existing menu retries the exact same pending candidate.
      await p.evaluate(()=>{const r=window.__harness.game.registry.get('runController'),commit=r.store.commit.bind(r.store);window.__b03Commits=0;r.store.commit=async(...args)=>{window.__b03Commits++;if(window.__b03Commits===1)throw new DOMException('B03 injected quota','QuotaExceededError');return commit(...args);};});
      await tapUI(p,'game','boss/suit-rescue',spec.touch);const confirm=p.getByRole('button',{name:'花5金，准备解封',exact:true}),box=await confirm.boundingBox();if(spec.touch){await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}else await p.mouse.click(box.x+box.width/2,box.y+box.height/2,{clickCount:2,delay:20});row.doubleConfirm=true;await p.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='paused');assert.deepEqual(await snap(p),before);row.failedPurchaseUnpublished=true;
      await openRunMenu(p,spec.touch);await native(p,'重试保存',spec.touch);await waitScene(p,'game');await settled(p);
      let pending=await snap(p);assert.equal(pending.state.gold,1);assert.equal(pending.state.stage.bossSuitRescue.status,'pending');assert.equal(pending.journal.filter(c=>c.action.type==='BuyBossSuitRescue').length,1);row.retryCommitCalls=await p.evaluate(()=>window.__b03Commits);
      // Reload pending purchase; no new payment and the exact opportunity survives.
      await start(p,spec.touch);assert.deepEqual((await snap(p)).state,pending.state);row.pendingColdRestore=true;
      await tapUI(p,'game','card/'+pending.state.handOrder[0],spec.touch);await tapUI(p,'game','action/discard',spec.touch);await settled(p);pending=await snap(p);assert.equal(pending.state.stage.bossSuitRescue.status,'pending');
      const ranks=new Set(),ids=pending.state.handOrder.filter(id=>{const rank=pending.state.deckInstances.find(c=>c.id===id).rank;if(ranks.has(rank))return false;ranks.add(rank);return true;}).slice(0,5);for(const id of ids)await tapUI(p,'game','card/'+id,spec.touch);row.pendingView=await visible(p);assert.ok(row.pendingView.marks.every(m=>m.mark==='本手解封'&&!m.pressure&&m.suit==='hearts'));assert.match(row.pendingView.preview,/解封本手预计 \d+分/);await p.screenshot({path:resolve(out,key+'-pending-preview.png')});
      await tapUI(p,'game','action/play',spec.touch);await settled(p);const used=await snap(p);assert.equal(used.state.stage.bossSuitRescue.status,'used');assert.equal(used.state.lastTrace.bossSuitRescue,pending.state.stage.bossSuitRescue.purchase.commandId);assert.equal(used.state.phase,'await-input');assert.ok(BigInt(used.state.stage.heat)<BigInt(used.state.stage.targetHeat));assert.deepEqual(used.state.stage.disabledIds,used.state.handOrder);assert.deepEqual(used.state.deckInstances,initial.deckInstances);assert.equal(used.state.lastTrace.handType,'flush');row.handType='flush';row.restoredScore=used.state.lastTrace.finalScore;row.heat=used.state.stage.heat;row.target=used.state.stage.targetHeat;row.usedView=await visible(p);await p.screenshot({path:resolve(out,key+'-used-sealed.png')});
      await start(p,spec.touch);assert.deepEqual((await snap(p)).state,used.state);row.usedColdRestore=true;
      await tapUI(p,'game','card/'+used.state.handOrder[0],spec.touch);await tapUI(p,'game','action/play',spec.touch);await settled(p);const after=await snap(p);assert.equal(after.state.lastTrace.bossSuitRescue,undefined);assert.deepEqual(after.state.lastTrace.sets.activeScoringIds,[]);row.nextSealedScore=after.state.lastTrace.finalScore;assert.ok(BigInt(row.restoredScore)>BigInt(row.nextSealedScore));assert.deepEqual(row.errors,[]);row.status='PASS';console.log(key+': PASS');
    }catch(error){row.status='FAIL';row.error=String(error.stack??error);row.observation=await visible(p).catch(()=>null);await p.screenshot({path:resolve(out,key+'-FAIL.png')}).catch(()=>{});throw error;}
    finally{await context.close();}
  }
  report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser?.close();await server.close();}
