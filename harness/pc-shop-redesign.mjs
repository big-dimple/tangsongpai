// Real pointer/touch actions against a seeded new run; no saved-state mutation for setup.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {chooseCharacter,tapUI,point,buyOffer,waitScene} from './ui.mjs';

const out='shots/pc-shop-redesign';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5595,strictPort:true},logLevel:'error'});await server.listen();
const {createRun,applyCommand,assertRunInvariants}=await server.ssrLoadModule('/src/domain/run.ts'),{newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts'),{r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts'),{makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
try{
 for(const spec of [{width:1366,height:768,touch:false},{width:1920,height:1080,touch:false},{width:1366,height:768,touch:true}]){
  const page=await browser.newPage({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',d=>d.accept());
  const state=()=>page.evaluate(()=>structuredClone(window.__harness.game.registry.get('runController').state));
  const button=()=>page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),o=s.view.root.list.find(x=>x.name==='action/start-stage'),p=s.geometry(),art=o.getData('buttonArt'),label=o.getData('label');return{pc:!!p.pc,play:p.play,shared:p.pc?.shared,feedback:p.pc?.feedback,build:p.build,enabled:o.input.enabled,tone:o.getData('shopEntryTone'),label:label.text,color:label.style.color,scale:art.scaleX,arrow:s.view.root.list.some(x=>x.name==='shop/owned-toggle-arrow')};});
  const shot=label=>page.screenshot({path:`${out}/${spec.width}-${spec.touch?'touch':'mouse'}-${label}.png`});
  await page.goto('http://127.0.0.1:5595/?harness=1&seed=r03-651');await chooseCharacter(page,'erxiang',spec.touch);
  await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);let initial=await button(),before=await state();
  assert.ok(initial.pc&&!initial.arrow);assert.equal(initial.play.x+initial.play.width/2,initial.shared.x+initial.shared.width/2);assert.equal(initial.color,'#fff7e4');assert.equal(initial.tone,0x354f4b);assert.ok(initial.feedback.x>=initial.play.x+initial.play.width);await shot('initial');
  const pos=await point(page,'shop','action/start-stage');
  if(spec.touch){
   const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y}]});await page.waitForTimeout(120);assert.equal((await button()).tone,0x843029);await shot('pressed');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(120);assert.equal((await button()).tone,0x354f4b);await cdp.detach();
  }else{
   await page.mouse.move(pos.x,pos.y);await page.waitForTimeout(80);assert.equal((await button()).tone,0x9f3228);await shot('hover');await page.mouse.down();await page.waitForTimeout(120);assert.equal((await button()).tone,0x843029);await shot('pressed');await page.mouse.move(pos.x,pos.y-80);await page.mouse.up();await page.waitForTimeout(120);assert.equal((await button()).tone,0x354f4b);
  }
  assert.deepEqual(await state(),before,'cancelled press must not leave shop');
  await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop');s.busy=true;s.render();});const disabled=await button();assert.equal(disabled.enabled,false);assert.equal(disabled.tone,0xd8d1c3);assert.equal(disabled.color,'#595b59');await shot('disabled');
  if(spec.touch)await page.touchscreen.tap(pos.x,pos.y);else await page.mouse.click(pos.x,pos.y);assert.deepEqual(await state(),before,'disabled entry cannot dispatch');
  await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop');s.busy=false;s.render();});
  const offer=before.shop.offers.find(o=>o.definitionId==='mantangcai');assert.ok(offer);await buyOffer(page,offer.offerId,spec.touch);await page.waitForFunction(()=>window.__harness.game.registry.get('runController').state.jokers.length===1);for(let n=0;n<3&&await page.locator('dialog[open] .dialog-close').count();n++)await page.locator('dialog[open] .dialog-close').last().click();const bought=await state();assert.equal(bought.gold,before.gold-4);await shot('purchased');
  for(const name of ['shop/hero-preparation','action/tool-inventory']){await tapUI(page,'shop',name,spec.touch);await page.locator('dialog[open]').last().waitFor();await page.locator('dialog[open] .dialog-close').last().click();assert.deepEqual(await state(),bought);}
  await tapUI(page,'shop','action/start-stage',spec.touch);await waitScene(page,'game');await page.getByRole('button',{name:'进入暖场 ›',exact:true}).waitFor();assert.equal((await state()).phase,'stage-ready');assert.deepEqual(errors,[]);
  rows.push({...spec,purchase:true,hero:true,inventory:true,entry:true});await page.close();console.log('PASS',spec);
 }
 let run=createRun({seed:'owned-drag-fixed',runId:'owned-drag-fixed',characterId:'erxiang',rulesVersion:'r2',r2Identity:newRunIdentity('erxiang','group'),openingRoute:'group'});
 for(const action of [{type:'LeaveShop'},{type:'SkipStage'},{type:'OpenShop'}]){const r=applyCommand(run,{runId:run.runId,commandId:run.runId+'/command/'+(run.commandSeq+1),expectedSeq:run.commandSeq,action});assert.ok(r.ok);run=r.state;}
 run.jokers=['b03','b10','e01','e04','f12'].map((id,i)=>r2CreateJoker(id,'owned-drag/'+i,4));assertRunInvariants(run);const cp=makeCheckpoint(run,[]);assert.ok(readCheckpoint(cp).ok);
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:5595/?harness=1');await waitScene(page,'title');
 await page.evaluate(async cp=>{const {gameSession}=await import('/src/game/session.ts');const s=gameSession();while(s.working)await new Promise(r=>setTimeout(r,30));await s.lease.claim(true);if(!await s.importJSON(JSON.stringify(cp)))throw Error(s.notice);const g=window.__harness.game;g.registry.set('runController',s.run);g.registry.set('runState',s.run.state);for(const scene of g.scene.getScenes(true))g.scene.stop(scene.scene.key);g.scene.start('shop');},cp);
 await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
 const slot=i=>page.evaluate(i=>{const s=window.__harness.game.scene.getScene('shop'),b=s.geometry().slots[i],r=s.game.canvas.getBoundingClientRect(),q=s.cameras.main.matrix.transformPoint(b.x+b.width/2,b.y+b.height/2);return{x:r.left+q.x*r.width/s.scale.width,y:r.top+q.y*r.height/s.scale.height};},i);
 const from=await slot(0),to=await slot(3);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
 await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq,run.commandSeq+1);
 const ids=run.jokers.map(j=>j.instanceId);ids.splice(3,0,ids.splice(0,1)[0]);const expected=applyCommand(run,{runId:run.runId,commandId:run.runId+'/command/'+(run.commandSeq+1),expectedSeq:run.commandSeq,action:{type:'ReorderJokers',ids}});assert.ok(expected.ok);
 assert.deepEqual(await page.evaluate(()=>window.__harness.game.registry.get('runController').state),expected.state);rows.push({width:1366,height:768,reorder:'real mouse drag, full state matches command'});await page.close();console.log('PASS real PC reorder');
}finally{await writeFile(out+'/report.json',JSON.stringify(rows,null,2));await browser.close();await server.close();}
