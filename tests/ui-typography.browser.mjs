import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'vite';
import {confirmHeroRoute,enterOpeningShop,openSelector,tapUI,waitScene} from '../harness/ui.mjs';

const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'});
await server.listen();
const url='http://127.0.0.1:'+server.httpServer.address().port+'/?harness=1&seed=r03-651';
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH});

try {
  for(const test of [
    {name:'loaded',width:1366,height:768},
    {name:'loaded-phone',width:390,height:844},
    {name:'blocked',width:320,height:568},
    {name:'slow',width:390,height:844},
  ]){
    const touch=test.width<700;
    const page=await browser.newPage({viewport:{width:test.width,height:test.height},hasTouch:touch,reducedMotion:'reduce'});
    let release;
    const gate=new Promise(resolve=>{release=resolve;});
    try {
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      if(test.name==='blocked'||test.name==='slow')await page.route('**/assets/fonts/ui/song.woff2',async route=>{
        if(test.name==='blocked')await route.abort('failed');
        else {await gate;await route.continue().catch(()=>{});}
      });
      const start=Date.now();
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await waitScene(page,'title');
      assert.ok(Date.now()-start<10000,'optional font cannot block the title');
      if(test.name.startsWith('loaded')){
        const face=await page.evaluate(()=>[...document.fonts].find(font=>font.family==='Tangsongpai Song UI')?.status);
        assert.equal(face,'loaded','canvas text receives the local font before its first layout');
      }
      await openSelector(page,touch);
      await tapUI(page,'character-select','character/erxiang',touch);
      if(test.name==='slow'){
        release();
        await page.evaluate(()=>document.fonts.ready);
      }
      const view=await page.evaluate(()=>{
        const scene=window.__harness.game.scene.getScene('character-select');
        const text=scene.view.root.list.find(item=>item.name==='opening/name');
        const bounds=text.getBounds();
        return {font:text.style.fontFamily,bounds:{x:bounds.x,width:bounds.width}};
      });
      assert.match(view.font,/Tangsongpai Song UI/);
      assert.ok(view.bounds.x>=0&&view.bounds.x+view.bounds.width<=test.width+1,'hero name fits the visible area');
      if(test.name.startsWith('loaded')){
        for(const id of ['amo','touye','laohuan','erxiang','azao','xiemu']){
          await tapUI(page,'character-select','character/'+id,touch);
          const labels=await page.evaluate(()=>{
            const scene=window.__harness.game.scene.getScene('character-select');
            return scene.view.root.list.filter(item=>item.type==='Text'&&item.name.startsWith('opening/')&&item.visible).map(item=>{
              const b=item.getBounds();
              return {name:item.name,x:b.x,y:b.y,width:b.width,height:b.height,lines:item.getWrappedText()};
            });
          });
          for(const label of labels){
            assert.ok(label.x>=-1&&label.x+label.width<=test.width+1,JSON.stringify({id,label}));
            assert.ok(label.y>=-1&&label.y+label.height<=test.height+1,JSON.stringify({id,label}));
            assert.ok(!label.lines.some(line=>/^[，。！？；：、）》】」』〕”’…]+$/.test(line)),JSON.stringify({id,label}));
          }
        }
      }
      await tapUI(page,'character-select','opening/hero-details',touch);
      const dialog=page.locator('.detail-dialog[open]');
      await dialog.waitFor();
      const bounds=await dialog.boundingBox();
      assert.ok(bounds.x>=0&&bounds.x+bounds.width<=test.width+1);
      assert.ok(bounds.y>=0&&bounds.y+bounds.height<=test.height+1);
      await confirmHeroRoute(page,touch);
      await enterOpeningShop(page,touch);
      for(const shelf of ['tools','items']){
        await tapUI(page,'shop','action/shelf-'+shelf,touch);
        const offerId=await page.evaluate(()=>window.__harness.game.scene.getScene('shop').shelfOffers().find(offer=>!offer.consumed)?.offerId);
        assert.ok(offerId,'a visible offer can be inspected');
        await tapUI(page,'shop','offer/'+offerId,touch);
        const detail=page.locator('.detail-dialog[open]');
        await detail.waitFor();
        const box=await detail.boundingBox();
        assert.ok(box.x>=0&&box.x+box.width<=test.width+1,'purchase details fit horizontally');
        assert.ok(box.y>=0&&box.y+box.height<=test.height+1,'purchase details fit vertically');
        const close=detail.locator('.dialog-actions .dialog-close');
        if(touch)await close.tap();else await close.click();
      }
      await tapUI(page,'shop','action/shelf-workshop',touch);
      const workshop=page.locator('.shop-inline-workshop');
      await workshop.waitFor();
      for(const goal of await workshop.locator('[data-workshop-goal]').all()){
        if(touch)await goal.tap();else await goal.click();
        assert.equal(await goal.getAttribute('aria-pressed'),'true');
      }
      assert.deepEqual(errors,[]);
      console.log('PASS typography',test.name,test.width+'x'+test.height);
    } finally {
      release();
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
