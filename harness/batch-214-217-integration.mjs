/** One tablet-to-phone cross-check. Controlled saves are disclosed; all player actions are native. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene,openSelector,confirmHeroRoute} from './ui.mjs';
import {enterCurrentStage} from './stage-entry.mjs';
const out=process.env.BATCH_OUT??'docs/production/evidence/batch-214-217-integration-2026-10-21';
await mkdir(out,{recursive:true});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const report={candidate:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'RUNNING',source:{},steps:[],errors:[],scope:'Software Chromium touch simulation. Natural selector/shop/table followed by validated controlled Su Shi and U09 saves; no physical device, hearing, full hero matrix or user aesthetic acceptance.'};
for(const file of execFileSync('git',['diff','--name-only','9abedd','--','src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean))report.source[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const server=await createServer({mode:'e2e',logLevel:'error',server:{host:'127.0.0.1',port:5811,strictPort:true}});
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {sushiSkillLocationFixture}=await server.ssrLoadModule('/harness/fixtures/sushi-skill-location.ts');
const {reviewBookReady}=await server.ssrLoadModule('/harness/fixtures/review-book.ts');
await server.listen();
let browser,context,p;
const tap=(scene,name)=>tapUI(p,scene,name,true);
const state=()=>p.evaluate(()=>structuredClone(__harness.game.registry.get('runController').state));
const tuple=()=>p.evaluate(async()=>{const c=__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,slots:await c.store.read()};});
const ready=()=>p.waitForFunction(()=>{const s=__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
const close=()=>p.locator('dialog[open] .dialog-close').tap();
async function imp(s){
 const cp=makeCheckpoint(s,[]);assert.ok(readCheckpoint(cp).ok);
 await p.evaluate(async cp=>{const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts');const s=gameSession();if(!s.lease.writable&&!await s.takeOver())throw Error('fixture lease unavailable');if(!await s.importJSON(JSON.stringify(cp)))throw Error(s.notice);routeSavedRun(__harness.game);},cp);
 await waitScene(p,'game');await ready();assert.deepEqual(await state(),s);
}
async function oracle(before,action){const after=await state(),command={runId:before.runId,commandId:after.receipts.at(-1).commandId,expectedSeq:before.commandSeq,action},result=applyCommand(before,command);assert.ok(result.ok);assert.deepEqual(after,result.state);assert.equal(after.commandSeq,before.commandSeq+1);return {seq:[before.commandSeq,after.commandSeq],stateSha:digest(after),score:after.lastTrace?.finalScore};}
try{
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});report.browser=browser.version();
 context=await browser.newContext({viewport:{width:810,height:1080},hasTouch:true,deviceScaleFactor:2});p=await context.newPage();p.setDefaultTimeout(30000);p.on('pageerror',e=>report.errors.push(String(e)));p.on('dialog',d=>d.accept());
 await p.goto('http://127.0.0.1:5811/?harness=1',{waitUntil:'domcontentloaded',timeout:60000});await waitScene(p,'title');
 await openSelector(p,true);await tap('character-select','character/amo');await confirmHeroRoute(p,true);await waitScene(p,'shop');
 const shop=await tuple(),geometry=await p.evaluate(()=>{const s=__harness.game.scene.getScene('shop'),g=s.geometry();return {viewMode:s.view.layout.mode,portrait:g.portrait,chapter:g.chapter,items:g.items};});assert.equal(geometry.viewMode,'portrait');assert.equal(geometry.portrait,false);
 await tap('shop','action/chapter');await p.getByRole('dialog',{name:'本章节目单',exact:true}).waitFor();await close();
 await tap('shop','action/items');assert.match(await p.locator('dialog[open]').getAttribute('aria-label'),/道具|物品/);await close();
 const offer=shop.state.shop.offers.find(o=>!o.consumed&&o.price<=shop.state.gold);assert.ok(offer);await tap('shop','offer/'+offer.offerId);await p.getByRole('button',{name:'取消',exact:true}).tap();assert.deepEqual(await tuple(),shop);
 await tap('shop','action/start-stage');await enterCurrentStage(p,true);await ready();
 const natural=await tuple();await tap('game','card/'+natural.state.handOrder[0]);const selected=await p.evaluate(()=>[...__harness.game.scene.getScene('game').selectedIds]);
 await p.setViewportSize({width:1080,height:810});await p.waitForTimeout(250);assert.deepEqual(await tuple(),natural);assert.deepEqual(await p.evaluate(()=>[...__harness.game.scene.getScene('game').selectedIds]),selected);
 await p.setViewportSize({width:810,height:1080});await p.waitForTimeout(250);assert.deepEqual(await tuple(),natural);
 report.steps.push({kind:'natural-tablet-entry',geometry,shopSeq:shop.state.commandSeq,tableSeq:natural.state.commandSeq,shopCancelTupleSha:digest(shop),rotationTupleSha:digest(natural),status:'PASS'});
 console.log('PASS natural tablet');
 const sushi=await sushiSkillLocationFixture();await imp(sushi.state);for(const id of sushi.selectedIds)await tap('game','card/'+id);
 const draftBefore=await tuple();await tap('game','hero/action-shortcut');const compact=await p.locator('dialog.hero-skill-compact[open]').evaluate(d=>{const b=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return{dialog:b(d),close:b(d.querySelector('.dialog-close')),primary:b(d.querySelector('.dialog-primary'))};});assert.ok(compact.close.right<=compact.primary.x+1);assert.ok(compact.dialog.height<810);
 await close();assert.deepEqual(await tuple(),draftBefore);await tap('game','hero/action-shortcut');await p.getByRole('button',{name:'本手使用贬谪 ×3',exact:true}).tap();assert.deepEqual(await tuple(),draftBefore);
 const blue=()=>p.evaluate(()=>[...__harness.game.scene.getScene('game').targetAttachment.sushi.rows.values()].map(r=>({id:r.card.id,blue:r.ink.commandBuffer.includes(0x278fc4)})));
 assert.deepEqual((await blue()).filter(x=>x.blue).map(x=>x.id).sort(),['hearts-13','spades-13']);
 await p.screenshot({path:out+'/tablet-blue-compact.png'});
 await p.evaluate(()=>{const g=__harness.game,s=g.scene.getScene('game'),frames=window.batchFrames=[];const tick=()=>{const all=[],walk=l=>{for(const o of l){if(o.active)all.push(o);if(o.list)walk(o.list);}};walk(s.children.list);if(s.presentation)frames.push({blue:all.filter(o=>o.getData?.('energy')==='blue-converge').length,charge:all.filter(o=>o.name==='hero/sushi-king-charge').map(o=>o.getData('phase')),shards:all.filter(o=>o.name==='hero/sushi-cost-king-shard'&&o.alpha>.1).length,packet:all.find(o=>o.name==='hero/sushi-skill-packet')?.text,arrived:s.heroActionButton?.getData('sushiSkillPayoff')?.arrived});};g.events.on('postrender',tick);window.stopBatchFrames=()=>g.events.off('postrender',tick);});
 const beforePlay=await state();await tap('game','action/play');await ready();const sushiResult=await oracle(beforePlay,{type:'PlayHand',selectedIds:sushi.selectedIds,amoExile:true});assert.equal(sushiResult.score,'306');
 const frames=await p.evaluate(()=>{stopBatchFrames();return batchFrames;});report.sushiFrames=frames;assert.ok(frames.some(f=>f.charge.length),'saved true-K charge is visible');assert.ok(frames.filter(f=>f.shards>0).every(f=>f.charge.length===0),'charge is cleared before genuine fracture');assert.ok(frames.some(f=>f.shards>0));assert.ok(frames.some(f=>f.packet==='×3'));assert.ok(frames.some(f=>f.arrived));assert.equal((await blue()).length,0);
 report.steps.push({kind:'controlled-tablet-sushi',compact,firstBlue:['hearts-13','spades-13'],result:sushiResult,releaseIntermediateFrameObserved:frames.some(f=>f.charge.includes('release')),cleanup:true,status:'PASS'});console.log('PASS tablet Su Shi');
 await p.setViewportSize({width:390,height:740});await p.waitForTimeout(250);
 // Target-suit grouping was withdrawn by the user; historical evidence remains, no current test invokes it.
 const f=reviewBookReady();await imp(f.state);if(await p.getByRole('button',{name:'开始出牌',exact:true}).isVisible())await p.getByRole('button',{name:'开始出牌',exact:true}).tap();for(const id of f.action.selectedIds)await tap('game','card/'+id);
 const beforeBoss=await state();await tap('game','action/play');const reminder=p.getByRole('button',{name:'继续出牌',exact:true});if(await reminder.isVisible())await reminder.tap();await waitScene(p,'intermission');const boss=await oracle(beforeBoss,f.action);
 const receipt=()=>p.evaluate(()=>{const s=__harness.game.scene.getScene('intermission'),all=[],walk=l=>{for(const o of l){all.push(o);if(o.list)walk(o.list);}};walk(s.view.root.list);const t=all.find(o=>o.name==='result/review-book');return{text:t?.text,eventId:t?.getData('sourceEventId'),motion:all.some(o=>o.name==='result/review-book-motion'),count:all.filter(o=>o.name==='result/review-book').length};});
 const entry=await receipt(),event=(await state()).lastTrace.events.find(e=>e.sourceDefinitionId==='U09');assert.equal(entry.text,'复盘本：两对 Lv2→Lv3');assert.equal(entry.eventId,event.eventId);assert.equal(entry.count,1);assert.equal(event.targetHandType,'two-pair');assert.equal((await state()).lastTrace.handType,'straight');
 await p.waitForTimeout(1100);const paid=await tuple();assert.equal((await receipt()).motion,false);await p.screenshot({path:out+'/phone-review-book.png'});await p.reload({waitUntil:'domcontentloaded'});await waitScene(p,'title');await tap('title','action/title-continue');await waitScene(p,'intermission');assert.equal((await receipt()).motion,false);assert.deepEqual((await tuple()).state,paid.state);
 const seq=paid.state.commandSeq;await tap('intermission','action/continue-stage');await waitScene(p,'shop');assert.equal((await state()).commandSeq,seq+1);assert.equal((await state()).handLevels['two-pair'],3);report.steps.push({kind:'controlled-phone-U09',entry,event:{eventId:event.eventId,handType:event.targetHandType,before:event.resourceBefore,after:event.resourceAfter},result:boss,restoredStatic:true,continueCommands:1,status:'PASS'});console.log('PASS phone U09');
 assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;await p?.screenshot({path:out+'/FAIL.png'}).catch(()=>{});console.error(e);}
finally{await context?.close();await browser?.close();await server.close();report.cleanup='context/browser/Vite closed';await writeFile(out+'/cross-check.json',JSON.stringify(report,null,2));console.log(report.status);}
