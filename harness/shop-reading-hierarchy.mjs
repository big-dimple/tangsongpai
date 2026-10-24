/** Shop-only, natural stock and real browser input. No deployment or state injection. */
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {chooseCharacter,tapUI,waitScene,point} from './ui.mjs';

const label=process.env.SHOP_REVIEW_LABEL??'before';
assert.ok(/^[a-z0-9-]+$/.test(label));
const out='docs/production/evidence/shop-reading-hierarchy-2026-10-21/'+label;
await mkdir(out,{recursive:true});
const report={label,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),seed:'group-natural-17',scope:'Local Chromium, real mouse/touch input, natural new game; software rendering only. Normal motion continuous videos, no animation claim from screenshots.',cases:[],status:'RUNNING'};
const server=await createServer({mode:'e2e',cacheDir:'/tmp/shop-reading-vite',server:{host:'127.0.0.1',port:5754,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {r2PurchasePrice}=await server.ssrLoadModule('/src/domain/r2Shop.ts');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});report.browser=browser.version();let active;
try{for(const viewport of [{width:1366,height:900},{width:390,height:844}]){
 const touch=viewport.width===390,ctx=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:1,recordVideo:{dir:out+'/videos',size:viewport}}),p=await ctx.newPage();active=p;p.setDefaultTimeout(15000);
 const row={viewport,touch,steps:[],errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));
 const dom=l=>touch?l.tap():l.click(),tap=(id)=>tapUI(p,'shop',id,touch);
 const snap=()=>p.evaluate(async()=>{const {gameSession}=await import('/src/game/session.ts'),c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await gameSession().storage.read()};});
 const settle=()=>p.waitForFunction(()=>{const g=window.__harness.game,c=g.registry.get('runController');return c?.status==='idle'&&g.scene.isActive('shop')&&g.scene.getScene('shop').ready;});
 const shot=async name=>{await p.mouse.move(0,0);await p.waitForTimeout(350);const file=viewport.width+'-'+name+'.png';await p.screenshot({path:out+'/'+file,scale:'css'});return file;};
 const unchanged=async(before,note)=>{assert.deepEqual(await snap(),before,note);row.steps.push({note,unchanged:true});};
 const command=async(before,actions,note)=>{await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq,before.state.commandSeq+actions.length);const after=await snap(),added=after.journal.slice(before.journal.length);assert.equal(added.length,actions.length);let expected=before.state;for(let i=0;i<actions.length;i++){assert.deepEqual(added[i].action,actions[i]);const r=applyCommand(expected,added[i]);assert.ok(r.ok);expected=r.state;}assert.deepEqual(after.state,expected);assert.deepEqual(after.storage.current.state,after.state);assert.deepEqual(after.storage.current.journal,after.journal);row.steps.push({note,actions,before,after});return after;};
 const close=()=>dom(p.locator('.detail-dialog[open] .dialog-close'));
 const geometry=()=>p.evaluate(()=>{const host=document.querySelector('.shop-mobile-offers'),r=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};},s=window.__harness.game.scene.getScene('shop'),texts=[];const walk=xs=>{for(const o of xs){if(o.name?.startsWith('shop/offer-'))texts.push({name:o.name,text:o.text,offerId:o.getData?.('offerId'),bounds:o.getBounds?.(),color:o.style?.color,fontSize:o.style?.fontSize});if(o.list)walk(o.list);}};walk(s.children.list);return {layout:s.geometry(),host:host?r(host):null,rows:host?[...host.querySelectorAll('.shop-mobile-offer')].map(a=>({id:a.dataset.offerId,bounds:r(a),image:r(a.querySelector('img')),copy:r(a.querySelector('.shop-mobile-offer-copy')),name:a.querySelector('strong').textContent,summary:a.querySelector('.shop-mobile-offer-summary').textContent,price:a.querySelector('.shop-mobile-offer-price').textContent,priceColor:getComputedStyle(a.querySelector('.shop-mobile-offer-price')).color})):[],texts};});
 await p.goto('http://127.0.0.1:5754/?harness=1&seed=group-natural-17',{timeout:120000});await chooseCharacter(p,'amo',touch);await settle();await p.waitForTimeout(1800);let s=await snap();row.initial=s;row.initialGeometry=await geometry();row.initialShot=await shot('initial');
 const offer=s.state.shop.offers.find(o=>r2PurchasePrice(s.state,o)<=s.state.gold&&!s.state.jokers.some(j=>j.definitionId===o.definitionId));assert.ok(offer,'natural affordable stock');
 await tap('offer/'+offer.offerId);await p.locator('.shop-joker-purchase[open]').waitFor();row.detail=await shot('detail');row.detailText=await p.locator('.shop-joker-purchase[open]').innerText();await unchanged(s,'affordable detail is read only');await close();await unchanged(s,'cancel affordable quote preserves exact state/storage');row.selected=await shot('selected');
 await tap('offer/'+offer.offerId);const buy=p.getByRole('button',{name:/^购买 · \d+ 金$/});const box=await buy.boundingBox();for(let n=0;n<2;n++){if(touch)await p.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);else await p.mouse.click(box.x+box.width/2,box.y+box.height/2);}
 s=await command(s,[{type:'BuyOffer',offerId:offer.offerId}],'repeated purchase confirmation commits exactly once at actual quoted price');await settle();await p.waitForTimeout(1600);row.purchased=await shot('purchased');row.purchasedGeometry=await geometry();assert.equal(s.state.gold,row.initial.state.gold-r2PurchasePrice(row.initial.state,offer));
 const poor=s.state.shop.offers.find(o=>!o.consumed&&r2PurchasePrice(s.state,o)>s.state.gold);assert.ok(poor,'natural unaffordable stock');
 await tap('offer/'+poor.offerId);await p.locator('.shop-joker-purchase[open]').waitFor();const unavailable=p.getByRole('button',{name:/^购买 · \d+ 金$/});assert.ok(await unavailable.isDisabled());row.unaffordable=await shot('unaffordable');await unchanged(s,'unaffordable detail does not spend or dispatch');await close();await unchanged(s,'cancel unaffordable detail preserves exact state/storage');
 // Check the approved expanded tool group and its order without buying or using anything.
 await tap('action/shelf-workshop');await p.waitForTimeout(600);row.workshop=await shot('workshop');row.workshopText=await p.locator('.shop-inline-workshop,.shop-workshop[open]').innerText();await unchanged(s,'workshop inspection does not buy or use tools');
 if(await p.locator('.detail-dialog[open]').count())await close();await tap('action/shelf-jokers');await settle();
 const start=await point(p,'shop','action/start-stage');for(let n=0;n<2;n++){if(touch)await p.touchscreen.tap(start.x,start.y);else await p.mouse.click(start.x,start.y);}
 await waitScene(p,'game');s=await command(s,[{type:'LeaveShop'}],'repeated enter input leaves shop exactly once');row.enter=await shot('enter');await dom(p.getByRole('button',{name:'进入暖场 ›',exact:true}));s=await command(s,[{type:'EnterStage'}],'explicit stage confirmation once');await p.waitForTimeout(1800);row.table=await shot('table');row.final=s;
 assert.deepEqual(row.errors,[]);row.video='videos/'+path.basename(await p.video().path());row.status='PASS';await ctx.close();active=undefined;console.log(viewport.width,'PASS');
}report.status='PASS';}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;console.error(e);if(active){await active.screenshot({path:out+'/FAIL.png'}).catch(()=>{});report.diagnostic=await active.evaluate(()=>({dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({class:d.className,text:d.innerText})),scenes:window.__harness?.game.scene.getScenes(true).map(s=>s.scene.key)})).catch(()=>null);}}
finally{await browser.close();await server.close();await writeFile(out+'/full-state.json.gz',gzipSync(JSON.stringify(report)));await writeFile(out+'/report.json',JSON.stringify({...report,cases:report.cases.map(r=>({...r,initial:r.initial?{gold:r.initial.state.gold,seq:r.initial.state.commandSeq,offers:r.initial.state.shop.offers}:null,final:r.final?{gold:r.final.state.gold,seq:r.final.state.commandSeq}:null,steps:r.steps.map(s=>({...s,before:s.before?{gold:s.before.state.gold,seq:s.before.state.commandSeq}:undefined,after:s.after?{gold:s.after.state.gold,seq:s.after.state.commandSeq}:undefined}))}))},null,2)+'\n');console.log(report.status,out);}
