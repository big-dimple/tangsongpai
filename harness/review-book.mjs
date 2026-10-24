/** Bounded controlled evidence. Validated session import -> actual UI PlayHand -> saved U09 event.
 * No natural acquisition, physical-device, audio or aesthetic acceptance claim. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {tapUI,waitScene} from './ui.mjs';

const out=process.env.REVIEW_BOOK_OUTPUT??'/tmp/review-book-evidence',port=Number(process.env.REVIEW_BOOK_PORT??5583);
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',logLevel:'error',server:{host:'127.0.0.1',port,strictPort:true}});
const {reviewBookReady}=await server.ssrLoadModule('/harness/fixtures/review-book.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {energySend}=await server.ssrLoadModule('/harness/fixtures/hero-climax.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {reviewBookReceipt}=await server.ssrLoadModule('/src/game/ReviewBookReceipt.ts');
const {itemInfo}=await server.ssrLoadModule('/src/game/r2ToolInfo.ts');
const fixture=reviewBookReady(),checkpoint=makeCheckpoint(fixture.state,[]);
assert.ok(readCheckpoint(checkpoint).ok);
await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source:'controlled ownership/levels/history loaded through existing validated session.importJSON, unchanged real scorer and UI inputs for final PlayHand; not natural acquisition or physical device',cases:[]};
const saved=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};});
const regions=p=>p.evaluate(()=>{
 const s=window.__harness.game.scene.getScene('intermission'),all=[],walk=list=>{for(const o of list){all.push(o);if(o.list)walk(o.list);}};walk(s.view.root.list);
 const named=name=>all.find(o=>o.name===name),receipt=named('result/review-book'),art=named('result-art/review-book'),motion=named('result/review-book-motion');
 return {receipt:receipt?{text:receipt.text,eventId:receipt.getData('sourceEventId'),clearId:receipt.getData('clearId'),bounds:receipt.getBounds()}:null,
  art:art?{asset:art.getData('assetId'),bounds:art.getBounds(),interactive:!!art.input}:null,
  subtitle:named('result/review-book-saved')?.getBounds(),motion:!!motion,alpha:motion?.alpha,
  reward:named('result/reward')?.getBounds(),button:!!named('action/continue-stage')?.input?.enabled,
  receipts:all.filter(o=>o.name==='result/review-book').length};
});
async function imp(p,state,scene='game'){
 await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');
 // The current menu has no file-import control. Controlled setup calls the existing
 // validating/persisting import API, then the existing saved-run router. No event injection.
 const imported=await p.evaluate(async text=>{
  const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts');
  if(!gameSession().lease.writable&&!await gameSession().takeOver())throw Error('controlled import lease unavailable');
  if(!await gameSession().importJSON(text))throw Error(gameSession().notice);
  routeSavedRun(window.__harness.game);return true;
 },JSON.stringify(makeCheckpoint(state,[])));assert.equal(imported,true);
 await waitScene(p,scene);await p.waitForFunction(scene=>window.__harness.game.scene.getScene(scene).ready,scene);
}
try{
 for(const [key,viewport,reduced,artMode] of [
  ['desktop',{width:1366,height:768},false,'normal'],
  ['mobile',{width:390,height:844},false,'normal'],
  ['mobile-reduced',{width:390,height:844},true,'normal'],
  ['mobile-slow-art',{width:390,height:844},false,'slow'],
  ['mobile-missing-art',{width:390,height:844},false,'missing'],
 ]){
  const touch=viewport.width<700,context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference',...(key==='mobile'?{recordVideo:{dir:out+'/video',size:viewport}}:{})}),p=await context.newPage(),row={key,viewport,reduced,artMode,errors:[]};report.cases.push(row);
  p.setDefaultTimeout(30000);p.on('pageerror',e=>row.errors.push(e.stack));p.on('dialog',d=>d.accept());
  // Keep the hand replay short using the existing player preference, not engine mutation.
  await p.addInitScript(()=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:4,reducedMotion:false})));
  // Data Saver is a controlled cold-art environment: the existing warmup policy
  // skips speculative catalog downloads, leaving the receipt's own optional load.
  if(artMode!=='normal')await p.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true,effectiveType:'4g'},configurable:true}));
  if(artMode!=='normal')await p.route('**/*',async route=>{
   if(new URL(route.request().url()).pathname!==new URL(itemInfo('U09').artUrl,'http://local').pathname)return route.continue();
   if(artMode==='missing')return route.fulfill({status:404,body:''});
   await new Promise(resolve=>setTimeout(resolve,1500));await route.continue().catch(()=>{});
  });
  try{
   await imp(p,fixture.state);
   if(await p.getByRole('button',{name:'开始出牌',exact:true}).isVisible())await p.getByRole('button',{name:'开始出牌',exact:true}).click();
   row.before=await saved(p);
   for(const id of fixture.action.selectedIds)await tapUI(p,'game','card/'+id,touch);
   await tapUI(p,'game','action/play',touch);
   const withoutSkill=p.getByRole('button',{name:'继续出牌',exact:true});
   if(await withoutSkill.isVisible())await withoutSkill[touch?'tap':'click']();
   await waitScene(p,'intermission');
   row.entry=await regions(p);row.after=await saved(p);
   row.source=reviewBookReceipt(row.after.state,true);assert.equal(row.source.label,'复盘本：两对 Lv2→Lv3');
   assert.equal(row.entry.receipt.text,row.source.label);assert.equal(row.entry.receipt.eventId,row.source.eventId);assert.equal(row.entry.receipts,1);
   assert.equal(row.entry.motion,!reduced);assert.equal(row.entry.button,true);
   await p.screenshot({path:out+'/'+key+'-entry.png'});
   const command={runId:fixture.state.runId,commandId:row.after.state.receipts.at(-1).commandId,expectedSeq:fixture.state.commandSeq,action:fixture.action},expected=applyCommand(fixture.state,command);
   assert.ok(expected.ok);assert.deepEqual(row.after.state,expected.state);assert.deepEqual(row.after.journal,[...row.before.journal,command]);assert.deepEqual(row.after.storage.current.state,row.after.state);
   if(artMode==='slow'){
    assert.equal(row.entry.art,null);assert.equal(row.entry.motion,true);
    await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('intermission'),walk=l=>l.some(o=>o.name==='result-art/review-book'||o.list&&walk(o.list));return walk(s.view.root.list);});
   }
   await p.waitForTimeout(1000);row.settled=await regions(p);assert.equal(row.settled.motion,false);assert.equal(row.settled.receipts,1);
   if(artMode==='missing')assert.equal(row.settled.art,null);else assert.equal(row.settled.art.asset,'U09');
   const r=row.settled;assert.ok(r.receipt.bounds.x>=0&&r.receipt.bounds.x+r.receipt.bounds.width<=viewport.width);
   assert.ok(r.receipt.bounds.y>=0&&r.receipt.bounds.y+r.receipt.bounds.height<=viewport.height);
   assert.ok(r.reward.y>=r.subtitle.y+r.subtitle.height+7,'receipt stays above reward');
   await p.screenshot({path:out+'/'+key+'-settled.png'});assert.deepEqual(await saved(p),row.after);
   await p.setViewportSize({width:viewport.width,height:viewport.height-100});await p.waitForTimeout(150);
   row.resize=await regions(p);assert.equal(row.resize.motion,false);assert.equal(row.resize.receipts,1);assert.deepEqual(await saved(p),row.after);
   await p.setViewportSize(viewport);await p.waitForTimeout(150);
   // Blur and a real detail open/close cannot replay or dispatch an upgrade.
   await p.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await regions(p)).motion,false);
   await tapUI(p,'intermission','action/last-hand',touch);await p.getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual(await saved(p),row.after);
   await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'intermission');
   row.restored=await regions(p);assert.equal(row.restored.motion,false);assert.equal(row.restored.receipt.text,row.source.label);assert.equal(row.restored.receipts,1);assert.deepEqual((await saved(p)).state,row.after.state);
   await p.screenshot({path:out+'/'+key+'-restored.png'});
   await tapUI(p,'intermission','action/continue-stage',touch);await waitScene(p,'shop');
   const next=await saved(p);assert.equal(next.state.commandSeq,row.after.state.commandSeq+1);assert.equal(next.state.handLevels['two-pair'],3);
   assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',key);
  }catch(e){row.status='FAIL';row.error=e.stack;await p.screenshot({path:out+'/'+key+'-FAIL.png'}).catch(()=>{});throw e;}
  finally{const video=p.video();await context.close();if(video)await video.saveAs(out+'/'+key+'.webm');await writeFile(out+'/report.json.gz',gzipSync(JSON.stringify(report)));}
 }
 const p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.on('dialog',d=>d.accept());
 try{
  for(const [kind,owned] of [['ordinary',true],['boss-loss',true],['boss-win',false]]){
   const f=reviewBookReady(kind,owned),run=energySend(f.state,f.action),key=kind+(owned?'-owned':'-unowned');
   await imp(p,run,'intermission');const r=await regions(p);assert.equal(r.receipt,null);assert.equal(r.motion,false);
   await p.screenshot({path:out+'/'+key+'.png'});report.cases.push({key,status:'PASS',regions:r,trace:run.lastTrace});console.log('PASS',key);
  }
 }finally{await p.close();}
 report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);}
finally{
 await browser.close();await server.close();
 await writeFile(out+'/report.json.gz',gzipSync(JSON.stringify(report)));
 await writeFile(out+'/summary.json',JSON.stringify({...report,cases:report.cases.map(({before,after,trace,...row})=>row)},null,2));
}
