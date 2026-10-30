import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {waitScene} from './ui.mjs';

// Use Chromium's actual profile preference, not CSS zoom or a root font override.
const output=process.env.DOM_TEXT_OUT??'shots/dom-large-text';
await mkdir(output,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const url=server.resolvedUrls.local[0]+'?harness=1';
const cases=[];
try {
 for(const spec of [
  {name:'pc-auto-24',width:1366,height:768,defaultSize:24},
  {name:'320-auto-24',width:320,height:568,defaultSize:24,touch:true},
  {name:'390-auto-24',width:390,height:844,defaultSize:24,touch:true},
  {name:'390-manual-large',width:390,height:844,defaultSize:16,mode:'large',touch:true},
  {name:'390-standard',width:390,height:844,defaultSize:16,mode:'standard',touch:true},
 ]) {
  const profile=await mkdtemp(join(tmpdir(),'tsp-font-'));await mkdir(join(profile,'Default'));
  await writeFile(join(profile,'Default','Preferences'),JSON.stringify({webkit:{webprefs:{default_font_size:spec.defaultSize}}}));
  const context=await chromium.launchPersistentContext(profile,{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,reducedMotion:'reduce',args:['--disable-gpu']});
  try {
   const page=await context.newPage();page.setDefaultTimeout(20000);
   if(spec.mode)await page.addInitScript(mode=>localStorage.setItem('tangsongpai-canvas-size-v1',mode),spec.mode);
   await page.goto(url);await waitScene(page,'title');
   const probe=await page.evaluate(()=>{const e=document.createElement('span');e.style.fontSize='medium';document.body.append(e);const size=parseFloat(getComputedStyle(e).fontSize);e.remove();return size;});
   assert.equal(probe,spec.defaultSize,'real browser default');
   const expected=spec.mode==='standard'?'normal':'large';
   await page.waitForFunction(expected=>document.documentElement.dataset.textSize===expected,expected);
   const home=page.locator('.title-home');const start=page.getByRole('button',{name:'开始新局',exact:true});
   await start.scrollIntoViewIfNeeded();await start.focus();assert.equal(await start.evaluate(e=>document.activeElement===e),true);
   const homeInfo=await home.evaluate(e=>({width:e.clientWidth,scrollWidth:e.scrollWidth,font:getComputedStyle(e.querySelector('.home-hint')).fontSize,buttonFont:getComputedStyle(e.querySelector('.home-actions button')).fontSize}));
   assert.ok(homeInfo.scrollWidth<=homeInfo.width+1,JSON.stringify(homeInfo));
   assert.ok(parseFloat(homeInfo.font)>=(expected==='large'?20:14),JSON.stringify(homeInfo));
   if(expected==='normal')assert.equal(homeInfo.font,'14px');
   await page.screenshot({path:`${output}/${spec.name}-home.png`});
   // Open the production DetailDialog with a deliberately long body, preserving real focus/action behavior.
   await page.evaluate(async()=>{const {DetailDialog}=await import('/src/game/DetailDialog.ts');window.domTextDialog=new DetailDialog();window.domTextDialog.open('阅读说明',Array.from({length:45},(_,i)=>`第 ${i+1} 条：完整说明需要在大字号下可阅读，也可以滚动到最后。`).join('\n'),[{label:'确认阅读',primary:true,run:()=>window.domTextDialog.close()}]);});
   const dialog=page.locator('.detail-dialog[open]');const body=dialog.locator('.dialog-body');const close=dialog.getByRole('button',{name:'关闭'});
   const info=await dialog.evaluate(d=>({width:d.clientWidth,scrollWidth:d.scrollWidth,height:d.clientHeight,scrollHeight:d.scrollHeight,font:getComputedStyle(d.querySelector('.dialog-body')).fontSize,bodyScroll:d.querySelector('.dialog-content').scrollHeight,bodyHeight:d.querySelector('.dialog-content').clientHeight}));
   assert.ok(info.scrollWidth<=info.width+1,JSON.stringify(info));
   assert.ok(parseFloat(info.font)>=(expected==='large'?20:15),JSON.stringify(info));
   assert.ok(info.scrollHeight>info.height || info.bodyScroll>info.bodyHeight,JSON.stringify(info));
   await page.screenshot({path:`${output}/${spec.name}-dialog-top.png`});
   await close.scrollIntoViewIfNeeded();await close.focus();assert.equal(await close.evaluate(e=>document.activeElement===e),true);
   await page.screenshot({path:`${output}/${spec.name}-dialog-bottom.png`});
   if(spec.touch)await close.tap();else await page.keyboard.press('Enter');
   assert.equal(await dialog.count(),0);assert.equal(await start.evaluate(e=>document.activeElement===e),true,'focus returned');
   // Exercise a real catalog and its real illustrated details, including a native action.
   await page.evaluate(async()=>{const {showCatalog}=await import('/src/game/CatalogDialog.ts');showCatalog(window.domTextDialog,undefined,()=>true);});
   const catalog=page.locator('.catalog-dialog[open]');await catalog.waitFor();
   const first=catalog.locator('.catalog-result button').first();await first.scrollIntoViewIfNeeded();
   const catalogInfo=await catalog.evaluate(d=>({width:d.clientWidth,scrollWidth:d.scrollWidth,scrollHeight:d.scrollHeight,height:d.clientHeight}));
   assert.ok(catalogInfo.scrollWidth<=catalogInfo.width+1,JSON.stringify(catalogInfo));
   if(spec.touch)await first.tap();else await first.click();
   const detail=page.locator('.detail-dialog[open]');await detail.waitFor();
   const detailInfo=await detail.evaluate(d=>({width:d.clientWidth,scrollWidth:d.scrollWidth,bodyFont:getComputedStyle(d.querySelector('.dialog-body')).fontSize}));
   assert.ok(detailInfo.scrollWidth<=detailInfo.width+1,JSON.stringify(detailInfo));
   await page.screenshot({path:`${output}/${spec.name}-catalog-detail.png`});
   const back=detail.getByRole('button',{name:'返回查询'});await back.scrollIntoViewIfNeeded();await back.focus();assert.equal(await back.evaluate(e=>document.activeElement===e),true);
   if(spec.touch)await back.tap();else await page.keyboard.press('Enter');await catalog.waitFor();
   cases.push({spec,probe,home:homeInfo,dialog:info,catalog:catalogInfo,detail:detailInfo});console.log('PASS',spec.name);
  } finally {await context.close();await rm(profile,{recursive:true,force:true});}
 }
 await writeFile(`${output}/report.json`,JSON.stringify({browser:'Chromium',cases},null,2));
} finally {await server.close();}
