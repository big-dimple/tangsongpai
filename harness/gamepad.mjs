/** Inject hardware snapshots only; every game operation still goes through the product controller UI. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {enterCurrentStage} from './stage-entry.mjs';

const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5218,strictPort:true}});
const output='shots/gamepad',report={testedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks:[],physicalController:'NOT_RUN'};
let browser,activePage;
const buttons={left:14,right:15,up:12,down:13,confirm:0,back:1,play:2,discard:3,previous:4,next:5,rank:6,suit:7,detail:8,menu:9};
const frames=page=>page.evaluate(()=>new Promise((resolve,reject)=>{let count=0;const game=window.__harness.game,timer=setTimeout(()=>{game.events.off('poststep',step);reject(Error('controller frame timeout'));},5000),step=()=>{if(++count===3){clearTimeout(timer);game.events.off('poststep',step);resolve();}};game.events.on('poststep',step);}));
const read=page=>page.evaluate(()=>window.__harness.game.registry.get('runController')?.state);
const snapshot=page=>page.evaluate(()=>window.__harness.game.registry.get('controllerNavigation'));
let nextControllerTarget;
async function press(page,action,hold=0){
  await page.evaluate(index=>{window.__testPad.buttons[index]={pressed:true,value:1};},buttons[action]);await frames(page);
  if(hold)await page.waitForTimeout(hold);
  await page.evaluate(index=>{window.__testPad.buttons[index]={pressed:false,value:0};},buttons[action]);await frames(page);
}
async function navigate(page,predicate){
  for(let attempt=0;attempt<45;attempt++){
    await page.waitForTimeout(90);const state=await snapshot(page),goal=state.targets.find(predicate);assert.ok(goal,'requested controller target exists');
    if(state.focusId===goal.id)return;
    if(state.modal){await press(page,'next');continue;}
    const queue=[{id:state.focusId,path:[]}],seen=new Set([state.focusId]);let route;
    while(queue.length){const item=queue.shift();if(item.id===goal.id){route=item.path;break;}
      for(const direction of ['up','down','left','right']){const next=nextControllerTarget(state.targets,item.id,direction)?.id;if(next&&!seen.has(next)){seen.add(next);queue.push({id:next,path:[...item.path,direction]});}}
    }
    assert.ok(route?.length,'spatial focus can reach '+goal.id);await press(page,route[0]);
  }
  assert.fail('controller navigation did not reach its target');
}
try{
  await mkdir(output,{recursive:true});({nextControllerTarget}=await server.ssrLoadModule('/src/game/ControllerFocus.ts'));await server.listen();browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
    const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];activePage=page;page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      window.__testPad={index:0,id:'Xbox test controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__testPad]});
    });
    await page.goto('http://127.0.0.1:5218/?harness=1&seed=gamepad-ui');await page.bringToFront();
    await page.waitForFunction(()=>window.__harness?.game.scene.isActive('title'));await frames(page);
    await press(page,'left');await navigate(page,target=>target.id==='title/action/title-start');await press(page,'confirm',600);
    await page.waitForFunction(()=>window.__harness.game.scene.isActive('character-select'));
    assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('character-select').selectedId),undefined,'held title confirmation cannot also choose a hero');
    await navigate(page,target=>target.id==='character/amo');await press(page,'confirm');
    await navigate(page,target=>target.id==='action/confirm-character');await press(page,'confirm');
    await navigate(page,target=>target.id==='route/group');await press(page,'confirm');
    await navigate(page,target=>target.id==='action/confirm-character');await press(page,'confirm');
    await page.locator('.opening-rule-briefing[open]').waitFor();await navigate(page,target=>target.primary);await press(page,'confirm');
    await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));
    const shop=await read(page);await navigate(page,target=>target.id.includes('offer/'));await press(page,'confirm');
    await page.waitForFunction(()=>!!document.querySelector('dialog[open]'));await press(page,'play',500);assert.deepEqual(await read(page),shop,'a shop detail blocks table shortcuts');await press(page,'back');
    await navigate(page,target=>target.id==='action/start-stage');await press(page,'confirm');
    // Ordinary entry controls also exercise switching between pointer and controller ownership.
    await enterCurrentStage(page,false);
    await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&!s.playing&&s.cardViews.length>0&&!document.querySelector('dialog[open]');});
    await frames(page);await press(page,'right');const before=await read(page);await press(page,'confirm',600);
    assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('game').selectedIds.size),1,'holding A selects only once');assert.deepEqual(await read(page),before,'selection leaves domain state and RNG unchanged');
    await press(page,'back');assert.equal(await page.evaluate(()=>window.__harness.game.scene.getScene('game').selectedIds.size),0);
    await press(page,'confirm');await press(page,'play',600);
    if(await page.locator('.hero-play-reminder[open]').count()){
      assert.deepEqual(await read(page),before,'holding X cannot bypass the hero ability reminder');
      await navigate(page,target=>target.id.endsWith('/继续出牌'));await press(page,'confirm');
    }
    await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,before.commandSeq);
    assert.equal((await read(page)).stage.handsLeft,before.stage.handsLeft-1,'holding X commits one hand');
    await press(page,'confirm');await page.waitForFunction(()=>!window.__harness.game.scene.getScene('game').playing);
    await press(page,'right');await page.waitForTimeout(90);const order=await read(page),focusedCard=(await snapshot(page)).focusId;assert.ok(focusedCard?.startsWith('card/'),'table focus returns to the hand after score animation');const card=focusedCard.slice(5),index=order.handOrder.indexOf(card),move=index<order.handOrder.length-1?'next':'previous';
    await press(page,move,500);await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,order.commandSeq);
    assert.equal((await read(page)).handOrder.indexOf(card),index+(move==='next'?1:-1),'shoulder moves the focused card exactly one seat');
    const sorted=await read(page);await press(page,'rank',500);await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,sorted.commandSeq);
    await press(page,'confirm');const discard=await read(page);await press(page,'discard',500);await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,discard.commandSeq);
    assert.equal((await read(page)).stage.discardsLeft,discard.stage.discardsLeft-1,'holding Y discards only once');
    await page.waitForFunction(()=>!window.__harness.game.scene.getScene('game').playing);await press(page,'right');await page.waitForTimeout(90);const focused=(await snapshot(page)).focusId;
    await press(page,'detail');await page.waitForFunction(()=>!!document.querySelector('.poker-detail-dialog[open]'));
    const detail=await read(page);await press(page,'discard',500);assert.deepEqual(await read(page),detail,'a poker dialog blocks discard');await press(page,'back');
    await page.waitForFunction(id=>{const state=window.__harness.game.registry.get('controllerNavigation');return !state.modal&&state.focusId===id;},focused);
    await press(page,'menu',500);assert.equal(await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open),true);await press(page,'back');
    assert.equal(await page.locator('.run-menu-modal').evaluate(dialog=>dialog.open),false);
    const seq=(await read(page)).commandSeq;await page.evaluate(()=>{window.__testPad.connected=false;window.__testPad.buttons[2]={pressed:true,value:1};});await frames(page);
    await page.evaluate(()=>window.__testPad.connected=true);await frames(page);assert.equal((await read(page)).commandSeq,seq,'reconnect with X held cannot submit');
    await page.evaluate(()=>window.__testPad.buttons[2]={pressed:false,value:0});await frames(page);
    await page.screenshot({path:`${output}/${viewport.width}.png`});assert.deepEqual(errors,[]);report.checks.push({viewport,status:'PASS'});await context.close();
  }
  // Exercise real text/padding clicks through the same native dialog used by game choices.
  const page=await browser.newPage();activePage=page;await page.goto('http://127.0.0.1:5218/?harness=1');await page.waitForFunction(()=>window.__harness?.game.scene.isActive('title'));
  await page.evaluate(async()=>{const {DetailDialog}=await import('/src/game/DetailDialog.ts');window.__tileClicks=0;new DetailDialog().open('点击范围检查','',[],{choices:[{label:'打开选择',detail:'说明文字也可以点击',run:()=>{window.__tileClicks++;}}]});});
  await page.getByText('说明文字也可以点击',{exact:true}).click();assert.equal(await page.evaluate(()=>window.__tileClicks),1);
  const tile=page.locator('.dialog-choice-actions > div');await tile.click({position:{x:3,y:3}});assert.equal(await page.evaluate(()=>window.__tileClicks),2);
  await tile.locator('button').click();assert.equal(await page.evaluate(()=>window.__tileClicks),3,'button bubbling cannot double activate');
  report.checks.push({name:'whole-choice-surface',status:'PASS'});
}catch(error){
  report.error=String(error);
  if(activePage&&!activePage.isClosed()){
    report.failure=await activePage.evaluate(()=>({navigation:window.__harness?.game.registry.get('controllerNavigation'),state:window.__harness?.game.registry.get('runController')?.state,dialogs:[...document.querySelectorAll('dialog[open]')].map(dialog=>({title:dialog.getAttribute('aria-label'),className:dialog.className,buttons:[...dialog.querySelectorAll('button')].map(button=>({label:button.textContent,disabled:button.disabled}))}))})).catch(()=>({unavailable:true}));
    await activePage.screenshot({path:`${output}/failure.png`}).catch(()=>{});
  }
  throw error;
}
finally{await writeFile(`${output}/result.json`,JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
