import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openRunMenu} from './ui.mjs';

const out=resolve(process.env.POKER_ENCOUNTER_OUTPUT??'shots/poker-encounter/browser-'+Date.now()),port=5741;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve(out,'vite'),server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
const report={status:'RUNNING',scope:'Fixed seed; declared mature inventory and native clear income, actual native clear commands to first encounter. Real DOM/mouse/touch, IndexedDB. PC Chromium and phone emulation, original speed1. Not natural acquisition/balance evidence or a physical device.',cases:[]};
let browser;
const snap=p=>p.evaluate(async()=>{const r=window.__harness.game.registry.get('runController');return {state:r.state,journal:r.journal,slots:await r.store.read()};});
const native=async(p,name,touch)=>{const b=p.getByRole('button',{name,exact:true});if(touch)await b.tap();else await b.click();};
const dialog=p=>p.locator('dialog.poker-encounter[open]');
const events=p=>p.evaluate(()=>window.__pokerEvents);
async function inject(p,cp){await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const s=new IndexedDbSave();await s.commit((await s.read()).revision,cp,null);},cp);}
async function start(p,touch,fromClear=false){await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);if(fromClear){await waitScene(p,'intermission');await tapUI(p,'intermission','action/continue-stage',touch);}await waitScene(p,'shop');await dialog(p).waitFor({state:'visible'});}
async function select(p,touch){await p.getByRole('button',{name:'♥A',exact:true}).scrollIntoViewIfNeeded();await native(p,'♥A',touch);await p.getByRole('button',{name:'确认赋予 · 18金',exact:true}).waitFor();}
try{
 const {pokerEncounterBeforeShop,pokerEncounterFixture}=await server.ssrLoadModule('/tests/fixtures/poker-encounter.ts');
 const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
 const f=pokerEncounterBeforeShop(),gold=f.state.gold;
 const cp=makeCheckpoint(f.state,f.journal);assert.ok(readCheckpoint(cp).ok);
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'});report.browser=browser.version();
 for(const spec of [{key:'pc',width:1366,height:768,touch:false,reduced:false},{key:'phone-reduced',width:390,height:844,touch:true,reduced:true}]){
  const row={key:spec.key,status:'RUNNING',errors:[]};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,isMobile:spec.touch,recordVideo:{dir:out,size:{width:spec.width,height:spec.height}}});
  const p=await context.newPage();p.setDefaultTimeout(25000);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
  try{
   await p.addInitScript(reduced=>{localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:reduced}));window.__pokerEvents=[];document.addEventListener('tangsongpai:poker-encounter-view',e=>window.__pokerEvents.push(e.detail));},spec.reduced);
   await p.goto('http://127.0.0.1:'+port+'/?harness=1');await waitScene(p,'title');await inject(p,cp);await start(p,spec.touch,true);
   assert.equal((await events(p)).filter(e=>e.type==='EncounterEntered').length,1);row.freshEntry=true;
   await p.screenshot({path:resolve(out,spec.key+'-selection.png')});const before=await snap(p);
   await select(p,spec.touch);await p.screenshot({path:resolve(out,spec.key+'-confirmation.png')});await native(p,'返回选牌',spec.touch);assert.deepEqual(await snap(p),before);row.cancelUnchanged=true;
   if(!spec.touch){
    await p.evaluate(()=>{const r=window.__harness.game.registry.get('runController'),commit=r.store.commit.bind(r.store);window.__pokerCommitCalls=0;r.store.commit=async(...args)=>{if(++window.__pokerCommitCalls===1)throw new DOMException('Poker injected quota','QuotaExceededError');return commit(...args);};});
    await select(p,false);const b=await p.getByRole('button',{name:'确认赋予 · 18金',exact:true}).boundingBox();await p.mouse.click(b.x+b.width/2,b.y+b.height/2,{clickCount:2,delay:20});await p.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='paused');assert.deepEqual(await snap(p),before);assert.equal((await events(p)).some(e=>['PurchaseCommitted','GrantPresented'].includes(e.type)),false);row.failedSaveUnpublished=true;
    await openRunMenu(p,false);await native(p,'重试保存',false);await waitScene(p,'shop');await dialog(p).waitFor({state:'visible'});const retried=await snap(p);assert.equal(retried.state.gold,gold-18);assert.equal(retried.journal.filter(c=>c.action.type==='BuyPokerPolychrome').length,1);assert.equal((await p.evaluate(()=>window.__pokerCommitCalls)),2);row.exactRetryPaidOnce=true;
    await start(p,false);assert.deepEqual((await snap(p)).state,retried.state);assert.equal((await events(p)).some(e=>['PurchaseCommitted','GrantPresented'].includes(e.type)),false);assert.ok((await events(p)).some(e=>e.type==='Restored'));row.retryColdRestore=true;
    // Start the same fixed fixture again to observe the direct successful commit events.
    await inject(p,cp);await start(p,false,true);
   }
   await select(p,spec.touch);await native(p,'确认赋予 · 18金',spec.touch);await p.getByRole('dialog',{name:'纸上流彩 · 已赋予',exact:true}).waitFor();const paid=await snap(p);assert.equal(paid.state.gold,gold-18);assert.equal(paid.state.deckInstances.find(c=>c.id==='hearts-14').edition,'polychrome');assert.equal(paid.state.deckInstances.find(c=>c.id==='hearts-14').enhancement,undefined);assert.equal(paid.journal.filter(c=>c.action.type==='BuyPokerPolychrome').length,1);for(const type of ['PurchaseCommitted','GrantPresented'])assert.equal((await events(p)).filter(e=>e.type===type).length,1);row.committedEvents=(await events(p)).map(e=>({type:e.type,id:e.id,targetId:e.targetId,reducedMotion:e.reducedMotion,receipt:e.view.receipt}));await p.screenshot({path:resolve(out,spec.key+'-saved-result.png')});
   await start(p,spec.touch);assert.deepEqual((await snap(p)).state,paid.state);assert.equal((await events(p)).some(e=>['PurchaseCommitted','GrantPresented'].includes(e.type)),false);row.coldRestoreNoGrant=true;
   // Poor player may inspect/return/skip; none secretly reserves or charges.
   const poor=pokerEncounterFixture();poor.state.gold=17;poor.state.deckInstances.find(c=>c.id==='hearts-2').edition='foil';await inject(p,makeCheckpoint(poor.state,poor.journal));await start(p,spec.touch);assert.equal(await p.getByRole('button',{name:'♥2',exact:true}).isDisabled(),true);row.existingEditionDisabled=true;await select(p,spec.touch);assert.equal(await p.getByRole('button',{name:'确认赋予 · 18金',exact:true}).isDisabled(),true);await p.screenshot({path:resolve(out,spec.key+'-insufficient.png')});await native(p,'返回选牌',spec.touch);await native(p,'跳过本次奇遇',spec.touch);await p.waitForFunction(()=>window.__harness.game.registry.get('runController').state.pokerEncounter.opportunities.at(-1).status==='skipped');assert.equal((await snap(p)).state.gold,17);row.poorSkipNoPayment=true;
   await start(p,spec.touch);assert.equal((await snap(p)).state.pokerEncounter.opportunities.at(-1).status,'skipped');await p.screenshot({path:resolve(out,spec.key+'-skipped-restored.png')});row.skippedColdRestore=true;
   const leave=pokerEncounterFixture();await inject(p,makeCheckpoint(leave.state,leave.journal));await start(p,spec.touch);await native(p,'返回商店',spec.touch);await tapUI(p,'shop','action/start-stage',spec.touch);await waitScene(p,'game');assert.equal((await snap(p)).state.pokerEncounter.opportunities.at(-1).status,'skipped');assert.equal((await snap(p)).state.gold,32);row.leavingExpiresNoCharge=true;
   if(!spec.touch){const {createRun}=await server.ssrLoadModule('/src/domain/run.ts'),{newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts'),{r2HouseProfile}=await server.ssrLoadModule('/src/domain/r2GroupUpgrade.ts');const old=createRun({seed:'poker-old-ui',runId:'controlled/poker-old-ui',characterId:'laohuan',rulesVersion:'r2',r2Identity:r2HouseProfile(newRunIdentity('laohuan','group')).pokerBase,openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});await inject(p,makeCheckpoint(old,[]));await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',false);await waitScene(p,'shop');assert.equal((await snap(p)).state.contentHash,old.contentHash);assert.equal((await snap(p)).state.pokerEncounter,undefined);assert.equal(await dialog(p).count(),0);row.oldIdentityColdRestore=true;}
   assert.deepEqual(row.errors,[]);row.status='PASS';console.log(spec.key+': PASS');
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);row.dom=await p.locator('dialog[open]').allTextContents().catch(()=>[]);row.events=await events(p).catch(()=>[]);await p.screenshot({path:resolve(out,spec.key+'-FAIL.png')}).catch(()=>{});throw error;}
  finally{await context.close();await p.video()?.saveAs(resolve(out,spec.key+'-original-speed.webm'));}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));await browser?.close();await server.close();}
