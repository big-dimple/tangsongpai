import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';
import {enterCurrentStage} from './stage-entry.mjs';
const port=Number(process.env.ENTRY_PORT||5605),out='shots/entry-caption';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port,strictPort:true},logLevel:'error'});await server.listen();
const {workshopLayoutFixture}=await server.ssrLoadModule('/harness/fixtures/workshop-layout.ts');
const {makeCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {r2ModeStorageKey}=await server.ssrLoadModule('/src/content/r2Modes.ts');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const report={cases:[]};
try{
 for(const width of (process.env.ENTRY_WIDTH?[Number(process.env.ENTRY_WIDTH)]:[1366,390]))for(const dpr of (process.env.ENTRY_DPR?[Number(process.env.ENTRY_DPR)]:[1,2,3])){
  const touch=width<700,height=touch?844:768,p=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr,hasTouch:touch,reducedMotion:process.env.ENTRY_REDUCED==='1'?'reduce':'no-preference'}),row={width,height,dpr,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
  try{
   await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');const state=workshopLayoutFixture(0).state,checkpoint=makeCheckpoint(state,[]),slotKey=r2ModeStorageKey(state,state.contentHash);
   await p.evaluate(({checkpoint,slotKey})=>new Promise((resolve,reject)=>{const open=indexedDB.open('tangsongpai-checkpoints',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const tx=open.result.transaction('saves','readwrite'),store=tx.objectStore('saves');store.put({current:checkpoint,previous:null},slotKey);store.put({revision:1,slotKey},'meta');tx.oncomplete=()=>{open.result.close();resolve();};tx.onerror=()=>reject(tx.error);};}),{checkpoint,slotKey});
   await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',touch);await waitScene(p,'shop');await p.waitForFunction(()=>!document.querySelector('#resource-loading[open],#resource-preparation[open]'));
   await p.evaluate(mode=>{window.__entryMode=mode;},process.env.ENTRY_CONSUMED==='1'?'__consumed__':'normal');await p.evaluate(async()=>{const m=await import('/src/game/TangSongEntranceBurst.ts');m.resetHeroEntranceForNewRun();if('__consumed__'===window.__entryMode){const stop=m.mountHeroEntranceBurst(document.body,'laohuan',{context:'select',playAudio:false});stop();}});
   await tapUI(p,'shop','action/start-stage',touch);if(process.env.ENTRY_CAPTURE_BURST==='1'){await p.waitForSelector('dialog.blind-select-dialog[data-context="entrance"][open]');await p.waitForTimeout(350);await p.screenshot({path:`${out}/burst-${width}-dpr${dpr}.png`,scale:'device'});}await enterCurrentStage(p,touch);
   if(process.env.ENTRY_REDUCED==='1'||process.env.ENTRY_CONSUMED==='1'){await p.waitForTimeout(2600);assert.equal(await p.evaluate(()=>!!window.__harness.game.scene.getScene('game').view.root.getByName('opening/continuation')?.active),false);assert.deepEqual(row.errors,[]);row.status='PASS';continue;}await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').view.root.getByName('opening/continuation')?.active,null,{timeout:8000});
   row.first=await p.evaluate(()=>{const g=window.__harness.game.scene.getScene('game'),cue=g.view.root.getByName('opening/continuation'),t=cue.getByName('opening/continuation-text'),controls=[g.playButton,g.discardButton,...g.cardViews.map(c=>c.hit)],box=o=>{const b=o.getBounds();return{x:b.x,y:b.y,width:b.width,height:b.height};};return {cue:cue.getData('cueBounds'),interactive:!!cue.input,controls:controls.filter(o=>o?.visible).map(box),text:t.text,resolution:t.style.resolution,sourceResolution:t.frame.source.resolution,zoom:g.scale.zoom};});
   assert.equal(row.first.interactive,false);assert.equal(row.first.resolution,1/row.first.zoom);assert.equal(row.first.sourceResolution,row.first.resolution);for(const b of row.first.controls){const a=row.first.cue;assert.ok(!(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height),'entry caption overlaps input');}
   await p.screenshot({path:`${out}/stage-${width}-dpr${dpr}.png`,scale:'device'});await p.waitForFunction(()=>!window.__harness.game.scene.getScene('game').view.root.getByName('opening/continuation')?.active,null,{timeout:8000});assert.deepEqual(row.errors,[]);row.status='PASS';
  }finally{await p.close();}
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;}finally{await browser.close();await server.close();await writeFile(`${out}/report${process.env.ENTRY_REDUCED==='1'?'-reduced':process.env.ENTRY_CONSUMED==='1'?'-consumed':process.env.ENTRY_CAPTURE_BURST==='1'?'-burst':''}.json`,JSON.stringify(report,null,2));}
