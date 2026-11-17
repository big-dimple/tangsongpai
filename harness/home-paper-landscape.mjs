import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {chooseCharacter,confirmHeroRoute,enterOpeningShop,tapUI,waitScene} from './ui.mjs';

const server=process.env.HOME_URL?undefined:await createServer({mode:'e2e',server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});
if(server)await server.listen();
const url=process.env.HOME_URL??('http://127.0.0.1:'+server.httpServer.address().port);
const browser=await chromium.launch({executablePath:process.env.HOME_BROWSER??process.env.CHROMIUM_PATH});
const saved=page=>page.evaluate(async()=>{
  const run=window.__harness.game.registry.get('runController');
  return run?{state:run.state,journal:run.journal,storage:await run.store.read()}:null;
});

async function checkHome(page) {
  const home=page.locator('.title-home');
  assert.equal(await home.getByRole('heading',{name:'唐宋牌',exact:true}).count(),1);
  await home.locator('.load-world img').evaluate(img=>img.decode());
  const layout=await home.evaluate(el=>{
    const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,height:b.height};};
    return {overflow:el.scrollWidth-el.clientWidth,heading:rect(el.querySelector('h1')),width:innerWidth,
      art:el.querySelector('.load-world img').naturalWidth,fan:el.querySelectorAll('.load-card').length,
      stamp:rect(el.querySelector('.load-seal')),menu:rect(document.querySelector('.run-menu-toggle')),
      actions:[...el.querySelectorAll('button:not([hidden])')].map(rect)};
  });
  assert.equal(layout.art,1440);assert.equal(layout.fan,3);assert.ok(layout.overflow<=1);
  assert.ok(layout.stamp.right<=layout.menu.x-4||layout.stamp.y>=layout.menu.bottom+4);
  for(const box of [layout.heading,...layout.actions])assert.ok(box.x>=-1&&box.right<=layout.width+1,JSON.stringify(layout));
  for(const box of layout.actions)assert.ok(box.height>=44);
}

try {
  for(const [width,height] of [[320,568],[390,844],[1366,768]]){
    const touch=width<640,context=await browser.newContext({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'/?harness=1&seed=home-replay');await waitScene(page,'title');await checkHome(page);
    assert.equal(await saved(page),null);
    await chooseCharacter(page,'amo',touch);
    const baseline=await saved(page);assert.ok(baseline);
    await page.reload();await waitScene(page,'title');await checkHome(page);
    assert.deepEqual(await saved(page),baseline);
    await page.evaluate(()=>window.__harness.game.scene.getScene('title').home.update({summary:['文成公主','普通模式','第 9,007,199,254,740,991 章','金币 9,007,199,254,740,991'],canContinue:true,canStart:true,canTutorial:true,notice:true}));
    for(const zoom of [1.25,2]){
      await page.evaluate(z=>{document.documentElement.style.zoom=String(z);},zoom);
      await checkHome(page);
      for(const button of await page.locator('.home-actions button:visible').all())await button.scrollIntoViewIfNeeded();
    }
    await page.evaluate(()=>{document.documentElement.style.zoom='1';window.__harness.game.scene.getScene('title').render();});
    const resume=page.getByRole('button',{name:'继续本局',exact:true});await resume.focus();
    if(touch)await resume.tap();else await page.keyboard.press('Enter');
    await waitScene(page,'shop');assert.deepEqual(await saved(page),baseline);
    await page.reload();await waitScene(page,'title');await tapUI(page,'title','action/title-start',touch);
    await waitScene(page,'character-select');await tapUI(page,'character-select','character/azao',touch);
    await tapUI(page,'character-select','action/confirm-character',touch);
    await tapUI(page,'character-select','route/group',touch);
    assert.deepEqual(await saved(page),baseline);
    await tapUI(page,'character-select','action/cancel-character',touch);
    assert.deepEqual(await saved(page),baseline,'returning from a proposed route preserves the whole save');
    await confirmHeroRoute(page,touch);await enterOpeningShop(page,touch);
    const next=await saved(page);assert.equal(next.state.characterId,'azao');assert.notEqual(next.state.runId,baseline.state.runId);
    const oldSlot=await page.evaluate(async state=>{
      const {gameSession}=await import('/src/game/session.ts');
      return gameSession().storage.readPartition(state);
    },baseline.state);
    const previous=oldSlot.current.state.runId===baseline.state.runId?oldSlot.current:oldSlot.previous;
    assert.deepEqual(previous.state,baseline.state,'the previous campaign remains in its saved ruleset partition');
    await page.reload();await waitScene(page,'title');assert.deepEqual(await saved(page),next);assert.deepEqual(errors,[]);
    await context.close();console.log('PASS title, zoom, continue and replace',width,height);
  }
}finally {await browser.close();await server?.close();}
