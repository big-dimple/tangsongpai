/** Bounded mobile reading check; disclosed valid owned-card fixture, native pointer entry. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';
const out='shots/scope-copy-audit';await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5731,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium'}),report=[];
try{
 const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts'),{newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts'),{r2CreateJoker}=await server.ssrLoadModule('/src/domain/r2Run.ts'),{makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
 let state=createRun({seed:'scope-copy',runId:'scope-copy',characterId:'amo',rulesVersion:'r2',r2Identity:newRunIdentity('amo','group'),openingRoute:'group'});
 for(const type of ['LeaveShop','SkipStage','OpenShop']){const r=applyCommand(state,{runId:state.runId,commandId:'fixture/'+type,expectedSeq:state.commandSeq,action:{type}});assert.ok(r.ok,r.code);state=r.state;}
 state.jokers=[r2CreateJoker('mantangcai','scope-owned',0,'polychrome',state),r2CreateJoker('c06','scope-growth',0,undefined,state)];
 const checkpoint=makeCheckpoint(state,[]);assert.ok(readCheckpoint(checkpoint).ok);
 for(const width of [390,320]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:568},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();page.on('dialog',d=>d.accept());
  await page.route('**/__scope-bootstrap',r=>r.fulfill({contentType:'text/html',body:'<html>Controlled valid fixture</html>'}));await page.goto('http://127.0.0.1:5731/__scope-bootstrap');
  await page.evaluate(async cp=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,cp,null);},checkpoint);
  await page.goto('http://127.0.0.1:5731/?harness=1');await waitScene(page,'title');await tapUI(page,'title','action/title-continue',true);await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  const before=await page.evaluate(()=>JSON.stringify(window.__harness.game.registry.get('runController').state));
  for(const target of ['scope-owned','scope-growth']){
  await tapUI(page,'shop','joker/'+target,true);const dialog=page.locator('dialog[open]');await dialog.waitFor();
  const text=await dialog.innerText();if(target==='scope-owned'){assert.match(text,/本次出牌的倍率乘以1.5/);assert.match(text,/每次出牌，热度\+90/);}else assert.match(text,/下次出牌生效/);assert.doesNotMatch(text,/每手一次|下一手生效/);
  const geometry=await dialog.evaluate(d=>{const r=d.getBoundingClientRect(),s=d.querySelector('.dialog-scroll');return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth};});
  assert.ok(geometry.x>=0&&geometry.right<=width+1);assert.ok(geometry.scrollWidth<=geometry.clientWidth+1);
  if(target==='scope-growth'){await dialog.locator('.ability-limits').scrollIntoViewIfNeeded();await page.waitForTimeout(250);}
  await page.screenshot({path:out+'/'+width+(target==='scope-owned'?'-owned.png':'-growth.png')});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(window.__harness.game.registry.get('runController').state)),before);
  report.push({width,target,text,geometry,unchanged:true});}
  await context.close();
 }
 await writeFile(out+'/report.json',JSON.stringify({status:'PASS',scope:'Controlled shop fixture; actual owned-card touch and details, 390x844/320x568, software Chromium. No physical-device claim.',cases:report},null,2));console.log('PASS mobile owned details 390/320');
}finally{await browser.close();await server.close();}
