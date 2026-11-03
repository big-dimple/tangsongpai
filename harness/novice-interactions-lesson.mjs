/** Natural tutorial interactions in Chromium. Player actions use browser input only. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,readdir,symlink,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {confirmHeroRoute,enterOpeningShop,openRunMenu,point,tapUI,toggleRunMenu,waitScene} from './ui.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.NOVICE_LESSON_OUT??'/tmp/tsp-novice-interactions-lesson');
await mkdir(out,{recursive:true});
async function sourceFingerprint(){
  const hash=createHash('sha256'),files=[];
  const visit=async path=>{for(const item of await readdir(join(root,path),{withFileTypes:true})){const next=join(path,item.name);if(item.isDirectory())await visit(next);else if(item.isFile())files.push(next);}};
  await visit('src');files.push('index.html','package.json','package-lock.json','vite.config.ts','harness/ui.mjs','harness/novice-interactions-lesson.mjs');
  for(const path of files.sort()){const data=await readFile(join(root,path));hash.update(path+'\0'+data.length+'\0');hash.update(data);}
  return hash.digest('hex');
}
const sourceBefore=await sourceFingerprint();
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('/usr/bin/ffmpeg')){
  const dir=await mkdtemp(join(tmpdir(),'tsp-lesson-video-'));
  const manifest=JSON.parse(await readFile(join(dirname(require.resolve('playwright-core/package.json')),'browsers.json'),'utf8'));
  const revision=manifest.browsers.find(row=>row.name==='ffmpeg')?.revision;
  assert.ok(revision,'Playwright ffmpeg revision');
  await mkdir(join(dir,`ffmpeg-${revision}`));
  await symlink('/usr/bin/ffmpeg',join(dir,`ffmpeg-${revision}`,'ffmpeg-linux'));
  process.env.PLAYWRIGHT_BROWSERS_PATH=dir;
}
const {chromium}=await import('playwright');
const port=Number(process.env.NOVICE_LESSON_PORT??5812);
const motionMode=process.env.NOVICE_LESSON_MOTION??'normal';
assert.ok(['normal','system','game'].includes(motionMode),'NOVICE_LESSON_MOTION must be normal, system, or game');
const server=await createServer({root,mode:'e2e',cacheDir:`/tmp/tsp-lesson-vite-${port}`,optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const cases=[
  {name:'desktop',width:1366,height:768,touch:false},
  {name:'phone390',width:390,height:740,touch:true},
  {name:'short320',width:320,height:568,touch:true},
].filter(spec=>!process.env.NOVICE_LESSON_CASE||process.env.NOVICE_LESSON_CASE.split(',').includes(spec.name));
assert.ok(cases.length||process.env.NOVICE_LESSON_RETURNING_ONLY==='1','NOVICE_LESSON_CASE must select at least one case');
const report={scope:'Fresh real tutorial and non-intercepting gesture demonstration, browser mouse or emulated touch, plus an unchanged legacy checkpoint preloaded in IndexedDB to emulate a returning player. No physical device or human comprehension claim.',browser:browser.version(),sourceBefore,motionMode,cases:[]};
const sorted=ids=>[...ids].sort();
const sameBox=(a,b)=>Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;

async function scenario(spec){
  const dir=join(out,spec.name);await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,isMobile:spec.touch,deviceScaleFactor:1,reducedMotion:motionMode==='system'?'reduce':'no-preference',recordVideo:{dir,size:{width:spec.width,height:spec.height}}});
  const page=await context.newPage(),cdp=spec.touch?await context.newCDPSession(page):undefined;
  const row={...spec,checks:[],shots:[],errors:[],status:'RUNNING'};report.cases.push(row);
  page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error.stack??error)));
  const click=async locator=>spec.touch?locator.tap():locator.click();
  const tap=async(key,name)=>tapUI(page,key,name,spec.touch);
  const saved=()=>page.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,storage:await c.store.read()};});
  const state=async()=>(await saved()).state;
  const selected=()=>page.evaluate(()=>[...window.__harness.game.scene.getScene('game').selectedIds]);
  const expectSelected=async(ids,label)=>assert.deepEqual(sorted(await selected()),sorted(ids),label);
  const ready=()=>page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));},null,{timeout:30000});
  const shopReady=async()=>{await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);};
  const cue=async title=>{await page.waitForFunction(title=>document.querySelector('[data-novice-guide-panel] .novice-guide-title')?.textContent===title,title,{timeout:30000});await page.locator('[data-novice-guide-panel]:visible').waitFor();};
  const guideView=()=>page.evaluate(()=>{
    const p=document.querySelector('[data-novice-guide-panel]');if(!p)return null;
    const r=p.getBoundingClientRect(),scroll=document.scrollingElement,clip={left:Math.max(0,r.left),top:Math.max(0,r.top),right:Math.min(innerWidth,r.right),bottom:Math.min(innerHeight,r.bottom)};
    for(let parent=p.parentElement;parent;parent=parent.parentElement){const style=getComputedStyle(parent),b=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);}if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);}}
    return {step:document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep,title:p.querySelector('.novice-guide-title')?.textContent,body:p.querySelector('.novice-guide-body')?.textContent,text:p.innerText,
      box:{x:r.x,y:r.y,width:r.width,height:r.height},clip,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,
      documentScroll:{width:scroll?.scrollWidth,clientWidth:scroll?.clientWidth,height:scroll?.scrollHeight,clientHeight:scroll?.clientHeight}};
  });
  const shot=async name=>{
    const view=await guideView();
    if(view){
      const b=view.box;assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=spec.width+1&&b.y+b.height<=spec.height+1,`${name}: guide stays in viewport: ${JSON.stringify(view)}`);
      assert.ok(view.clip.right-view.clip.left>=b.width-1&&view.clip.bottom-view.clip.top>=b.height-1,`${name}: guide is not clipped by a scrolling ancestor: ${JSON.stringify(view)}`);
      assert.ok(view.scrollHeight<=view.clientHeight+1,`${name}: guide text is not clipped: ${JSON.stringify(view)}`);
      assert.ok(view.documentScroll.width<=view.documentScroll.clientWidth+1,`${name}: no horizontal page overflow`);
    }
    await page.screenshot({path:join(dir,name+'.png'),scale:'css'});row.shots.push({name,view});console.log(spec.name,name,view?.title,view?.body);
    return view;
  };
  const settleCommand=async before=>{
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c?.status==='idle'&&c.state.commandSeq>seq;},before.state.commandSeq,{timeout:30000});
    await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation;},null,{timeout:30000});
  };
  const select=async ids=>{for(const id of ids)await tap('game','card/'+id);};
  const clear=async()=>{for(const id of await selected())await tap('game','card/'+id);await ready();await expectSelected([],'clear selection by tapping the cards');};
  const touchEvent=async(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(({x,y,id=1})=>({x,y,id,radiusX:2,radiusY:2,force:1}))});
  const down=async p=>{if(spec.touch)await touchEvent('touchStart',[p]);else{await page.mouse.move(p.x,p.y);await page.mouse.down();}};
  const move=async p=>{if(spec.touch)await touchEvent('touchMove',[p]);else await page.mouse.move(p.x,p.y);};
  const up=async()=>{if(spec.touch)await touchEvent('touchEnd',[]);else await page.mouse.up();};
  const route=async ids=>{const points=await Promise.all(ids.map(id=>point(page,'game','card/'+id)));await down(points[0]);for(const p of points.slice(1))await move(p);await up();await ready();};
  const observeHand=()=>page.evaluate(()=>{
    const game=window.__harness.game,s=game.scene.getScene('game'),l=s.view.layout,c=game.canvas.getBoundingClientRect(),sx=c.width/l.width,sy=c.height/l.height;
    const map=b=>({x:c.left+b.x*sx,y:c.top+b.y*sy,width:b.width*sx,height:b.height*sy});
    const cards=s.hand.flatMap((card,i)=>{const v=s.cardViews[i],seat=l.cards[i];if(!v?.container.active||!v.container.visible||!seat?.visible)return[];const w=Number(v.container.getData('width')),h=Number(v.container.getData('height')),m=v.container.getWorldTransformMatrix(),a=m.transformPoint(-w/2,-h/2),b=m.transformPoint(w/2,h/2);return[{id:card.id,...map({x:a.x,y:a.y,width:Math.min(b.x-a.x,seat.hit.width),height:b.y-a.y})}];});
    const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
    return {cards,rings,order:[...s.run.handOrder],status:s.statusText.text};
  });
  const noDemo=async label=>{
    await page.waitForFunction(()=>!document.querySelector('[data-novice-gesture]'),null,{timeout:1500});
    await page.waitForTimeout(120);assert.equal(await page.locator('[data-novice-gesture]').count(),0,label+': demonstration stays removed');
  };
  const sampleDemo=async(mode,from,to,expectedMotion=motionMode)=>{
    const demo=page.locator(`[data-novice-gesture][data-mode="${mode}"]`);await demo.waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(mode=>{const d=document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`);return d&&!d.hidden&&d.dataset.phase&&d.dataset.x&&d.dataset.y;},mode);
    const before=await saved(),beforeSelected=mode==='sweep'?await selected():undefined;
    const geometry=await page.evaluate(({mode,from,to})=>{
      const game=window.__harness.game,key=mode==='sweep'?'game':'shop',scene=game.scene.getScene(key),layout=scene.view.layout,canvas=game.canvas.getBoundingClientRect();
      const map=b=>b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.width)&&Number.isFinite(b.height)?{x:canvas.left+b.x*canvas.width/layout.width,y:canvas.top+b.y*canvas.height/layout.height,width:b.width*canvas.width/layout.width,height:b.height*canvas.height/layout.height}:undefined;
      const boxes=mode==='sweep'?[layout.tableActions?.play,layout.tableActions?.discard,layout.buttons?.rank,layout.buttons?.suit,layout.heroAction,layout.inventoryEntry,layout.helpEntry]:(()=>{const p=scene.geometry();return[p.play,p.ownedToggle,p.reroll,p.tabs];})();
      const seats=mode==='sweep'?layout.cards.filter(card=>card.visible).map(card=>map(card.hit)).filter(Boolean):scene.geometry().slots.slice(0,2).map(map).filter(Boolean);
      const closest=point=>[...seats].sort((a,b)=>Math.hypot(a.x+a.width/2-point.x,a.y+a.height/2-point.y)-Math.hypot(b.x+b.width/2-point.x,b.y+b.height/2-point.y))[0];
      const panel=document.querySelector('[data-novice-guide-panel]')?.getBoundingClientRect();
      return{critical:boxes.map(map).filter(Boolean),panel:panel?{x:panel.x,y:panel.y,width:panel.width,height:panel.height}:null,threshold:10*canvas.width/layout.width,startBox:closest(from),endBox:closest(to)};
    },{mode,from,to});
    const meta=await demo.evaluate(root=>({aria:root.getAttribute('aria-hidden'),pointer:getComputedStyle(root).pointerEvents,children:[...root.querySelectorAll('*')].map(el=>getComputedStyle(el).pointerEvents),reduced:root.dataset.reduced,route:root.querySelector('[data-novice-gesture-route]')?{display:getComputedStyle(root.querySelector('[data-novice-gesture-route]')).display,points:root.querySelector('polyline')?.getAttribute('points'),arrow:root.querySelector('.novice-gesture-route path')?.getAttribute('d')}:null}));
    assert.equal(meta.aria,'true',mode+': visual-only hand is hidden from accessibility tree');assert.equal(meta.pointer,'none');assert.ok(meta.children.every(value=>value==='none'),mode+': no demonstration node intercepts input');
    const reduced=expectedMotion!=='normal';assert.equal(meta.reduced,String(reduced),mode+': actual motion setting is respected');
    const frames=await page.evaluate(({mode,duration})=>new Promise(resolve=>{
      const started=performance.now(),frames=[];let last=-Infinity,done=false;
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);resolve(frames);};const timer=setTimeout(finish,duration+5000);
      const sample=now=>{if(done)return;const root=document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`),hand=root?.querySelector('[data-novice-gesture-hand]');
        if(!root||!hand){finish();return;}if(now-last>=35){last=now;const b=hand.getBoundingClientRect(),x=Number(root.dataset.x),y=Number(root.dataset.y),hit=document.elementFromPoint(x,y);frames.push({t:now-started,phase:root.dataset.phase,x,y,hidden:root.hidden,opacity:getComputedStyle(hand).opacity,hand:{x:b.x,y:b.y,width:b.width,height:b.height},intercepts:!!hit&&root.contains(hit)});}
        if(now-started>=duration)finish();else requestAnimationFrame(sample);
      };requestAnimationFrame(sample);
    }),{mode,duration:reduced?850:mode==='sweep'?3200:6500});
    assert.ok(frames.length>5,mode+': sample captured rendered frames');assert.ok(frames.every(f=>!f.hidden&&!f.intercepts&&Number.isFinite(f.x)&&Number.isFinite(f.y)),mode+': overlay remains visible and click-through');
    const intersects=(a,b)=>a&&b&&a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1;
    for(const frame of frames.filter(f=>f.opacity!=='0')){
      assert.ok(frame.hand.x>=-1&&frame.hand.y>=-1&&frame.hand.x+frame.hand.width<=spec.width+1&&frame.hand.y+frame.hand.height<=spec.height+1,`${mode}: hand stays in viewport ${JSON.stringify(frame)}`);
      assert.ok(!intersects(frame.hand,geometry.panel),`${mode}: hand covers tutorial text/buttons ${JSON.stringify(frame)}`);
      for(const box of geometry.critical)assert.ok(!intersects(frame.hand,box),`${mode}: hand covers a critical control ${JSON.stringify({frame,box})}`);
    }
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),inside=(point,box)=>box&&point.x>=box.x-2&&point.x<=box.x+box.width+2&&point.y>=box.y-2&&point.y<=box.y+box.height+2,span=Math.max(...frames.map(f=>f.x))-Math.min(...frames.map(f=>f.x));
    assert.ok(geometry.startBox&&geometry.endBox,mode+': real source and destination hit boxes are measurable');
    if(reduced){
      assert.ok(frames.every(f=>f.phase==='static'),mode+': reduced motion remains static');assert.ok(Math.max(...frames.map(f=>distance(f,frames[0])))<.2,mode+': static hand does not move');
      assert.equal(meta.route?.display,'block',mode+': reduced-motion arrow is visible');assert.ok(meta.route.points&&meta.route.arrow,mode+': static route has real endpoints and arrow');
      const end=meta.route.points.trim().split(/\s+/).at(-1).split(',').map(Number);assert.ok(inside({x:end[0],y:end[1]},geometry.endBox),mode+': reduced-motion arrow ends inside the real target hit box');
    }else{
      for(const phase of ['press','move','release','rest'])assert.ok(frames.some(f=>f.phase===phase),`${mode}: observed ${phase}`);
      assert.ok(span>=Math.abs(to.x-from.x)-25,`${mode}: hand travels along the actual input path`);
      assert.ok(frames.filter(f=>f.phase==='press').some(f=>inside(f,geometry.startBox)),`${mode}: press begins inside the real source hit box`);
      assert.ok(frames.filter(f=>f.phase==='release').some(f=>inside(f,geometry.endBox)),`${mode}: release arrives inside the real destination hit box`);
      if(mode==='hold-drag'){
        let longest=0,start;for(const frame of frames){if(frame.phase==='hold'){if(start===undefined)start=frame.t;longest=Math.max(longest,frame.t-start);}else start=undefined;}assert.ok(longest>=355,`hold-drag: stationary pause must exceed the real hold threshold; got ${longest}ms`);
        assert.ok(frames.filter(f=>f.phase==='hold').every(f=>inside(f,geometry.startBox)),'hold-drag: the hand stays inside the source while holding');
      }else{
        const presses=frames.map((frame,index)=>frame.phase==='press'&&(index===0||frames[index-1].phase!=='press')?index:-1).filter(index=>index>=0);
        assert.ok(presses.some(index=>frames.some(frame=>frame.t>=frames[index].t&&frame.t-frames[index].t<355&&distance(frame,frames[index])>geometry.threshold)),`sweep: moves beyond the real threshold before a long press: ${JSON.stringify({threshold:geometry.threshold,frames})}`);
      }
    }
    assert.deepEqual(await saved(),before,mode+': passive demonstration changes no saved command or state');if(mode==='sweep')assert.deepEqual(await selected(),beforeSelected,'passive sweep changes no selection');else assert.equal(await page.locator('.detail-dialog[open]').count(),0,'passive drag opens no sale or card detail');
    const phaseShots=[];
    if(!reduced)for(const phase of mode==='hold-drag'?['press','hold','move','release']:['press','move','release']){
      await page.waitForFunction(({mode,phase,from,to})=>{const d=document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`);if(d?.dataset.phase!==phase)return false;if(phase!=='move')return true;const progress=(Number(d.dataset.x)-from.x)/(to.x-from.x);return progress>=.25&&progress<=.65;},{mode,phase,from,to},{timeout:12000});
      const file=`demo-${mode}-${phase}.png`;await page.screenshot({path:join(dir,file),scale:'css'});phaseShots.push(file);
    }
    assert.deepEqual(await saved(),before,mode+': the complete visual cycle changes no saved command or state');if(mode==='sweep')assert.deepEqual(await selected(),beforeSelected,'visual cycle changes no selection');else assert.equal(await page.locator('.detail-dialog[open]').count(),0,'visual cycle opens no sale or card detail');
    row.demonstrations??={};row.demonstrations[mode+'-'+expectedMotion]={meta,geometry,frames,phaseShots};
    await shot(`demo-${mode}-${reduced?expectedMotion:'animated'}`);row.checks.push(`${mode}: ${reduced?expectedMotion+' reduced-motion static route':'real-path press/move/release timing'} is passive and click-through`);
  };
  const sampleMotionSwitches=async(mode,from,to)=>{
    if(motionMode!=='normal')return;
    if(spec.name==='short320'){
      await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(mode=>document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`)?.dataset.reduced==='true',mode);
      await sampleDemo(mode,from,to,'system');await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(mode=>document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`)?.dataset.reduced==='false',mode);
      row.checks.push(mode+': system reduced-motion setting changes the live demonstration and can be restored');
    }
    if(spec.name==='phone390'){
      await openRunMenu(page,spec.touch);await page.getByLabel('减少动态',{exact:true}).check();await toggleRunMenu(page,spec.touch);
      await page.locator(`[data-novice-gesture][data-mode="${mode}"]:visible`).waitFor();await sampleDemo(mode,from,to,'game');
      await openRunMenu(page,spec.touch);await page.getByLabel('减少动态',{exact:true}).uncheck();await toggleRunMenu(page,spec.touch);
      await page.waitForFunction(mode=>document.querySelector(`[data-novice-gesture][data-mode="${mode}"]`)?.dataset.reduced==='false',mode);
      row.checks.push(mode+': in-game reduced-motion setting changes the demonstration and can be restored');
    }
  };
  const restore=async scene=>{
    const before=await saved();await page.reload();await waitScene(page,'title');await tap('title','action/title-continue');await waitScene(page,scene);
    if(scene==='game')await ready();if(scene==='shop')await shopReady();
    const after=await saved();assert.deepEqual(after,before,`${scene}: refresh retains state, journal and storage`);return after;
  };
  const continueResult=async()=>{
    for(let attempt=0;attempt<8;attempt++){
      const p=await point(page,'intermission','action/continue-stage');
      const v=await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('intermission'),r=g.canvas.getBoundingClientRect(),v=s.resultContent.getData('viewport');return{top:r.top+v.top*r.height/s.view.layout.height,bottom:r.top+v.bottom*r.height/s.view.layout.height};});
      if(p.y>=v.top&&p.y<=v.bottom){await tap('intermission','action/continue-stage');return;}
      await page.mouse.move(spec.width/2,(v.top+v.bottom)/2);await page.mouse.wheel(0,p.y<v.top?-300:300);await page.waitForTimeout(150);
    }
    throw Error('result continuation did not enter its scroll viewport');
  };
  const buy=async definitionId=>{
    const before=await saved(),offer=before.state.shop.offers.find(o=>o.definitionId===definitionId&&!o.consumed);assert.ok(offer,`${definitionId} is in the actual shop`);
    await tap('shop','offer/'+offer.offerId);const dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();
    const purchase=dialog.getByRole('button',{name:/^(购买 · \d+ 金|确认购买)$/});await click(purchase);
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c.status==='idle'&&c.state.commandSeq>seq;},before.state.commandSeq);
    await shopReady();const after=await saved();assert.equal(after.journal.at(-1).action.type,'BuyOffer');assert.equal(after.journal.at(-1).action.offerId,offer.offerId);assert.equal(after.state.jokers.length,before.state.jokers.length+1);return after;
  };

  try{
    await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');
    if(motionMode==='game'){
      await openRunMenu(page,spec.touch);await page.getByLabel('减少动态',{exact:true}).check();await toggleRunMenu(page,spec.touch);
      assert.equal(await page.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts');return gameSession().reducedMotion;}),true,'the player enabled reduced motion through the menu');
    }
    await tap('title','action/title-start');await waitScene(page,'game');await ready();await cue('先找一对');
    await shot('01-pair');await select(['clubs-5','hearts-5']);await expectSelected(['clubs-5','hearts-5'],'select first pair');
    let before=await saved();await tap('game','action/play');await settleCommand(before);await ready();await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='discard');
    await page.waitForTimeout(2800);await select(['clubs-4','diamonds-4']);await expectSelected(['clubs-4','diamonds-4'],'choose both suggested discards');
    before=await saved();await tap('game','action/discard');await settleCommand(before);await ready();await cue('先理牌');await shot('02-sort-instruction');

    before=await saved();await tap('game','action/sort-rank');await ready();assert.equal((await guideView()).title,'先理牌','rank sorting alone does not complete the suit lesson');
    before=await saved();await tap('game','action/sort-suit');await ready();await cue('试试滑动选牌');
    assert.match((await guideView()).body,spec.touch?/按下.*滑/:/鼠标左键.*拖/,'swipe instructions describe the actual input device');
    const suitSaved=await saved();assert.ok(suitSaved.state.commandSeq>before.state.commandSeq,'suit sorting saves a command');assert.equal(suitSaved.journal.at(-1).action.type,'ReorderHand');
    await shot('03-swipe-instruction');
    const firstHand=await observeHand(),firstRinged=firstHand.cards.filter(card=>firstHand.rings.some(ring=>sameBox(card,ring))),firstPositions=firstRinged.map(card=>firstHand.order.indexOf(card.id)).sort((a,b)=>a-b);
    assert.ok(firstPositions.length>=2,'swipe lesson exposes both endpoints');
    const firstFrom=await point(page,'game','card/'+firstHand.order[firstPositions[0]]),firstTo=await point(page,'game','card/'+firstHand.order[firstPositions.at(-1)]);
    await sampleDemo('sweep',firstFrom,firstTo);await sampleMotionSwitches('sweep',firstFrom,firstTo);
    await click(page.locator('[data-novice-guide-close]'));await page.locator('[data-novice-guide-reopen]:visible').waitFor();await noDemo('closing the swipe guide');
    await click(page.locator('[data-novice-guide-reopen]'));await cue('试试滑动选牌');assert.ok(await page.locator('[data-novice-gesture]').count()<=1,'reopening never duplicates the demonstration');
    await restore('game');await cue('试试滑动选牌');assert.deepEqual((await state()).handOrder,suitSaved.state.handOrder,'suit order survives refresh');
    await page.locator('[data-novice-gesture][data-mode="sweep"]:visible').waitFor();assert.equal(await page.locator('[data-novice-gesture]').count(),1,'refresh leaves exactly one live swipe demonstration');
    await shot('04-swipe-restored');

    const hand=await observeHand(),ringed=hand.cards.filter(card=>hand.rings.some(ring=>sameBox(card,ring)));
    assert.ok(ringed.length>=2,`visible highlighted endpoints: ${JSON.stringify(hand)}`);
    const positions=ringed.map(card=>hand.order.indexOf(card.id)).sort((a,b)=>a-b),first=positions[0],last=positions.at(-1),between=hand.order.slice(first,last+1);
    assert.ok(between.length>=3&&between.length<=5,`highlighted span contains 3–5 cards: ${JSON.stringify({hand,ringed})}`);
    const a=await point(page,'game','card/'+between[0]),b=await point(page,'game','card/'+between.at(-1));
    const beforeInterruptedLesson=await saved();await down(a);assert.equal(await page.locator('[data-novice-gesture]').count(),0,'real hand press immediately dismisses the sweep demonstration');await move(b);await noDemo('during real hand swipe');
    if(spec.touch)await touchEvent('touchCancel',[]);else{await page.keyboard.press('Escape');await page.mouse.up();}
    await ready();assert.equal(await page.locator('[data-novice-guide-choice]:visible').count(),0,'interruption cannot complete the swipe lesson');
    await clear();await cue('试试滑动选牌');assert.deepEqual(await saved(),beforeInterruptedLesson,'interrupted tutorial sweep changes no saved command');
    await route([between[0],between[1]]);await cue('再试一次');assert.equal(await page.locator('[data-novice-guide-choice]:visible').count(),0,'partial sweep does not complete the lesson');await clear();await cue('试试滑动选牌');
    await down(a);await move(b);assert.equal((await guideView()).title,'试试滑动选牌','lesson stays until the pointer is released');await up();await ready();
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent!=='试试滑动选牌');await noDemo('leaving the swipe lesson');await expectSelected(between,'real sweep selects the highlighted span');
    await shot('05-sweep-complete');const afterSweep=await saved();await restore('game');assert.notEqual((await guideView()).title,'试试滑动选牌','completed lesson stays complete after reload');assert.deepEqual((await state()).handOrder,afterSweep.state.handOrder);await expectSelected([],'unsent selection is cleared by reload');
    row.checks.push('suit sort saves and resumes swipe lesson; completed real sweep survives refresh');

    const ids=(await state()).handOrder;assert.equal(ids.length,8);const stable=await saved(),firstFive=ids.slice(0,5);
    await route([ids[0],ids[4],ids[0]]);await expectSelected(firstFive,'reverse sweep does not retoggle visited cards');
    await route([ids[4],ids[0],ids[4]]);await expectSelected([],'starting on selected card cancels across the row');
    await tap('game','card/'+ids[2]);await expectSelected([ids[2]],'tap selects one');await tap('game','card/'+ids[2]);await expectSelected([],'second tap cancels');
    await route([ids[0],ids[7]]);await expectSelected(firstFive,'sweep stops at five');await tap('game','card/'+ids[7]);await expectSelected(firstFive,'sixth tap is rejected');
    assert.match((await observeHand()).status,/最多选择\s*5/,'limit feedback is visible');await shot('06-selection-limit');await clear();
    await route([ids[7],ids[0]]);await expectSelected(ids.slice(3),'reverse full-row sweep selects the first five encountered');await clear();
    const start=await point(page,'game','card/'+ids[0]),end=await point(page,'game','card/'+ids[3]);await down(start);await move(end);const applied=await selected();
    if(spec.touch)await touchEvent('touchCancel',[]);else{await page.keyboard.press('Escape');await page.mouse.up();}await ready();await expectSelected(spec.touch?applied:[],'system touch cancel retains applied selection; Escape restores original selection');await clear();
    assert.deepEqual(await saved(),stable,'unsent selection and interrupted sweeps do not mutate saved run');row.checks.push('reverse, cancel, five-card limit and interrupted pointer preserve the saved game');

    const flush=page.locator('[data-novice-guide-choice="flush"]');await flush.waitFor({state:'visible'});await click(flush);
    const hearts=(await state()).handOrder.filter(id=>id.startsWith('hearts-'));assert.equal(hearts.length,5);await route([hearts[0],hearts.at(-1)]);await expectSelected(hearts,'five actual hearts selected by sweep');
    before=await saved();await tap('game','action/play');await settleCommand(before);assert.equal((await state()).phase,'stage-cleared');assert.equal((await state()).lastTrace.handType,'flush');await waitScene(page,'intermission');await shot('07-cleared');
    await continueResult();await shopReady();await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached'});const firstPurchase=await buy('b02');await cue(spec.touch?'展开已拥有牌':'这里有五个槽');
    const firstView=await shot('08-first-purchase');
    if(spec.touch){assert.match(firstView.title,/展开/,'phone explains how to open owned cards');await tap('shop','action/toggle-owned');await cue('这里有五个槽');}
    const expanded=await shot('09-owned-open');assert.match(expanded.text,/(五|5)\s*(个)?\s*槽/,'five slots are explained');assert.match(expanded.text,/通常从左到右触发/,'the usual trigger order is explained');assert.match(expanded.text,/继续买.*进入牌桌/,'the player can continue shopping or play with one card');
    await page.waitForTimeout(1400);await shot('09b-owned-settled');
    row.rackOverlay=await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('shop'),canvas=g.canvas.getBoundingClientRect(),l=s.view.layout,walk=items=>items.flatMap(o=>[o,...(o.list?walk(o.list):[])]);const region={left:canvas.left+60*canvas.width/l.width,right:canvas.left+170*canvas.width/l.width,top:canvas.top+390*canvas.height/l.height,bottom:canvas.top+430*canvas.height/l.height};return{region,canvas:walk(s.children.list).flatMap(o=>{if(!o.active||!o.visible||!o.getBounds)return[];const b=o.getBounds(),r={left:canvas.left+b.x*canvas.width/l.width,right:canvas.left+(b.x+b.width)*canvas.width/l.width,top:canvas.top+b.y*canvas.height/l.height,bottom:canvas.top+(b.y+b.height)*canvas.height/l.height};return r.left<region.right&&r.right>region.left&&r.top<region.bottom&&r.bottom>region.top?[{name:o.name,type:o.type,text:o.text,rect:r}]:[];}),dom:[...document.querySelectorAll('body *')].flatMap(el=>{const b=el.getBoundingClientRect();return b.width&&b.height&&b.left<region.right&&b.right>region.left&&b.top<region.bottom&&b.bottom>region.top&&getComputedStyle(el).visibility!=='hidden'?[{tag:el.tagName,className:String(el.className),text:el.innerText?.slice(0,100),rect:{left:b.left,right:b.right,top:b.top,bottom:b.bottom}}]:[];})};});
    const rack=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),g=s.geometry();return{collapsed:g.inventoryCollapsed,slots:g.slots,owned:s.run.jokers.map(j=>j.instanceId)};});assert.equal(rack.collapsed,false);assert.equal(rack.slots.length,5);assert.equal(rack.owned.length,1);
    await restore('shop');const reloadedRack=await page.evaluate(()=>({collapsed:window.__harness.game.scene.getScene('shop').geometry().inventoryCollapsed,owned:window.__harness.game.registry.get('runController').state.jokers.length}));assert.deepEqual(reloadedRack,{collapsed:false,owned:1});await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached'});await page.waitForTimeout(450);await shot('10-owned-restored');
    row.checks.push('first real purchase explains the expanded five-slot rack and usual trigger order; expanded state resumes after refresh');

    if(process.env.NOVICE_LESSON_PAYOFF_ONLY==='1'){
      await tap('shop','action/start-stage');await waitScene(page,'game');await ready();await cue('心有灵犀');
      const payoff=await shot('11-payoff-instruction');assert.match(payoff.body,/同点/);assert.equal(await page.locator('.blind-select-dialog[open]').count(),0);
      const current=await state(),groups=new Map();for(const id of current.handOrder){const rank=current.deckInstances.find(card=>card.id===id).rank;groups.set(rank,[...(groups.get(rank)??[]),id]);}
      const pair=[...groups.values()].find(ids=>ids.length>=2)?.slice(0,2);assert.ok(pair,'the actual dealt hand has the recommended pair');await select(pair);await expectSelected(pair,'select a real pair');await shot('12-payoff-pair');
      before=await saved();await tap('game','action/play');await settleCommand(before);let after=await state();assert.ok(after.lastTrace.events.some(event=>event.sourceDefinitionId==='b02'&&event.operation==='add-multiplier'),'the purchased card actually contributes');await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='skill');await shot('13-card-payoff');
      let skillPair;
      for(let attempt=0;attempt<4;attempt++){
        after=await state();const groups=new Map();for(const id of after.handOrder){const rank=after.deckInstances.find(card=>card.id===id).rank;groups.set(rank,[...(groups.get(rank)??[]),id]);}skillPair=[...groups.values()].find(ids=>ids.length>=2)?.slice(0,2);
        if(skillPair)break;assert.ok(after.stage.discardsLeft>0,'can exchange cards while looking for a pair');await ready();await select(after.handOrder.slice(0,5));before=await saved();await tap('game','action/discard');await settleCommand(before);await ready();await shot('14-skill-discard-'+attempt);
      }
      assert.ok(skillPair,'a real dealt or exchanged pair is available');await ready();await select(skillPair);await cue('牌点可转为倍率');await shot('15-skill-ready');
      await tap('game','hero/action-shortcut');let skillDialog=page.locator('.detail-dialog[open]').last();await skillDialog.waitFor();await page.screenshot({path:join(dir,'16-skill-dialog.png'),scale:'css'});
      const handIndex=(await state()).handOrder.indexOf(skillPair[0])+1;await click(skillDialog.getByRole('button',{name:new RegExp('^第'+handIndex+'张 · ')}));await cue('技能已选');await shot('17-skill-selected');
      before=await saved();await tap('game','action/play');await settleCommand(before);after=await state();assert.ok(after.lastTrace.events.some(event=>event.reasonKey==='erxiang.handoff'),'hero skill really contributes');
      await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='skill-practice');await shot('18-skill-result');
      if(after.phase==='stage-cleared'){await waitScene(page,'intermission');await continueResult();await waitScene(page,'game');await ready();await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='skill-practice');await shot('19-practice-next-stage');}
      await ready();after=await state();await select([after.handOrder[0]]);before=await saved();await tap('game','action/play');await settleCommand(before);await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='complete');await shot('20-tutorial-complete');
      assert.ok(await page.getByRole('button',{name:'开始普通游戏',exact:true}).isVisible());await click(page.getByRole('button',{name:'开始普通游戏',exact:true}));await waitScene(page,'character-select');
      assert.deepEqual(row.errors,[]);row.checks.push('next-stage purchase payoff, hero skill and final free practice really execute and lead to tutorial completion');row.status='PASS';return;
    }

    const held=(await state()).jokers[0].instanceId,stableFirst=await saved();await tap('shop','joker/'+held);let dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await click(dialog.getByRole('button',{name:'出售',exact:true}));dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await shot('11-sale-confirm');await click(dialog.getByRole('button',{name:'取消',exact:true}));
    dialog=page.locator('.detail-dialog[open]').last();if(await dialog.count())await click(dialog.getByRole('button',{name:'关闭',exact:true}));assert.deepEqual(await saved(),stableFirst,'sale cancellation changes no saved data');
    const secondPurchase=await buy('c03');assert.equal(secondPurchase.state.jokers.length,2);
    if(spec.touch){await cue('展开已拥有牌');await shot('12a-two-cards-folded');await tap('shop','action/toggle-owned');}
    await cue('试试调整顺序');assert.match((await guideView()).body,spec.touch?/按住.*拖/:/鼠标左键.*拖/,'reordering instructions describe the actual input device');await shot('12-two-cards');
    const dragBefore=await saved(),idsOwned=dragBefore.state.jokers.map(j=>j.instanceId),from=await point(page,'shop','joker/'+idsOwned[0]),to=await point(page,'shop','joker/'+idsOwned[1]);
    await sampleDemo('hold-drag',from,to);await sampleMotionSwitches('hold-drag',from,to);
    await tap('shop','joker/'+idsOwned[0]);dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await noDemo('opening an owned-card detail');assert.ok(await dialog.getByRole('button',{name:'出售',exact:true}).isVisible());await click(dialog.getByRole('button',{name:'关闭',exact:true}));
    await cue('试试调整顺序');await page.locator('[data-novice-gesture][data-mode="hold-drag"]:visible').waitFor();assert.deepEqual(await saved(),dragBefore,'inspecting during the demonstration submits nothing');
    await down(from);assert.equal(await page.locator('[data-novice-gesture]').count(),0,'real owned-card press immediately dismisses the drag demonstration');await page.waitForTimeout(430);await move(to);await noDemo('during real owned-card drag');await shot('13-drag-held');assert.deepEqual(await saved(),dragBefore,'drag preview does not save');await up();
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c.status==='idle'&&c.state.commandSeq>seq;},dragBefore.state.commandSeq);await shopReady();const dragged=await saved();
    assert.deepEqual(dragged.state.jokers.map(j=>j.instanceId),[idsOwned[1],idsOwned[0]]);assert.equal(dragged.state.gold,dragBefore.state.gold);assert.equal(dragged.journal.at(-1).action.type,'ReorderJokers');assert.equal(await page.locator('.detail-dialog[open]').count(),0,'drag does not open sale or detail');await cue('顺序已保存');await noDemo('after saved reorder');await shot('14-drag-saved');
    await restore('shop');assert.deepEqual((await state()).jokers.map(j=>j.instanceId),[idsOwned[1],idsOwned[0]]);await cue('顺序已保存');await noDemo('refresh after completed reorder');
    const beforeSale=await saved();await tap('shop','joker/'+held);dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await click(dialog.getByRole('button',{name:'出售',exact:true}));dialog=page.locator('.detail-dialog[open]').last();await click(dialog.getByRole('button',{name:'确认出售',exact:true}));
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c.status==='idle'&&c.state.commandSeq>seq;},beforeSale.state.commandSeq);await shopReady();const sold=await saved();
    assert.equal(sold.journal.at(-1).action.type,'SellJoker');assert.equal(sold.journal.at(-1).action.instanceId,held);assert.equal(sold.state.jokers.length,1);assert.ok(sold.state.gold>beforeSale.state.gold);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent!=='顺序已保存');await shot('15-sold');
    await restore('shop');assert.deepEqual((await state()).jokers.map(j=>j.instanceId),[idsOwned[1]]);row.checks.push('tap opens sale, cancel keeps purchase, hold-drag saves one reorder without selling, confirmed sale stays saved');
    assert.equal(firstPurchase.state.jokers.length,1);
    assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);console.error(spec.name,row.error);row.failure=await page.evaluate(()=>{const g=window.__harness?.game,s=g?.scene.getScene('shop'),c=g?.registry.get('runController'),guide=document.querySelector('[data-novice-guide]'),panel=document.querySelector('[data-novice-guide-panel]'),host=document.querySelector('.shop-mobile-offers');return{active:g?.scene.getScenes(true).map(s=>s.scene.key),guide:guide?.outerHTML,panelRect:panel?.getBoundingClientRect().toJSON(),host:host?{scrollTop:host.scrollTop,scrollHeight:host.scrollHeight,clientHeight:host.clientHeight,rect:host.getBoundingClientRect().toJSON()}:null,dialog:[...document.querySelectorAll('dialog[open]')].map(d=>d.innerText),geometry:s?.scene.isActive()?s.geometry():null,state:c?.state,journal:c?.journal};}).catch(()=>null);await page.screenshot({path:join(dir,'failure.png'),scale:'css'}).catch(()=>{});process.exitCode=1;}
  finally{
    await cdp?.detach();const video=page.video();await context.close();if(video){const source=await video.path(),target=join(dir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);}
    await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
}

async function returningScenarios(){
  const spec={name:'skip-and-legacy',width:390,height:740,touch:true},dir=join(out,spec.name);await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:true,isMobile:true,deviceScaleFactor:1,recordVideo:{dir,size:{width:spec.width,height:spec.height}}}),page=await context.newPage();
  const row={...spec,checks:[],errors:[],status:'RUNNING'};report.cases.push(row);page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error.stack??error)));
  try{
    await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');await tapUI(page,'title','action/title-start',true);await waitScene(page,'game');
    const waitReady=()=>page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
    const command=async(name,ids)=>{await waitReady();for(const id of ids)await tapUI(page,'game','card/'+id,true);const seq=await page.evaluate(()=>window.__harness.game.registry.get('runController').state.commandSeq);await tapUI(page,'game','action/'+name,true);await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,seq);await waitReady();};
    await command('play',['clubs-5','hearts-5']);await page.waitForFunction(()=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep==='discard');await page.waitForTimeout(2800);
    await command('discard',['clubs-4','diamonds-4']);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='先理牌');await tapUI(page,'game','action/sort-suit',true);await waitReady();
    await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='试试滑动选牌');await page.locator('[data-novice-gesture][data-mode="sweep"]:visible').waitFor();
    const before=await page.evaluate(()=>window.__harness.game.registry.get('runController').state);await page.locator('[data-novice-guide-skip]').tap();await waitScene(page,'character-select');
    assert.equal(await page.locator('[data-novice-gesture]').count(),0,'skip removes the active swipe demonstration');assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController').state.runId),before.runId,'skip preserves the tutorial save');
    assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController').state.commandSeq),before.commandSeq,'skip submits no game command');
    await tapUI(page,'character-select','character/amo',true);await confirmHeroRoute(page,true,'group');await enterOpeningShop(page,true);await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
    const ordinary=await page.evaluate(()=>window.__harness.game.registry.get('runController').state);assert.equal(ordinary.mode,'standard');assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0);await page.screenshot({path:join(dir,'01-skipped-normal-shop.png')});
    await page.reload();await waitScene(page,'title');await tapUI(page,'title','action/title-continue',true);await waitScene(page,'shop');assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController').state.runId),ordinary.runId);assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0);assert.equal(await page.locator('[data-novice-gesture]').count(),0);row.checks.push('skipping during an active demonstration removes it and enters a standard run; refresh does not start the lesson');
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);await page.screenshot({path:join(dir,'failure.png')}).catch(()=>{});process.exitCode=1;}
  finally{const video=page.video();await context.close();if(video){const source=await video.path(),target=join(dir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}

  const legacyDir=join(out,'legacy-import');await mkdir(legacyDir,{recursive:true});
  const legacyContext=await browser.newContext({viewport:{width:390,height:740},hasTouch:true,isMobile:true,deviceScaleFactor:1,recordVideo:{dir:legacyDir,size:{width:390,height:740}}}),p=await legacyContext.newPage();
  const legacyRow={name:'legacy-import',checks:[],errors:[],status:'RUNNING'};report.cases.push(legacyRow);p.setDefaultTimeout(30000);p.on('pageerror',error=>legacyRow.errors.push(String(error.stack??error)));
  try{
    const fixture=JSON.parse(await readFile(join(root,'tests/fixtures/r2-v10-amo-checkpoints.json'),'utf8')).before;
    await p.route('**/__legacy-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Prior checkpoint</title>'}));await p.goto(`http://127.0.0.1:${port}/__legacy-bootstrap`);
    await p.evaluate(async fixture=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,fixture,null);},fixture);
    await p.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(p,'title');await tapUI(p,'title','action/title-continue',true);
    await waitScene(p,'game');await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').ready);const imported=await p.evaluate(()=>({state:window.__harness.game.registry.get('runController').state,journal:window.__harness.game.registry.get('runController').journal}));
    assert.deepEqual(imported.state,fixture.state);assert.equal(await p.locator('[data-novice-guide-panel]:visible').count(),0,'old standard save never receives the new lesson');await p.screenshot({path:join(legacyDir,'01-continued.png')});
    await p.reload();await waitScene(p,'title');await tapUI(p,'title','action/title-continue',true);await waitScene(p,'game');await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').ready);
    assert.deepEqual(await p.evaluate(()=>({state:window.__harness.game.registry.get('runController').state,journal:window.__harness.game.registry.get('runController').journal})),imported);assert.equal(await p.locator('[data-novice-guide-panel]:visible').count(),0);await p.screenshot({path:join(legacyDir,'02-restored.png')});
    assert.deepEqual(legacyRow.errors,[]);legacyRow.status='PASS';legacyRow.checks.push('unmodified frozen v10 checkpoint preloaded as prior save continues and restores unchanged, with no novice lesson');
  }catch(error){legacyRow.status='FAIL';legacyRow.error=String(error.stack??error);await p.screenshot({path:join(legacyDir,'failure.png')}).catch(()=>{});process.exitCode=1;}
  finally{const video=p.video();await legacyContext.close();if(video){const source=await video.path(),target=join(legacyDir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  if(row.status!=='FAIL'){assert.deepEqual(row.errors,[]);row.status='PASS';}
}

try{if(process.env.NOVICE_LESSON_RETURNING_ONLY!=='1')for(const spec of cases)await scenario(spec);if(!process.env.NOVICE_LESSON_CASE||process.env.NOVICE_LESSON_RETURNING==='1'||process.env.NOVICE_LESSON_RETURNING_ONLY==='1')await returningScenarios();}
finally{await browser.close();await server.close();report.sourceAfter=await sourceFingerprint();if(report.sourceAfter!==report.sourceBefore){report.sourceChangedDuringRun=true;process.exitCode=1;}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
if(report.cases.some(row=>row.status!=='PASS'))process.exitCode=1;
