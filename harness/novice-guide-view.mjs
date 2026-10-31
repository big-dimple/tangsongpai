import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const html=`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<script type="module">
import '/src/style.css';
import {layout} from '/src/game/layout.ts';
import {mountNoviceGuideView} from '/src/game/NoviceGuideView.ts';
const safe={top:12,right:8,bottom:24,left:8};
for(const [side,value] of Object.entries(safe))document.documentElement.style.setProperty('--safe-'+side,value+'px');
const counts={card:0,play:0,discard:0,close:0,reopen:0,skip:0,action:0,gameKeys:0};let table,guide,extra=[];
const targets={};
for(const name of ['card','play','discard']){
  const button=document.createElement('button');button.dataset.sceneTarget=name;button.textContent=name;
  Object.assign(button.style,{position:'fixed',zIndex:'1',minWidth:'0',minHeight:'0',padding:'0'});
  button.onclick=()=>counts[name]++;document.body.append(button);targets[name]=button;
}
function resize(){
  table=layout({width:innerWidth,height:innerHeight},safe,undefined,{count:8},{pc:innerWidth>=700});
  for(const [name,b] of Object.entries({card:table.cards[1].hit,play:table.tableActions.play,discard:table.tableActions.discard}))
    Object.assign(targets[name].style,{left:b.x+'px',top:b.y+'px',width:b.width+'px',height:b.height+'px'});
  guide?.refresh();
}
const geometry=()=>({highlights:[table.cards[1].visual,table.cards[2].visual],avoid:[table.hud,table.scoreBoard,table.hand,table.actions,...extra]});
resize();
guide=mountNoviceGuideView({step:{id:'select-pair',title:'先找一对',body:'点两张 5；花色可以不同。'},getGeometry:geometry,onClose:()=>counts.close++,onReopen:()=>counts.reopen++,onSkip:()=>counts.skip++,reducedMotion:true});
window.addEventListener('resize',resize);
window.addEventListener('keydown',event=>{if(event.key==='ArrowRight')counts.gameKeys++;});
window.fixture={counts,read:()=>({table,geometry:geometry()}),update:()=>guide.update({id:'play',title:'打出这一对',body:'点击出牌，看看真实得分。'}),updateAction:()=>guide.update({id:'confirm',title:'继续',body:'查看下一步。',action:{label:'知道了',run:()=>counts.action++}}),updateDiscard:()=>guide.update({id:'discard',title:'45 筹码 × 2 倍率 = 90 分',body:'选不要的牌，点「弃牌」换新牌。'}),updateComplete:()=>guide.update({id:'complete',title:'练习完成',body:'你已学会出牌、换牌和技能。',details:'刘娥：选择同点牌时，可以主动选择技能。'+String.fromCharCode(10)+'路线：选择路线来培养牌型，路线可调整，不限制出牌。',action:{label:'开始普通游戏',run:()=>counts.action++}}),refresh:()=>guide.refresh(),unmount:()=>guide.unmount(),constrain:()=>{extra=[{x:0,y:0,width:innerWidth,height:260},{x:0,y:330,width:innerWidth,height:innerHeight-330}];guide.refresh();}};
</script></body></html>`;
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true},logLevel:'error',server:{host:'127.0.0.1',port:0},plugins:[{name:'novice-guide-fixture',configureServer(vite){vite.middlewares.use('/__novice-guide-view',(_request,response)=>{response.statusCode=200;response.setHeader('content-type','text/html');response.end(html);});}}]});
await server.listen();
let browser;
try {
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
  const url=server.resolvedUrls.local[0]+'__novice-guide-view';
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:720}]){
    const context=await browser.newContext({viewport,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage();
    await page.goto(url);await page.locator('[data-novice-guide-step="select-pair"]').waitFor();
    assert.equal(await page.locator('.novice-guide-title').innerText(),'先找一对');
    assert.equal(await page.locator('.novice-guide-body').innerText(),'点两张 5；花色可以不同。');
    assert.equal(await page.locator('[data-novice-guide-highlight]').count(),2);
    assert.equal(await page.locator('[data-novice-guide-panel]').getAttribute('aria-label'),'新手引导');
    assert.match(await page.locator('[data-novice-guide-skip]').getAttribute('aria-label'),/跳过教学.*普通游戏/);
    const check=async()=>{
      const current=page.viewportSize();
      const result=await page.evaluate(()=>{
        const panel=document.querySelector('[data-novice-guide-panel]'),rect=panel.getBoundingClientRect(),{geometry}=window.fixture.read();
        return {panel:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},geometry,rootPointer:getComputedStyle(document.querySelector('[data-novice-guide]')).pointerEvents,ringPointer:getComputedStyle(document.querySelector('[data-novice-guide-highlight]')).pointerEvents};
      });
      assert.equal(result.rootPointer,'none');assert.equal(result.ringPointer,'none');
      const p=result.panel;
      assert.ok(p.x>=16-.5&&p.y>=20-.5&&p.x+p.width<=current.width-16+.5&&p.y+p.height<=current.height-32+.5,JSON.stringify({viewport:current,p}));
      for(const b of [...result.geometry.avoid,...result.geometry.highlights])assert.ok(!(p.x<b.x+b.width-.01&&p.x+p.width>b.x+.01&&p.y<b.y+b.height-.01&&p.y+p.height>b.y+.01),JSON.stringify({viewport,p,b}));
    };
    await check();
    if(process.env.NOVICE_GUIDE_SHOTS)await page.screenshot({path:process.env.NOVICE_GUIDE_SHOTS+'/'+viewport.width+'x'+viewport.height+'.png'});
    for(const name of ['card','play','discard']){
      const target=page.locator('[data-scene-target="'+name+'"]');
      const box=await target.boundingBox();assert.ok(box);
      assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.getAttribute('data-scene-target'),{x:box.x+box.width/2,y:box.y+box.height/2}),name);
      await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
      assert.equal(await page.evaluate(name=>window.fixture.counts[name],name),1);
    }
    await page.evaluate(()=>window.fixture.updateDiscard());await check();
    const panel=page.locator('[data-novice-guide-panel]');
    assert.equal(await panel.evaluate(element=>element.scrollHeight<=element.clientHeight+1),true);
    assert.equal(await page.locator('.novice-guide-body').evaluate(element=>element.textContent.includes('换新牌')),true);
    assert.equal(await panel.evaluate(element=>{const body=element.querySelector('.novice-guide-body').getBoundingClientRect(),outer=element.getBoundingClientRect();return body.bottom<=outer.bottom+.5;}),true);
    await page.locator('[data-novice-guide-skip]').focus();await page.evaluate(()=>window.fixture.updateComplete());await check();
    const detailsToggle=page.locator('[data-novice-guide-details-toggle]'),details=page.locator('[data-novice-guide-details]');
    assert.equal(await page.locator('[data-novice-guide-skip]').isVisible(),false);
    assert.equal(await page.locator('[data-novice-guide-action]').innerText(),'开始普通游戏');
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-novice-guide-action')),true);
    assert.equal(await detailsToggle.getAttribute('aria-expanded'),'false');assert.equal(await details.isVisible(),false);
    assert.equal(await detailsToggle.getAttribute('aria-controls'),await details.getAttribute('id'));
    if(process.env.NOVICE_GUIDE_SHOTS)await page.screenshot({path:process.env.NOVICE_GUIDE_SHOTS+'/'+viewport.width+'x'+viewport.height+'-complete-collapsed.png'});
    await detailsToggle.focus();await page.keyboard.press('Enter');
    assert.equal(await detailsToggle.getAttribute('aria-expanded'),'true');assert.equal(await details.isVisible(),true);await check();
    await panel.evaluate(element=>{element.scrollTop=element.scrollHeight;});
    assert.match(await details.innerText(),/刘娥.*路线/s);
    assert.equal(await panel.evaluate(element=>{const detail=element.querySelector('[data-novice-guide-details]').getBoundingClientRect(),outer=element.getBoundingClientRect();return detail.bottom<=outer.bottom+.5;}),true);
    if(process.env.NOVICE_GUIDE_SHOTS)await page.screenshot({path:process.env.NOVICE_GUIDE_SHOTS+'/'+viewport.width+'x'+viewport.height+'-complete-expanded.png'});
    await detailsToggle.focus();await page.keyboard.press('Enter');assert.equal(await detailsToggle.getAttribute('aria-expanded'),'false');assert.equal(await details.isVisible(),false);
    await detailsToggle.tap();assert.equal(await detailsToggle.getAttribute('aria-expanded'),'true');await detailsToggle.tap();assert.equal(await detailsToggle.getAttribute('aria-expanded'),'false');
    await page.evaluate(()=>window.fixture.updateAction());assert.equal(await page.locator('[data-novice-guide-skip]').isVisible(),true);await page.locator('[data-novice-guide-action]').click();assert.equal(await page.evaluate(()=>window.fixture.counts.action),1);
    await page.locator('[data-novice-guide-close]').focus();await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>window.fixture.counts.close),1);
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-novice-guide-reopen')),true);
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.fixture.counts.reopen),1);
    assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-novice-guide-close')),true);
    await page.locator('[data-novice-guide-skip]').click();assert.equal(await page.evaluate(()=>window.fixture.counts.skip),1);
    assert.equal(await page.locator('[data-novice-guide-reopen]').isVisible(),true);
    await page.locator('[data-novice-guide-reopen]').click();
    await page.evaluate(()=>window.fixture.update());assert.equal(await page.locator('[data-novice-guide-step="play"]').count(),1);
    assert.equal(await page.locator('[data-novice-guide-action]').isVisible(),false);
    await check();
    if(viewport.width===320){
      await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>window.fixture.read().table.width===390);await check();
      await page.setViewportSize(viewport);await page.waitForFunction(()=>window.fixture.read().table.width===320);await check();
    }
    await page.evaluate(()=>window.fixture.unmount());assert.equal(await page.locator('[data-novice-guide]').count(),0);
    await context.close();
  }
  // A short unobstructed band remains scrollable and keyboard focusable.
  const page=await browser.newPage({viewport:{width:320,height:568}});await page.goto(url);await page.locator('[data-novice-guide]').waitFor();
  await page.evaluate(()=>window.fixture.constrain());
  const constrained=page.locator('[data-novice-guide-panel]');
  assert.equal(await constrained.getAttribute('aria-label'),'新手引导，可滚动查看');
  assert.equal(await constrained.getAttribute('tabindex'),'0');
  assert.equal(await constrained.evaluate(element=>element.scrollHeight>element.clientHeight),true);
  await constrained.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>window.fixture.counts.gameKeys),0);
  await page.locator('[data-novice-guide-skip]').focus();assert.equal(await page.evaluate(()=>document.activeElement?.hasAttribute('data-novice-guide-skip')),true);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.fixture.unmount());
  await page.setViewportSize({width:320,height:568});assert.equal(await page.locator('[data-novice-guide]').count(),0);
  await page.close();
  console.log('Novice guide: touch-through, safe layout, keyboard, resize, scroll and teardown passed.');
} finally {await browser?.close();await server.close();}
