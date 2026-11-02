/** Real-input tutorial regression and visual evidence; no controller dispatches. */
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,symlink,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createServer} from 'vite';
import {openMenuSection,openRunMenu,point,tapUI,waitScene} from './ui.mjs';

const out=resolve(process.env.NOVICE_INTERACTION_OUT??'shots/novice-interaction');await mkdir(out,{recursive:true});
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('/usr/bin/ffmpeg')){
 const dir=await mkdtemp(join(tmpdir(),'tsp-novice-video-')),manifest=JSON.parse(await readFile(join(dirname(require.resolve('playwright-core/package.json')),'browsers.json'),'utf8'));
 const revision=manifest.browsers.find(row=>row.name==='ffmpeg').revision;await mkdir(join(dir,`ffmpeg-${revision}`));await symlink('/usr/bin/ffmpeg',join(dir,`ffmpeg-${revision}`,'ffmpeg-linux'));process.env.PLAYWRIGHT_BROWSERS_PATH=dir;
}
const {chromium}=await import('playwright');
const port=Number(process.env.NOVICE_INTERACTION_PORT??5786),server=await createServer({mode:'e2e',cacheDir:`/tmp/tsp-novice-interaction-${port}`,optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const cases=[{name:'phone390',width:390,height:740,touch:true},{name:'short320',width:320,height:568,touch:true},{name:'desktop',width:1366,height:768,touch:false}].filter(s=>(process.env.NOVICE_INTERACTION_CASE??'phone390,short320,desktop').split(',').includes(s.name));
const report={scope:'Real browser UI inputs and saved commands in a fresh guided run; emulated phone/desktop, no physical device or human comprehension test.',cases:[]};
const overlap=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
try {for(const spec of cases){
 const dir=join(out,spec.name);await mkdir(dir,{recursive:true});const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,recordVideo:{dir,size:{width:spec.width,height:spec.height}}});const page=await context.newPage(),cdp=spec.touch?await context.newCDPSession(page):undefined,row={...spec,steps:[],errors:[]};report.cases.push(row);page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error)));
 const state=()=>page.evaluate(()=>window.__harness.game.registry.get('runController')?.state);
 const journal=()=>page.evaluate(()=>window.__harness.game.registry.get('runController')?.journal);
 const waitReady=()=>page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));},null,{timeout:30000});
 const guide=async step=>{await page.waitForFunction(s=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep===s,step,{timeout:30000});await page.locator('[data-novice-guide-panel]:visible').waitFor();};
 const measure=()=>page.evaluate(()=>{
  const g=window.__harness.game,s=g.scene.getScene('game'),p=document.querySelector('[data-novice-guide-panel]'),b=p.getBoundingClientRect(),l=s.view?.layout,c=g.canvas.getBoundingClientRect(),sx=l?c.width/l.width:1,sy=l?c.height/l.height:1;
  const box=x=>x&&({x:c.left+x.x*sx,y:c.top+x.y*sy,width:x.width*sx,height:x.height*sy});
  const protectedBoxes=s.scene.isActive()&&l?[l.hud,l.scoreBoard,l.playedArea,l.hand,l.actions,l.heroAction,l.inventoryEntry,l.helpEntry,...s.run.jokers.map((_,i)=>l.slots[i])].filter(Boolean).map(box):[];
  const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].map(x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}});
  const cards=s.scene.isActive()&&l?['clubs-5','hearts-5'].flatMap(id=>{const i=s.hand.findIndex(c=>c.id===id),v=s.cardViews[i],seat=l.cards[i];if(!v||!seat?.visible)return[];const w=Number(v.container.getData('width')),h=Number(v.container.getData('height')),m=v.container.getWorldTransformMatrix(),a=m.transformPoint(-w/2,-h/2),z=m.transformPoint(w/2,h/2);return [{id,...box({x:a.x,y:a.y,width:Math.min(z.x-a.x,seat.hit.width),height:z.y-a.y})}];}):[];
  return {title:p.querySelector('.novice-guide-title')?.textContent,body:p.querySelector('.novice-guide-body')?.textContent,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,panel:{x:b.x,y:b.y,width:b.width,height:b.height},protectedBoxes,rings,cards};
 });
 const capture=async(name,check=true)=>{const info=await measure();if(check){assert.ok(info.scrollHeight<=info.clientHeight+1,`${name}: guide must not need internal scrolling: ${JSON.stringify(info)}`);for(const b of info.protectedBoxes)assert.ok(!overlap(info.panel,b),`${name}: guide covers live table: ${JSON.stringify({panel:info.panel,b})}`);}await page.screenshot({path:join(dir,name+'.png')});row.steps.push({name,...info});console.log(spec.name,name,info.title,info.body);return info;};
 const click=async locator=>spec.touch?locator.tap():locator.click();
 const tapResult=async name=>{
  for(let attempt=0;attempt<8;attempt++){
   const p=await point(page,'intermission',name),v=await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('intermission'),r=g.canvas.getBoundingClientRect(),v=s.resultContent.getData('viewport');return {top:r.top+v.top*r.height/s.view.layout.height,bottom:r.top+v.bottom*r.height/s.view.layout.height};});
   if(p.y>=v.top&&p.y<=v.bottom){await tapUI(page,'intermission',name,spec.touch);return;}
   await page.mouse.move(spec.width/2,(v.top+v.bottom)/2);await page.mouse.wheel(0,p.y<v.top?-300:300);await page.waitForTimeout(150);
  }
  throw Error('result action did not scroll into the visible viewport');
 };
 const settleAfterAction=async before=>{await page.waitForFunction(seq=>window.__harness.game.registry.get('runController')?.state.commandSeq>seq,before.commandSeq,{timeout:30000});await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation;},null,{timeout:30000});};
 const select=async ids=>{for(const id of ids)await tapUI(page,'game','card/'+id,spec.touch);};
 const selected=()=>page.evaluate(()=>[...window.__harness.game.scene.getScene('game').selectedIds]);
 const waitSelection=ids=>page.waitForFunction(wanted=>{const actual=[...window.__harness.game.scene.getScene('game').selectedIds].sort();return JSON.stringify(actual)===JSON.stringify([...wanted].sort());},ids);
 const observeSweep=()=>page.evaluate(()=>{
  const g=window.__harness.game,s=g.scene.getScene('game'),l=s.view.layout,c=g.canvas.getBoundingClientRect(),sx=c.width/l.width,sy=c.height/l.height;
  const cards=s.hand.flatMap((card,i)=>{const v=s.cardViews[i],seat=l.cards[i];if(!v?.container.active||!v.container.visible||!seat?.visible)return[];const w=Number(v.container.getData('width')),h=Number(v.container.getData('height')),m=v.container.getWorldTransformMatrix(),a=m.transformPoint(-w/2,-h/2),b=m.transformPoint(w/2,h/2);return[{id:card.id,suit:card.suit,x:c.left+a.x*sx,y:c.top+a.y*sy,width:Math.min(b.x-a.x,seat.hit.width)*sx,height:(b.y-a.y)*sy}];});
  const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});return{cards,rings};
 });
 const play=async ids=>{await waitReady();const before=await state();await select(ids);await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);const after=await state();if(after.phase==='await-input')await waitReady();return after;};
 const discard=async(ids,name='04-discard-selected')=>{await waitReady();const before=await state();await select(ids);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='已选好'||['skill','payoff'].includes(document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep));await capture(name);await tapUI(page,'game','action/discard',spec.touch);await settleAfterAction(before);return state();};
 const findPair=run=>{const groups=new Map();for(const id of run.handOrder){const rank=run.deckInstances.find(card=>card.id===id).rank;groups.set(rank,[...(groups.get(rank)??[]),id]);}return [...groups.values()].find(ids=>ids.length>=2)?.slice(0,2);};
 try {
  await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');await tapUI(page,'title','action/title-start',spec.touch);await waitScene(page,'game');await waitReady();await guide('pair');await capture('00-pair-start');assert.equal(await page.locator('[data-novice-guide-arrow]').count(),0,'the lesson does not use pointer arrows');
  if(!spec.touch){
   await page.locator('canvas').focus();await page.keyboard.press('Enter');const handDetail=page.locator('.poker-detail-dialog[open]');await handDetail.waitFor();
   await page.setViewportSize({width:500,height:757});await page.waitForTimeout(300);
   const rect=await handDetail.evaluate(el=>{const r=el.getBoundingClientRect(),b=el.querySelector('.dialog-close').getBoundingClientRect();return {dialog:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},close:{left:b.left,right:b.right,top:b.top,bottom:b.bottom},width:innerWidth,height:innerHeight};});
   await page.screenshot({path:join(dir,'00b-detail-resized.png')});row.resizedDetail=rect;
   assert.ok(rect.dialog.left>=0&&rect.dialog.right<=rect.width&&rect.close.left>=0&&rect.close.right<=rect.width,`open hand detail remains reachable on resize: ${JSON.stringify(rect)}`);
   await handDetail.getByRole('button',{name:'关闭',exact:true}).click();await page.setViewportSize({width:spec.width,height:spec.height});await waitReady();await guide('pair');
  }
  await tapUI(page,'game','card/clubs-5',spec.touch);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='再选另一张');await page.waitForTimeout(220);
  let one=await capture('01-one-selected');assert.equal(one.rings.length,1);const remaining=one.cards.find(c=>c.id==='hearts-5'),ring=one.rings[0];assert.ok(remaining&&Math.abs(ring.x-remaining.x)<2&&Math.abs(ring.y-remaining.y)<2,`one cue follows the other card: ${JSON.stringify({ring,remaining})}`);
  await tapUI(page,'game','card/clubs-5',spec.touch);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='先找一对');
  await tapUI(page,'game','card/clubs-4',spec.touch);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='再找一对');await capture('02-wrong-selection');await tapUI(page,'game','card/clubs-4',spec.touch);
  await tapUI(page,'game','action/sort-rank',spec.touch);await waitReady();
  for(let i=0;i<10;i++){const sample=await measure();if(sample.cards.slice(0,1).every(card=>sample.rings.some(r=>Math.abs(r.x-card.x)<2&&Math.abs(r.y-card.y)<2)))break;await page.waitForTimeout(20);}
  const sorted=await capture('02b-sorted');for(const card of sorted.cards.slice(0,1)){const ring=sorted.rings.find(r=>Math.abs(r.x-card.x)<2);assert.ok(ring&&Math.abs(ring.y-card.y)<2,'ring follows sorted cards');}
  await select(['clubs-5','hearts-5']);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='对子选好了');await capture('03-pair-ready');
  let before=await state();await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);let current=await state();assert.equal(current.lastTrace.handType,'pair');assert.equal(current.lastTrace.finalScore,'90');await guide('discard');const scoreFocus=await capture('03b-pair-score');
  const realScore=await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game'),b=s.heatText.getBounds(),r=g.canvas.getBoundingClientRect(),l=s.view.layout;return{x:r.left+b.x*r.width/l.width,y:r.top+b.y*r.height/l.height,width:b.width*r.width/l.width,height:b.height*r.height/l.height};});
  assert.ok(scoreFocus.rings.some(box=>overlap(box,realScore)),`score focus must frame the actual accumulated value: ${JSON.stringify({rings:scoreFocus.rings,realScore})}`);
  await page.waitForFunction(()=>document.querySelector('.novice-guide-body')?.textContent?.startsWith('累计 '));await capture('03bb-pair-goal');
  const saved={runId:current.runId,seq:current.commandSeq};await page.reload();await waitScene(page,'title');await tapUI(page,'title','action/title-continue',spec.touch);await waitScene(page,'game');await waitReady();await guide('discard');current=await state();assert.equal(current.runId,saved.runId);assert.equal(current.commandSeq,saved.seq);await capture('03c-restored');
  await discard(['clubs-4','diamonds-4']);await waitReady();await guide('independent');
  await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='先理牌');await capture('04b-sort-instruction');
  before=await state();await tapUI(page,'game','action/sort-suit',spec.touch);await waitReady();
  await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='试试滑动选牌');current=await state();
  assert.ok(current.commandSeq>before.commandSeq,'suit sorting saves a command');assert.equal((await journal()).at(-1).action.type,'ReorderHand');
  await capture('04c-swipe-instruction');const swipeView=await observeSweep();
  const sameBox=(a,b)=>Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;
  const endpoints=swipeView.cards.filter(card=>swipeView.rings.some(ring=>sameBox(ring,card)));
  assert.ok(endpoints.length>=2,`the swipe endpoints are highlighted: ${JSON.stringify(swipeView)}`);
  const positions=endpoints.map(card=>current.handOrder.indexOf(card.id)).sort((a,b)=>a-b),swept=current.handOrder.slice(positions[0],positions.at(-1)+1);
  assert.ok(swept.length>=2&&swept.length<=5,`the highlighted span contains 2–5 cards: ${JSON.stringify({endpoints,swept})}`);
  const sweepCards=swept.map(id=>swipeView.cards.find(card=>card.id===id));assert.ok(sweepCards.every(card=>card&&card.suit===sweepCards[0].suit),'the whole visible span has one suit');
  assert.deepEqual(await selected(),[],'the sort leaves no selected cards');
  const start=await point(page,'game','card/'+swept[0]),end=await point(page,'game','card/'+swept.at(-1));
  if(spec.touch){
   const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(({x,y})=>({x,y,id:1,radiusX:2,radiusY:2,force:1}))});
   await touch('touchStart',[start]);await touch('touchMove',[end]);assert.equal(await page.locator('.novice-guide-title').textContent(),'试试滑动选牌','the lesson waits for release');await touch('touchEnd',[]);
  }else{
   await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y);assert.equal(await page.locator('.novice-guide-title').textContent(),'试试滑动选牌','the lesson waits for release');await page.mouse.up();
  }
  await waitReady();await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent!=='试试滑动选牌');await waitSelection(swept);await capture('04d-swipe-complete');
  await select(swept);await waitSelection([]);await waitReady();row.sweep=swept;
  const independent=await capture('05-independent');assert.equal(independent.rings.length,0,'independent play does not choose a card for the player');
  const flush=page.locator('[data-novice-guide-choice="flush"]');await flush.waitFor({state:'visible'});const hearts=JSON.parse(await flush.getAttribute('data-card-ids'));current=await state();assert.equal(hearts.length,5);assert.ok(hearts.every(id=>current.handOrder.includes(id)&&id.startsWith('hearts-')),'the suggested flush uses five hearts in the real hand');await click(flush);await capture('05b-flush-choice');current=await play(hearts);assert.equal(current.lastTrace.handType,'flush');assert.equal(current.phase,'stage-cleared');await waitScene(page,'intermission');await guide('shop');await capture('06-win',false);
  await tapResult('action/continue-stage');await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);await guide('shop');await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached'});await capture('07-shop',false);
  const growthCopy=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]),offer=s.run.shop.offers.find(o=>o.definitionId==='f11'),text=walk(s.children.list).find(o=>o.name==='shop/offer-purpose'&&o.getData('offerId')===offer?.offerId),mobile=[...document.querySelectorAll('.shop-mobile-offer')].find(e=>e.innerText.includes('越战越勇'));return {text:text?.text,full:text?.getData('fullText'),mobile:mobile?.innerText,aria:window.__harness.game.canvas.getAttribute('aria-label')};});
  for(const copy of Object.values(growthCopy).filter(Boolean))assert.ok(!copy.includes('热度'),`visible/cached shop copy contains legacy term: ${JSON.stringify(growthCopy)}`);
  assert.ok(Object.values(growthCopy).some(copy=>copy?.includes('筹码')),'growth offer uses chips');row.growthCopy=growthCopy;
  current=await state();const offer=current.shop.offers.find(x=>x.definitionId==='b02'&&!x.consumed);assert.ok(offer);await tapUI(page,'shop','offer/'+offer.offerId,spec.touch);let dialog=page.locator('dialog[open]').last();await dialog.waitFor();assert.equal(await dialog.locator('.novice-focus-action').count(),1,'purchase confirmation has one visual cue');await click(dialog.getByRole('button',{name:'购买 · 4 金',exact:true}));await guide('payoff');await capture('08-bought',false);
  const rack=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),g=s.geometry();return{collapsed:g.inventoryCollapsed,slots:g.slots.length,owned:s.run.jokers.length};});
  assert.equal(rack.owned,1,'the real purchase added the first owned card');
  if(rack.collapsed){
   await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='展开已拥有牌');
   const arrow=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),walk=list=>{for(const o of list){if(o.name==='shop/owned-toggle-arrow')return o;if(o.list){const child=walk(o.list);if(child)return child;}}};return walk(s.children.list)?.getData('direction');});
   if(spec.touch)assert.equal(arrow,'up','the collapsed phone rack shows the up arrow');
   await tapUI(page,'shop','action/toggle-owned',spec.touch);
  }
  await page.waitForFunction(()=>{const g=window.__harness.game.scene.getScene('shop').geometry();return !g.inventoryCollapsed&&g.slots.length===5;});
  await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='这里有五个槽');await capture('08b-owned-open',false);
  await tapUI(page,'shop','action/start-stage',spec.touch);await waitScene(page,'game');await waitReady();assert.equal(await page.locator('.blind-select-dialog[open]').count(),0,'guided entry skips unrelated chapter selection');await guide('payoff');await capture('09-payoff-hand');
  let payoffPair;for(let attempt=0;attempt<4;attempt++){
   current=await state();payoffPair=findPair(current);if(payoffPair)break;assert.ok(current.stage.discardsLeft>0);await discard(current.handOrder.slice(0,5),'09a-payoff-discard');await guide('payoff');
  }assert.ok(payoffPair,'the real next-stage hand or replacement has a pair');
  current=await play(payoffPair);assert.ok(current.lastTrace.events.some(e=>e.sourceDefinitionId==='b02'&&e.operation==='add-multiplier'));await guide('skill');await capture('10-card-effect');
  let pair;for(let attempt=0;attempt<4;attempt++){
   current=await state();pair=findPair(current);if(pair)break;assert.ok(current.stage.discardsLeft>0);await discard(current.handOrder.slice(0,5),'11a-skill-discard');await guide('skill');await capture('11-skill-find-pair');
  }assert.ok(pair,'real replacement produced a pair');
  await waitReady();await select(pair);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='牌点可转为倍率');await capture('12-skill-ready');await tapUI(page,'game','hero/action-shortcut',spec.touch);dialog=page.locator('dialog[open]').last();await dialog.waitFor();assert.equal(await dialog.locator('.novice-focus-action').count(),1,'skill target has one visual cue');await page.screenshot({path:join(dir,'12b-skill-dialog.png')});current=await state();const index=current.handOrder.indexOf(pair[0])+1;let choice=dialog.getByRole('button',{name:new RegExp('^第'+index+'张 · ')});await click(choice);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='技能已选');await capture('13-skill-chosen');
  await tapUI(page,'game','hero/action-shortcut',spec.touch);dialog=page.locator('dialog[open]').last();await click(dialog.getByRole('button',{name:'取消技能',exact:true}));await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='牌点可转为倍率');
  await tapUI(page,'game','hero/action-shortcut',spec.touch);dialog=page.locator('dialog[open]').last();choice=dialog.getByRole('button',{name:new RegExp('^第'+index+'张 · ')});await click(choice);await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='技能已选');
  before=await state();await tapUI(page,'game','action/play',spec.touch);await settleAfterAction(before);current=await state();assert.ok(current.lastTrace.events.some(e=>e.reasonKey==='erxiang.handoff'));await guide('skill-practice');await capture('14-skill-result',current.phase==='await-input');
  if(current.phase==='stage-cleared'){
   await waitScene(page,'intermission');await tapResult('action/continue-stage');await waitScene(page,'game');await waitReady();await guide('skill-practice');
   assert.equal(await page.locator('.blind-select-dialog[open],.boss-preparation-dialog[open],.stage-identity-entry[open]').count(),0,'practice does not open shop or Boss briefing');
   current=await state();if(current.stage?.boss?.definitionId==='B01')assert.ok((await page.locator('.novice-guide-body').innerText()).includes('弃牌要用 2 次'),'the real first-hand discard cost remains visible');
  }
  current=await state();await play([current.handOrder[0]]);await guide('complete');await capture('15-complete',(await state()).phase==='await-input');assert.ok(await page.getByRole('button',{name:'开始普通游戏',exact:true}).isVisible());
  if(spec.touch&&spec.width===390){await page.setViewportSize({width:390,height:660});await page.waitForTimeout(250);await capture('16-shorter-viewport',(await state()).phase==='await-input');await page.setViewportSize({width:390,height:740});}
  current=await state();row.completed={runId:current.runId,commandSeq:current.commandSeq,journalLength:(await journal()).length};
  await click(page.getByRole('button',{name:'开始普通游戏',exact:true}));await waitScene(page,'character-select');assert.equal((await state()).runId,current.runId);
  await openRunMenu(page,spec.touch);await click(page.getByRole('button',{name:'继续游戏',exact:true}));await waitScene(page,'game');await waitReady();await guide('complete');
  await openMenuSection(page,'more',spec.touch);await click(page.getByRole('button',{name:'重玩新手教程',exact:true}));await waitScene(page,'game');await page.waitForFunction(id=>window.__harness.game.registry.get('runController')?.state.runId!==id,current.runId);await waitReady();await guide('pair');await capture('17-replay');
  const retry=await state();await click(page.locator('[data-novice-guide-skip]'));await waitScene(page,'character-select');assert.equal((await state()).runId,retry.runId);
  assert.deepEqual(row.errors,[]);row.status='PASS';row.replay={runId:retry.runId,commandSeq:retry.commandSeq};row.skip='preserves saved tutorial';
 }catch(error){row.status='FAIL';row.error=String(error.stack??error);console.error(spec.name,row.error);await page.screenshot({path:join(dir,'failure.png')}).catch(()=>{});}
 finally{await cdp?.detach();const video=page.video();await context.close();if(video){const source=await video.path(),target=join(dir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);}await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }}finally{await browser.close();await server.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
if(report.cases.some(r=>r.status!=='PASS'))process.exitCode=1;
