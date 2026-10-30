import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out=resolve(process.env.PLAYING_CARD_OUTPUT??'shots/playing-card-iridescence'),port=5757;await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:resolve(out,'vite'),server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const {settlementReady}=await server.ssrLoadModule('/harness/fixtures/settlement.ts');const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const s=settlementReady('boss-win').state;const hand=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id));hand.forEach((c,i)=>c.edition=i<5?'polychrome':i===5?'foil':i===6?'holographic':'none');hand[0].suit='clubs';
const cp=makeCheckpoint(s,[]);assert.ok(readCheckpoint(cp).ok,'valid controlled checkpoint');
const browser=await chromium.launch({headless:true,executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium'});const report={scope:'Controlled saved boss hand, real GameScene rendering and mouse/touch; Chromium PC and emulated phone, not physical-device performance.',cases:[],status:'RUNNING'};
try{for(const spec of [{key:'pc',width:1366,height:768,touch:false},{key:'phone',width:390,height:844,touch:true}]){
 const row={key:spec.key,errors:[],frames:[]};report.cases.push(row);const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.touch?2:1,hasTouch:spec.touch,isMobile:spec.touch});const p=await context.newPage();p.on('pageerror',e=>row.errors.push(String(e)));p.setDefaultTimeout(25000);
 try{
  await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');await p.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');const store=new IndexedDbSave();await store.commit((await store.read()).revision,cp,null);},cp);await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',spec.touch);await waitScene(p,'game');await p.waitForFunction(()=>{const g=window.__harness.game.scene.getScene('game');return g.ready&&g.cardViews.length===8&&g.cardViews.every(v=>!v.dealing&&!v.back?.visible);});
  if(await p.locator('.detail-dialog[open]').count())await p.keyboard.press('Escape');
  const collect=()=>p.evaluate(()=>{const g=window.__harness.game.scene.getScene('game');return g.cardViews.map(v=>{const list=v.container.getData('cardBodyRoot').list,e=list.find(x=>x.name==='card/playing-card-iridescence');return {id:v.card.id,edition:v.card.edition,edge:!!e,phase:e?.getData('phase'),draws:e?.getData('draws'),motion:e?.getData('motion'),belowIndex:e?list.indexOf(e)<list.findIndex(x=>x.name==='rank-index'):false,pressure:v.container.getData('bossPressure')?.kind,selected:g.selectedIds.has(v.card.id)};});});
  let a=await collect();assert.equal(a.filter(x=>x.edge).length,5);assert.ok(a.filter(x=>x.edge).every(x=>x.belowIndex));assert.equal(a[0].pressure,'scoring');assert.ok(a.slice(5).every(x=>!x.edge));
  await p.evaluate(()=>{const g=window.__harness.game;window.__frameTimes=[];window.__collectDelta=(t,d)=>window.__frameTimes.push(d);g.events.on('step',window.__collectDelta);});
  for(let i=0;i<4;i++){if(i)await p.waitForTimeout(500);row.frames.push(await collect());await p.screenshot({path:resolve(out,`${spec.key}-frame-${i}.png`),scale:'css'});}
  assert.ok(row.frames.at(-1)[0].draws>row.frames[0][0].draws+10);row.frameTiming=await p.evaluate(()=>{const g=window.__harness.game;g.events.off('step',window.__collectDelta);const v=window.__frameTimes.filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);return {samples:v.length,median:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],max:v.at(-1)};});
  await tapUI(p,'game','card/'+hand[1].id,spec.touch);await p.waitForFunction(id=>window.__harness.game.scene.getScene('game').selectedIds.has(id),hand[1].id);assert.ok((await collect())[1].selected);await p.screenshot({path:resolve(out,`${spec.key}-selected-disabled.png`),scale:'css'});
  await p.evaluate(id=>window.__harness.game.scene.getScene('game').inspectCard(id),hand[1].id);await p.waitForFunction(()=>document.querySelector('.poker-detail-dialog[open] img'));await p.screenshot({path:resolve(out,`${spec.key}-detail.png`),scale:'css'});await p.keyboard.press('Escape');
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(200);const still=await collect();await p.waitForTimeout(500);const still2=await collect();assert.ok(still2.filter(x=>x.edge).every((x,i)=>x.motion==='static'&&x.draws===still.filter(y=>y.edge)[i].draws));await p.screenshot({path:resolve(out,`${spec.key}-reduced.png`),scale:'css'});row.still=still2;assert.deepEqual(row.errors,[]);row.status='PASS';
 }catch(e){row.status='FAIL';row.error=String(e.stack??e);await p.screenshot({path:resolve(out,`${spec.key}-failure.png`)}).catch(()=>{});throw e;}finally{await context.close();}
}report.status='PASS';}catch(e){report.status='FAIL';report.error=String(e.stack??e);process.exitCode=1;}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser.close();await server.close();}console.log(JSON.stringify(report));
