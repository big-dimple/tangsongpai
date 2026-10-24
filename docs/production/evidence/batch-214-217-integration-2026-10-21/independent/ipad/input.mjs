import assert from 'node:assert/strict';
import {createServer} from '/workspace/tangsongpai/node_modules/vite/dist/node/index.js';
import {chromium} from '/workspace/tangsongpai/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openSelector,tapUI} from '/workspace/tangsongpai/harness/ui.mjs';
const dir='/tmp/ipad-independent-review/',report={head:'14b75a42748f258d20863a82bd3b0cafeb9d1daa',scope:'One810x1080 native-touch natural shop, chapter/items right edge, tool inspect/cancel, workshop open/rotate/close. Read-only state/journal/storage tuples; no buy/production mutation or expanded viewport matrix.',steps:[],errors:[]};
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5810,strictPort:true},logLevel:'error'});await server.listen();const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
try{
 const p=await browser.newPage({viewport:{width:810,height:1080},deviceScaleFactor:2,hasTouch:true});p.setDefaultTimeout(20000);p.on('pageerror',e=>report.errors.push(String(e)));
 await p.goto('http://127.0.0.1:5810/?harness=1&seed=ipad-readonly');await p.waitForFunction(()=>window.__harness?.game.scene.isActive('title'),null,{timeout:60000});await openSelector(p,true);await tapUI(p,'character-select','character/amo',true);await tapUI(p,'character-select','action/confirm-character',true);await tapUI(p,'character-select','route/group',true);await tapUI(p,'character-select','action/confirm-character',true);await p.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));await p.waitForTimeout(450);
 const tuple=()=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return{state:c.state,journal:c.journal,slots:await c.store.read()};});const baseline=await tuple();
 report.baseline={seq:baseline.state.commandSeq,gold:baseline.state.gold,tupleSha:digest(baseline)};
 const unchanged=async note=>{const x=await tuple();assert.deepEqual(x,baseline);report.steps.push({note,tupleSha:digest(x)});};
 const edge=async name=>{const xy=await p.evaluate(name=>{const g=window.__harness.game,s=g.scene.getScene('shop');const find=list=>{for(const o of list){if(o.name===name)return o;if(o.list){const n=find(o.list);if(n)return n;}}};const o=find(s.children.list),h=o.input.hitArea,q=o.getWorldTransformMatrix().transformPoint(h.x+h.width-4-o.displayOriginX,h.y+h.height/2-o.displayOriginY),v=s.cameras.main.matrix.transformPoint(q.x-s.cameras.main.scrollX,q.y-s.cameras.main.scrollY),r=g.canvas.getBoundingClientRect();return{x:r.x+v.x*r.width/g.scale.width,y:r.y+v.y*r.height/g.scale.height};},name);report.steps.push({note:'native right-edge '+name,point:xy});await p.touchscreen.tap(xy.x,xy.y);};
 report.geometry=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),g=s.geometry();return{viewMode:s.view.layout.mode,shopPortrait:g.portrait,shopPc:!!g.pc,chapter:g.chapter,items:g.items};});
 await edge('action/chapter');const chapter=p.getByRole('dialog',{name:'本章节目单',exact:true});await chapter.waitFor();await unchanged('chapter is correct, not first goods');await chapter.locator('.dialog-close').tap();await p.waitForTimeout(100);
 await edge('action/items');const item=p.locator('dialog[open]');await item.waitFor();report.itemsTitle=await item.getAttribute('aria-label');assert.match(report.itemsTitle,/道具|物品/);await unchanged('items right-edge opens inventory');await item.locator('.dialog-close').tap();
 await tapUI(p,'shop','action/shelf-tools',true);await p.waitForFunction(()=>window.__harness.game.scene.getScene('shop').shelfKind==='tools');await unchanged('tools shelf is read only');
 const offer=await p.evaluate(()=>window.__harness.game.registry.get('runController').state.shop.toolOffers.find(o=>!o.consumed).offerId);await tapUI(p,'shop','offer/'+offer,true);const detail=p.locator('dialog[open]');await detail.waitFor();report.toolTitle=await detail.getAttribute('aria-label');await unchanged('actual tool inspect');await detail.locator('.dialog-close').tap();await unchanged('tool cancel');
 await tapUI(p,'shop','action/shelf-workshop',true);const workshop=p.getByRole('dialog',{name:'自选做牌 · 每店共用1次',exact:true});await workshop.waitFor();await unchanged('actual workshop opens from tablet legacy shelf');
 const buttons=await workshop.getByRole('button').allTextContents();report.workshopButtons=buttons;
 await p.setViewportSize({width:1080,height:810});await p.waitForFunction(()=>document.querySelector('canvas').getBoundingClientRect().width===1080);await p.waitForTimeout(450);await workshop.waitFor();await unchanged('workshop survives one orientation change');
 const close=workshop.locator('.dialog-close'),rect=await close.boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=1080.1&&rect.y+rect.height<=810.1);await close.tap();await unchanged('workshop close in landscape');
 await p.screenshot({path:dir+'shop-after-workshop.png'});assert.deepEqual(report.errors,[]);report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser.close();await server.close();report.cleanup='Chromium/Vite closed in finally';await writeFile(dir+'input.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
