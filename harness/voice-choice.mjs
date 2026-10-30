/** Exercise the real shop, purchase cancellation and two-card use on desktop and touch mobile. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5228,strictPort:true}});
const output='shots/voice-choice',report={testedCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Working tree; actual desktop and mobile touch shop flow. Physical devices not tested.',checks:[]};
let browser,activePage,makeCheckpoint,readCheckpoint;
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
  await mkdir(output,{recursive:true});({nextControllerTarget}=await server.ssrLoadModule('/src/game/ControllerFocus.ts'));({makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts'));await server.listen();browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
    const mobile=viewport.width<500,context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile}),page=await context.newPage(),errors=[],click=locator=>mobile?locator.tap():locator.click();activePage=page;page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>{
      window.__testPad={index:0,id:'Xbox test controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__testPad]});
    });
    await page.goto('http://127.0.0.1:5228/?harness=1&seed=gamepad-ui');await page.bringToFront();
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
    const initial=await read(page);await navigate(page,target=>target.id==='action/shelf-workshop');await press(page,'confirm');
    const row=page.locator('.workshop-other-row[data-make-id="T13"]');await row.waitFor();
    assert.match(await row.innerText(),/留个声/);await click(row.locator('button.workshop-operation-main'));
    let dialog=page.locator('dialog[open]').last();await click(dialog.getByRole('button',{name:/返回自选做牌/}));assert.deepEqual(await read(page),initial);
    await click(row.locator('button.workshop-operation-main'));dialog=page.locator('dialog[open]').last();await click(dialog.getByRole('button',{name:/购买 · 4 金/}));
    await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,initial.commandSeq);
    const purchased=await read(page);assert.equal(purchased.gold,initial.gold-4);assert.equal(purchased.shop.basicChoice.purchase.definitionId,'T13');
    dialog=page.locator('dialog[open]').last();await dialog.waitFor();const boxes=dialog.locator('input[type=checkbox]');await click(boxes.nth(0));await click(boxes.nth(1));assert.equal(await boxes.nth(0).isChecked(),true);assert.equal(await boxes.nth(1).isChecked(),true);assert.equal(await boxes.nth(2).isDisabled(),true);assert.deepEqual(await read(page),purchased);await page.screenshot({path:`${output}/voice-${viewport.width}.png`});
    await click(dialog.getByRole('button',{name:'确认使用'}));await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,purchased.commandSeq);const used=await read(page);assert.equal(used.deckInstances.filter(c=>c.enhancement==='voice-paper').length,2);assert.equal(used.consumables.length,0);
    // Controlled checkpoint isolates the replacement UI; original acquisition above is natural.
    const replacement=structuredClone(used),target=replacement.deckInstances.find(c=>c.enhancement==='voice-paper');target.enhancement='heat-paper';target.edition='foil';replacement.consumables.push({instanceId:'controlled/voice',definitionId:'T13'});const checkpoint=makeCheckpoint(replacement,[]);assert.equal(readCheckpoint(checkpoint).ok,true);
    await page.locator('.tool-saved-result[open]').waitFor();await press(page,'back');await waitScene(page,'shop');const imported=await page.evaluate(async cp=>{const {gameSession}=await import('/src/game/session.ts');const session=gameSession();if(!await session.importJSON(JSON.stringify(cp)))return false;const game=window.__harness.game;game.registry.set('runController',session.run);game.registry.set('runState',session.run.state);game.scene.getScene('shop').scene.restart();return true;},checkpoint);assert.equal(imported,true);await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);assert.deepEqual(await read(page),replacement);
    const openTarget=async()=>{await tapUI(page,'shop','action/tool-inventory',mobile);await click(page.locator('.tool-inventory-card[data-item-id="controlled/voice"]'));await click(page.locator('input[value="'+target.id+'"]'));await page.getByRole('button',{name:'替换增强',exact:true}).waitFor();assert.match(await page.locator('.tool-preview-cost').innerText(),/替换原增强.*失去[\s\S]*获得/);};
    await openTarget();await click(page.getByRole('button',{name:'稍后使用',exact:true}));assert.deepEqual(await read(page),replacement);
    await openTarget();await page.screenshot({path:`${output}/voice-replacement-${viewport.width}.png`});await click(page.getByRole('button',{name:'替换增强',exact:true}));await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,replacement.commandSeq);const replaced=await read(page);assert.equal(replaced.deckInstances.find(c=>c.id===target.id).enhancement,'voice-paper');assert.equal(replaced.deckInstances.find(c=>c.id===target.id).edition,'foil');assert.equal(replaced.consumables.length,0);await page.reload();await waitScene(page,'title');await page.waitForFunction(()=>!!window.__harness?.game.registry.get('runController'));assert.deepEqual(await read(page),replaced);
    assert.deepEqual(errors,[]);report.checks.push({viewport,status:'PASS',replacement:'controlled imported checkpoint; cancel, confirm and reload'});await context.close();
  }
}catch(error){report.error=String(error);if(activePage&&!activePage.isClosed())await activePage.screenshot({path:`${output}/voice-failure.png`}).catch(()=>{});throw error;}
finally{await writeFile(`${output}/voice-result.json`,JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
