import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {waitScene,tapUI,openSelector,confirmHeroRoute} from './ui.mjs';
const out='docs/production/evidence/q2-growth-2026-10-21/plain-language';await mkdir(out,{recursive:true});
const cache=await mkdtemp(path.join(tmpdir(),'q2-decision-vite-'));
const server=await createServer({mode:'e2e',cacheDir:cache,server:{host:'127.0.0.1',port:5746,strictPort:true},logLevel:'error'});await server.listen();
const {applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {r2PurchasePrice}=await server.ssrLoadModule('/src/domain/r2Shop.ts');
const files=['src/game/JokerGrowthDecisionCopy.ts','src/game/JokerPlainCopy.ts','src/game/ShopDecisionCopy.ts','src/game/ShopScene.ts','src/game/GameScene.ts'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const report={status:'RUNNING',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHashes:await hashes(),scope:'Ordinary menu launch and fixed prior seeds; actual pre-purchase view/cancel, one native BuyOffer, owned first-layer view/cancel. No injected checkpoint, no plays, no seed search or acquisition-rate claim.',cases:[]};
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});report.browser=browser.version();let active;
const snap=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function ready(p){await waitScene(p,'shop');await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);await p.evaluate(()=>document.fonts.ready);}
async function view(p,spec,phase,key,touch){
 const before=await snap(p),d=p.locator('.detail-dialog[open]');await d.waitFor();const a=d.locator('.card-ability');await a.scrollIntoViewIfNeeded();
 const main=await a.locator('.ability-main').innerText(),limits=await a.locator('.ability-limits').innerText(),status=await a.locator('small').innerText();
 for(const text of spec.expected)assert.ok(main.includes(text),text);assert.ok(limits.includes('搭配：'));assert.ok(limits.includes(spec.tip));assert.ok(limits.includes(spec.cap));
 assert.ok(!/成长\+\d+顶|每手|整手|保存事件|实例|必胜/.test(main+'\n'+limits+'\n'+status));
 assert.ok(status.includes(phase==='before'?'从+0':'当前已攒'));assert.ok(!await d.locator('.card-rules[open]').count(),'Rules were not expanded');assert.equal(await a.evaluate(a=>!!a.closest('details')),false,'Tips are outside every disclosure');
 const geometry=await a.evaluate(a=>{const r=a.getBoundingClientRect(),s=a.closest('.dialog-scroll'),b=s.getBoundingClientRect(),limits=a.querySelector('.ability-limits'),range=document.createRange();range.selectNodeContents(limits);const text=range.getBoundingClientRect();return{ability:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},scroll:{x:b.x,y:b.y,right:b.right,bottom:b.bottom},scrollWidth:s.scrollWidth,clientWidth:s.clientWidth,tips:{x:text.x,y:text.y,right:text.right,bottom:text.bottom}};});
 assert.ok(geometry.scrollWidth<=geometry.clientWidth+1);assert.ok(geometry.tips.x>=geometry.scroll.x-1&&geometry.tips.right<=geometry.scroll.right+1&&geometry.tips.y>=geometry.scroll.y-1&&geometry.tips.bottom<=geometry.scroll.bottom+1,'main-layer Tips visible after normal scroll');
 const screenshot=key+'-'+phase+'.png';await p.screenshot({path:out+'/'+screenshot,scale:'css'});assert.deepEqual(await snap(p),before);
 const close=d.locator('.dialog-close');if(touch)await close.tap();else await close.click();await d.waitFor({state:'detached'});assert.deepEqual(await snap(p),before,'detail cancel does not consume or save');
 return{main,limits,status,geometry,screenshot,cancelUnchanged:true,snapshotHash:digest(before)};
}
try{
 if(process.env.Q2_DECISION_REUSE_DESKTOP){const prior=JSON.parse(await readFile(process.env.Q2_DECISION_REUSE_DESKTOP,'utf8'));assert.deepEqual(prior.sourceHashes,report.sourceHashes);const passed=prior.cases.filter(c=>c.viewport.width===1366&&c.status==='PASS');assert.equal(passed.length,2);report.cases.push(...passed);report.reusedDesktopFrom=process.env.Q2_DECISION_REUSE_DESKTOP;}
 for(const viewport of (process.env.Q2_DECISION_REUSE_DESKTOP?[{width:390,height:844}]:[{width:1366,height:900},{width:390,height:844}]))for(const spec of [{id:'c04',route:'straight',seed:'policy-valid-groups',expected:['顺子或同花顺热度+50','攒+10热度','下次出牌起任意牌型都能用'],tip:'改点工具',cap:'最多攒+100热度'},{id:'c06',route:'flush',seed:'policy-valid-suit',expected:['同花牌型后','攒+0.5倍率','下次出牌起任意牌型都能用'],tip:'染色工具',cap:'最多攒+6倍率'}]){
  const touch=viewport.width<700,context=await browser.newContext({viewport,hasTouch:touch,deviceScaleFactor:touch?2:1}),p=await context.newPage();active=p;p.setDefaultTimeout(30000);const row={key:viewport.width+'-'+spec.id,viewport,...spec,errors:[]};report.cases.push(row);p.on('pageerror',e=>row.errors.push(String(e)));
  await p.goto('http://127.0.0.1:5746/?harness=1&seed='+spec.seed,{waitUntil:'domcontentloaded'});await waitScene(p,'title');await openSelector(p,touch);await tapUI(p,'character-select','character/erxiang',touch);await confirmHeroRoute(p,touch,spec.route);await ready(p);await p.waitForTimeout(500);
  const before=await snap(p),offer=before.state.shop.offers.find(o=>o.definitionId===spec.id&&!o.consumed);assert.ok(offer,'ordinary starter offer');row.offer=offer;assert.equal(before.state.gold,6);
  await tapUI(p,'shop','offer/'+offer.offerId,touch);row.before=await view(p,spec,'before',row.key,touch);assert.deepEqual(await snap(p),before);
  await tapUI(p,'shop','offer/'+offer.offerId,touch);const buy=p.getByRole('button',{name:/^购买 · \d+ 金$/});if(touch)await buy.tap();else await buy.click();await p.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq===seq+1,before.state.commandSeq);await p.locator('.shop-joker-purchase[open]').waitFor({state:'detached'});await ready(p);
  const after=await snap(p),commands=after.journal.slice(before.journal.length);assert.equal(commands.length,1);assert.equal(commands[0].action.type,'BuyOffer');const result=applyCommand(before.state,commands[0]);assert.ok(result.ok,result.code);assert.deepEqual(after.state,result.state);const price=r2PurchasePrice(before.state,offer);assert.equal(after.state.gold,before.state.gold-price);row.purchase={command:commands[0],paid:price,goldBefore:before.state.gold,goldAfter:after.state.gold,completeDomainStateEqual:true};
  const held=after.state.jokers.find(j=>j.definitionId===spec.id);if(touch){await tapUI(p,'shop','action/build',true);await p.getByRole('button',{name:'查看新牌',exact:true}).tap();row.afterPath='购物结果→查看新牌';}else {await tapUI(p,'shop','joker/'+held.instanceId,false);row.afterPath='点持有牌';}
  row.after=await view(p,spec,'after',row.key,touch);assert.deepEqual(await snap(p),after);assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',row.key);await context.close();active=undefined;
 }
 assert.deepEqual(await hashes(),report.sourceHashes);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;console.error(error);if(active)await active.screenshot({path:out+'/FAIL-'+Date.now()+'.png'}).catch(()=>{});}
finally{await writeFile(out+'/'+(report.status==='FAIL'?'FAIL-'+Date.now():'report')+'.json',JSON.stringify(report,null,2)+'\n');await browser.close();await server.close();await rm(cache,{recursive:true,force:true});console.log(report.status);}
