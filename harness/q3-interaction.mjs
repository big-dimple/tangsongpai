/** Bounded natural UI journey plus explicitly labeled storage fault. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {chooseCharacter,tapUI,point,waitScene,openRunMenu} from './ui.mjs';
const out=process.env.Q3_OUT??'docs/production/evidence/q3-interaction-2026-10-21/review-01';
await mkdir(out,{recursive:true});
const sourceHash=async()=>{const h=createHash('sha256');for(const f of [...execFileSync('git',['ls-files','-z','src'],{encoding:'utf8'}).split('\0').filter(Boolean),'harness/q3-interaction.mjs']){h.update(f+'\0');h.update(await readFile(f));}return h.digest('hex');};
const beforeHash=await sourceHash();
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),seed:'group-natural-17',sourceHash:beforeHash,scope:'Natural new run, real public UI only; no imported checkpoint or draw override. IDB failure is separately injected. Chromium software rendering, not physical phone or formal Q3 acceptance.',cases:[],status:'RUNNING'};
const server=await createServer({mode:'e2e',cacheDir:'/tmp/q3-vite',server:{host:'127.0.0.1',port:5753,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu','--disable-software-rasterizer']});report.browser=browser.version();let active;
try{for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
 const touch=viewport.width===390,ctx=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce',recordVideo:{dir:out+'/videos',size:viewport}}),p=await ctx.newPage();active=p;p.setDefaultTimeout(18000);const cdp=await ctx.newCDPSession(p),row={viewport,touch,steps:[],errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));p.on('dialog',d=>d.accept());
 const dom=l=>touch?l.tap():l.click(),tap=(scene,id)=>tapUI(p,scene,id,touch);
 const snap=()=>p.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts'),s=gameSession(),c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await s.storage.read()};});
 const draft=()=>p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return {selected:[...s.selectedIds],assist:[...s.assistIds],erxiang:s.erxiangTargetId,azao:s.azaoRelease,xiemu:s.xiemuBurn,amo:s.amoExile};});
 const settle=()=>p.waitForFunction(()=>{const g=window.__harness.game,c=g.registry.get('runController');if(c?.status!=='idle')return false;if(c.state.phase==='shop')return g.scene.isActive('shop')&&g.scene.getScene('shop').ready;if(['stage-cleared','run-lost','run-won'].includes(c.state.phase))return g.scene.isActive('intermission');const s=g.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));});
 const shot=async name=>{const file=viewport.width+'-'+name+'.png';await p.screenshot({path:out+'/'+file,scale:'css'});return file;};
 const unchanged=async(before,note)=>{assert.deepEqual(await snap(),before,note);row.steps.push({note,unchanged:true});console.log(viewport.width,note);};
 const command=async(before,actions,note)=>{await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq,before.state.commandSeq+actions.length);await settle();const after=await snap();let expected=before.state;const added=after.journal.slice(before.journal.length);assert.equal(added.length,actions.length);for(let i=0;i<actions.length;i++){assert.deepEqual(added[i].action,actions[i]);const r=applyCommand(expected,added[i]);assert.ok(r.ok,JSON.stringify(r));expected=r.state;}assert.deepEqual(after.state,expected);assert.deepEqual(after.journal,[...before.journal,...added]);assert.deepEqual(after.storage.current.state,after.state);assert.deepEqual(after.storage.current.journal,after.journal);row.steps.push({note,actions,before,after});console.log(viewport.width,note,after.state.commandSeq);return after;};
 const close=()=>dom(p.locator('.detail-dialog[open] .dialog-close'));
 const hold=async pos=>{if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y,id:1}]});else{await p.mouse.move(pos.x,pos.y);await p.mouse.down();}await p.waitForTimeout(450);if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await p.mouse.up();await p.waitForTimeout(100);};
 await p.goto('http://127.0.0.1:5753/?harness=1&seed=group-natural-17',{timeout:120000});await chooseCharacter(p,'amo',touch);await settle();let s=await snap();row.initial=s;assert.equal(s.state.gold,6);assert.equal(s.state.openingRoute,'group');row.shop=await shot('natural-shop');
 if(s.state.program&&!s.state.program.choiceMade){await tap('shop','action/chapter');await dom(p.getByRole('button',{name:'本章不接',exact:true}));s=await command(s,[{type:'ChooseProgram',programId:null}],'decline optional program; leave budget intact');}
 const offer=s.state.shop.offers.find(o=>o.price<=s.state.gold);assert.ok(offer);
 await hold(await point(p,'shop','offer/'+offer.offerId));await p.locator('.detail-dialog[open]').waitFor();await unchanged(s,'long hold stock only inspects, no purchase');await close();await unchanged(s,'independent Cancel does not penetrate or spend');
 const tool=s.state.shop.toolOffers.find(o=>o.definitionId==='T06');assert.ok(tool&&tool.price<=s.state.gold);
 await tap('shop','action/shelf-tools');await tap('shop','offer/'+tool.offerId);
 const buyBox=await p.getByRole('button',{name:/^购买 · \d+ 金$/}).boundingBox();for(let n=0;n<2;n++){if(touch)await p.touchscreen.tap(buyBox.x+buyBox.width/2,buyBox.y+buyBox.height/2);else await p.mouse.click(buyBox.x+buyBox.width/2,buyBox.y+buyBox.height/2);}s=await command(s,[{type:'BuyOffer',offerId:tool.offerId}],'explicit natural tool purchase once');
 await p.locator('.tool-detail[open]').waitFor();await close();if(await p.locator('.detail-dialog[open]').count())await close();await unchanged(s,'cancel target selection keeps purchased unused tool');
 await tap('shop','action/start-stage');await waitScene(p,'game');await dom(p.getByRole('button',{name:'进入暖场 ›',exact:true}));s=await command(s,[{type:'LeaveShop'},{type:'EnterStage'}],'leave shop with remaining gold; confirm actual stage and deal');
 const id=s.state.handOrder[0];await hold(await point(p,'game','card/'+id));await p.locator('.detail-dialog[open]').waitFor();assert.deepEqual((await draft()).selected,[]);await unchanged(s,'long hold hand only inspects; no play');await close();await unchanged(s,'hand detail close no play or select');
 await tap('game','card/'+id);const originalDraft=await draft();await tap('game','hero/details');await p.locator('dialog[open]').waitFor();await close();assert.deepEqual(await draft(),originalDraft);await unchanged(s,'hero explanation/cancel preserves hand draft');
 const hand=s.state.handOrder.map(id=>s.state.deckInstances.find(c=>c.id===id));
 if(hand.some(c=>c.rank===13)&&hand.find(c=>c.id===id).rank!==13){
  await tap('game','hero/action-shortcut');const use=p.getByRole('button',{name:/^本手使用贬谪/});await use.waitFor();
  if(!await use.isDisabled()){
   await dom(use);assert.equal((await draft()).amo,true);await unchanged(s,'explicit skill draft has no resource cost');
   await tap('game','hero/action-shortcut');await dom(p.getByRole('button',{name:'取消本手贬谪',exact:true}));assert.equal((await draft()).amo,false);await unchanged(s,'cancel chosen skill has no resource cost');
   await tap('game','hero/action-shortcut');await dom(p.getByRole('button',{name:/^本手使用贬谪/}));
  }else{row.steps.push({note:'skill not currently available',status:'NOT_AVAILABLE'});await close();}
 }

 // Restore a deliberately unfinished hand draft through production Continue.
 await p.reload({timeout:120000});await waitScene(p,'title');assert.deepEqual(await snap(),s);await tap('title','action/title-continue');await waitScene(p,'game');await settle();assert.deepEqual((await draft()).selected,[]);assert.deepEqual((await draft()).assist,[]);assert.equal((await draft()).amo,false);await unchanged(s,'cold restore drops unsubmitted hand and skill draft');
 row.table=await shot('natural-table');
 // Open the naturally bought tool, select a current public target, cancel once.
 const held=s.state.consumables.find(c=>c.definitionId==='T06'),target=s.state.handOrder.find(id=>s.state.deckInstances.find(c=>c.id===id).suit!=='spades');assert.ok(held&&target);
 const toolOpen=async()=>{await tap('game','action/tool-inventory');await dom(p.locator('.tool-inventory-card[data-item-id="'+held.instanceId+'"]'));await p.locator('.tool-detail[open]').waitFor();};
 await toolOpen();await dom(p.getByLabel(target,{exact:true}));row.tool=await shot('tool-target-cancel');await close();await unchanged(s,'cancel actual tool target retains tool, gold, RNG and full storage');
 await toolOpen();await dom(p.getByLabel(target,{exact:true}));
 await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.__q3Writes=[];window.__q3Restore=()=>IDBObjectStore.prototype.put=put;IDBObjectStore.prototype.put=function(...args){if(this.name==='saves'){window.__q3Writes.push(structuredClone(args[0]));throw new DOMException('Q3 controlled quota fault','QuotaExceededError');}return Reflect.apply(put,this,args);};});
 const useBox=await p.getByRole('button',{name:'确认使用',exact:true}).boundingBox();for(let n=0;n<2;n++){if(touch)await p.touchscreen.tap(useBox.x+useBox.width/2,useBox.y+useBox.height/2);else await p.mouse.click(useBox.x+useBox.width/2,useBox.y+useBox.height/2);}
 await p.waitForFunction(()=>window.__harness.game.registry.get('runController').status==='paused');await unchanged(s,'controlled quota failure retains exact pre-use published tuple');row.failedWrites=await p.evaluate(()=>window.__q3Writes);assert.equal(row.failedWrites.length,1,'repeated confirmation only attempts one consumption');row.failure=await shot('save-failed');
 if(await p.locator('.detail-dialog[open]').count())await close();await p.evaluate(()=>window.__q3Restore());await openRunMenu(p,touch);await dom(p.getByRole('button',{name:'重试保存',exact:true}));
 s=await command(s,[{type:'UseConsumable',instanceId:held.instanceId,targetIds:[target]}],'retry exact failed use once, no recomputation or double consumption');assert.deepEqual(s.storage.current,row.failedWrites[0].current);assert.deepEqual(s.storage.previous,row.failedWrites[0].previous);assert.equal(s.state.consumables.some(c=>c.instanceId===held.instanceId),false);assert.equal(s.state.deckInstances.find(c=>c.id===target).suit,'spades');row.savedTool=await shot('tool-saved-after-retry');
 // Bounded four hands maximum: choose using the existing public-hand helper, never future draws.
 for(let turn=0;turn<4&&s.state.phase==='await-input';turn++){
  await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').aiButton.input.enabled);await tap('game','selection/switch-type');let chosen=await draft();assert.ok(chosen.selected.length);
  const shortcut=await p.evaluate(()=>!!window.__harness.game.scene.getScene('game').heroActionButton?.input?.enabled);
  if(shortcut&&!chosen.amo){await tap('game','hero/action-shortcut');const use=p.getByRole('button',{name:/^本手使用贬谪/});if(await use.count()&&!await use.isDisabled())await dom(use);else if(await p.locator('.detail-dialog[open]').count())await close();chosen=await draft();}
  await unchanged(s,'hand and skill selection only preview');row.steps.push({note:'public hand selection',turn,draft:chosen});
  if(turn===0){row.selected=await shot('ready-to-play');
   const q=await point(p,'game','action/play');
   if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:q.x,y:q.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:q.x,y:q.y-90,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
   else{await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.move(q.x,q.y-90,{steps:4});await p.mouse.up();}
   await p.waitForTimeout(100);assert.deepEqual(await draft(),chosen);await unchanged(s,'drag off Play cancels without spending or changing draft');
   if(touch){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:q.x,y:q.y,id:1}]});await p.waitForTimeout(40);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await p.waitForTimeout(100);assert.deepEqual(await draft(),chosen);await unchanged(s,'native touchCancel on Play does not dispatch or queue a hand');}
  }
  const playAt=await point(p,'game','action/play');for(let n=0;n<2;n++){if(touch)await p.touchscreen.tap(playAt.x,playAt.y);else await p.mouse.click(playAt.x,playAt.y);}if(await p.getByRole('button',{name:'继续出牌',exact:true}).count())await dom(p.getByRole('button',{name:'继续出牌',exact:true}));
  s=await command(s,[{type:'PlayHand',selectedIds:chosen.selected,...(chosen.amo?{amoExile:true}:{})}],'actual play '+(turn+1)+' commits and resolves once');
 }
 assert.ok(['stage-cleared','run-lost'].includes(s.state.phase),'bounded result reached');row.result=await shot('actual-result');row.outcome={phase:s.state.phase,heat:s.state.stage.heat,target:s.state.stage.targetHeat};
 await tap('intermission',s.state.phase==='stage-cleared'?'action/result-details':'action/failure-guidance');await p.locator('.detail-dialog[open]').waitFor();await close();await unchanged(s,'result detail return is read-only');
 // Cold result restore, then the real continuation when cleared.
 await p.reload({timeout:120000});await waitScene(p,'title');assert.deepEqual(await snap(),s);await tap('title','action/title-continue');await waitScene(p,'intermission');await unchanged(s,'cold result Continue restores exact committed result');
 if(s.state.phase==='stage-cleared'){await tap('intermission','action/continue-stage');s=await command(s,[{type:'OpenShop'}],'explicit continue reaches next shop');await p.reload({timeout:120000});await waitScene(p,'title');await tap('title','action/title-continue');await waitScene(p,'shop');await settle();await unchanged(s,'next shop cold restore exact');row.continue=await shot('continued-shop');}else row.steps.push({note:'next shop continuation unavailable after actual loss; result restore covered',status:'NOT_AVAILABLE'});
 row.final=s;

 row.available=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),all=[];const walk=xs=>{for(const o of xs){if(o.input?.enabled)all.push({name:o.name,label:o.getData?.('label')?.text});if(o.list)walk(o.list);}};walk(s.children.list);return all;});
 row.video='videos/'+path.basename(await p.video().path());row.status='PASS';assert.deepEqual(row.errors,[]);await ctx.close();active=undefined;console.log(viewport.width,row.status);
}assert.equal(await sourceHash(),beforeHash,'source unchanged during browser run');report.status='PASS';}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;if(active){await active.screenshot({path:out+'/FAIL.png',scale:'css'}).catch(()=>{});report.diagnostic=await active.evaluate(()=>({scenes:window.__harness?.game.scene.getScenes(true).map(s=>({key:s.scene.key,ready:s.ready})),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({classes:d.className,text:d.innerText}))})).catch(()=>null);}console.error(e);}
finally{await browser.close();await server.close();await writeFile(out+'/full-state.json.gz',gzipSync(JSON.stringify(report)));await writeFile(out+'/report.json',JSON.stringify({...report,cases:report.cases.map(r=>({...r,failedWrites:r.failedWrites?.map(w=>({seq:w.current?.state.commandSeq,revision:w.revision})),final:r.final?{seq:r.final.state.commandSeq,gold:r.final.state.gold,phase:r.final.state.phase}:undefined,initial:{seq:r.initial?.state.commandSeq,gold:r.initial?.state.gold},steps:r.steps.map(s=>({...s,before:s.before?{seq:s.before.state.commandSeq,gold:s.before.state.gold}:undefined,after:s.after?{seq:s.after.state.commandSeq,gold:s.after.state.gold,phase:s.after.state.phase}:undefined}))}))},null,2)+'\n');console.log(report.status,out);}
