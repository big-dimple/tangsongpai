/** Controlled validated shop inventory, real DOM/pointer inputs; no natural-acquisition claim. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {tapUI,waitScene} from './ui.mjs';

const out=process.env.SHOP_DISABLED_OUT??'shots/shop-disabled-contrast';
const observe=process.env.SHOP_DISABLED_OBSERVE==='1';
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5202,strictPort:true,hmr:false},logLevel:'error'});await server.listen();
const {createRun,applyCommand}=await server.ssrLoadModule('/src/domain/run.ts');
const {newRunIdentity}=await server.ssrLoadModule('/src/game/RunLaunch.ts');
const {makeCheckpoint,readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');
let state=createRun({seed:'group-natural-17',runId:'disabled-contrast',characterId:'amo',rulesVersion:'r2',r2Identity:newRunIdentity('amo','group'),openingRoute:'group',modeConfig:{mode:'standard',difficulty:0,challengeId:null,programsEnabled:false}});
const setup=applyCommand(state,{runId:state.runId,commandId:'disabled/setup',expectedSeq:state.commandSeq,action:{type:'RerollShop'}});assert.ok(setup.ok);state=setup.state;state.gold=30;state.consumables=[{instanceId:'owned/T08',definitionId:'T08'}];
const checkpoint=makeCheckpoint(state,[]);assert.ok(readCheckpoint(checkpoint).ok);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const report={observe,scope:'Validated controlled inventory import; browser pointer/touch and actual DOM styles; not a natural acquisition or physical device.',cases:[]};let page;
const snapshot=p=>p.evaluate(async()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal,storage:await c.store.read()};});
const luminance=rgb=>rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
const rgb=value=>{const m=value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);assert.ok(m,'opaque RGB color: '+value);return m.slice(1).map(Number);};
try{
 for(const [width,height] of [[1366,768],[390,740]]){
  const touch=width<700;page=await browser.newPage({viewport:{width,height},hasTouch:touch,reducedMotion:'reduce'});page.setDefaultTimeout(25000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto('http://127.0.0.1:5202/?harness=1');await waitScene(page,'title');assert.equal(await page.evaluate(async cp=>{const {gameSession}=await import('/src/game/session.ts'),{routeSavedRun}=await import('/src/game/RunMenu.ts');if(!gameSession().lease.writable)await gameSession().takeOver();const ok=await gameSession().importJSON(cp);if(ok)routeSavedRun(window.__harness.game);return ok;},JSON.stringify(checkpoint)),true);await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready);
  const before=await snapshot(page);await tapUI(page,'shop','action/tool-inventory',touch);await page.locator('.tool-inventory-card[data-item-id="owned/T08"]').click();const dialog=page.locator('.tool-detail[open]');await dialog.waitFor();const button=dialog.locator('.dialog-actions .dialog-primary');await button.waitFor();assert.ok(await button.isDisabled());
  const style=await button.evaluate(e=>{const c=getComputedStyle(e);return {color:c.color,background:c.backgroundColor,opacity:c.opacity,ancestorOpacity:[...function*(node){for(let p=node.parentElement;p;p=p.parentElement)yield getComputedStyle(p).opacity;}(e)],text:e.textContent,disabled:e.disabled};});const a=luminance(rgb(style.color)),b=luminance(rgb(style.background));const contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.equal(style.opacity,'1');assert.ok(style.ancestorOpacity.every(opacity=>opacity==='1'),'ancestor opacity must not fade the button');if(!observe)assert.ok(contrast>=4.5,'disabled button contrast '+contrast);
  const hit=await button.boundingBox();assert.ok(hit);if(touch)await page.touchscreen.tap(hit.x+hit.width/2,hit.y+hit.height/2);else await page.mouse.click(hit.x+hit.width/2,hit.y+hit.height/2);
  assert.equal(await dialog.count(),1);assert.ok(await button.isDisabled());await page.waitForTimeout(150);const afterClick=await button.evaluate(e=>{const c=getComputedStyle(e);return {color:c.color,background:c.backgroundColor,opacity:c.opacity};});assert.deepEqual(afterClick,{color:style.color,background:style.background,opacity:style.opacity},'disabled pointer state keeps the same readable colors');assert.deepEqual(await snapshot(page),before,'clicking disabled confirm must not commit');
  await page.screenshot({path:`${out}/${width}x${height}-disabled.png`});
  const target=dialog.locator('.tool-choice-grid input[name$="/target"]').first();await target.scrollIntoViewIfNeeded();if(touch)await target.tap();else await target.click();assert.ok(await button.isEnabled(),'selecting a valid target enables confirmation');assert.deepEqual(await snapshot(page),before,'selection alone must not commit');
  await page.waitForTimeout(200);const enabledStyle=await button.evaluate(e=>{const c=getComputedStyle(e);return {color:c.color,background:c.backgroundColor,opacity:c.opacity};});const enabledA=luminance(rgb(enabledStyle.color)),enabledB=luminance(rgb(enabledStyle.background));assert.ok((Math.max(enabledA,enabledB)+.05)/(Math.min(enabledA,enabledB)+.05)>=4.5,'enabled confirmation retains contrast');await dialog.getByRole('button',{name:'稍后使用',exact:true}).click();assert.deepEqual(await snapshot(page),before,'cancel preserves saved state');assert.deepEqual(errors,[]);
  report.cases.push({width,height,style,contrast,enabledStyle,disabledClickPreserved:true,selectionEnabled:true,cancelPreserved:true});console.log(JSON.stringify(report.cases.at(-1)));await page.close();page=undefined;
 }
 report.status='PASS';
}catch(error){report.status='FAIL';report.error=String(error.stack??error);process.exitCode=1;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(report.error);}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();await server.close();}
