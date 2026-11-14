/**
 * Novice cognition acceptance, using real browser input and observed game state.
 *
 *   node harness/novice-cognition-e2e.mjs
 *   NOVICE_COGNITION_CASE=short320-two node harness/novice-cognition-e2e.mjs
 *   NOVICE_COGNITION_PORT=5821 SMOKE_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium ...
 *
 * Every run gets a fresh directory under /tmp with report.json, screenshots,
 * complete Playwright videos and regularly extracted video frames. The only
 * state setup is a separately labelled pre-existing v10 checkpoint for the
 * legacy case; a fresh run's decisions are never dispatched or injected.
 * Run after product changes have stopped: the script rejects source drift.
 */
import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {mkdir,mkdtemp,readFile,readdir,symlink,unlink,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import {confirmHeroRoute,enterOpeningShop,openMenuSection,point,tapUI,waitScene} from './ui.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=await mkdtemp(join(tmpdir(),'tsp-novice-cognition-e2e-'));
const ffmpeg=process.env.FFMPEG_PATH??(process.platform==='win32'?'ffmpeg':'/usr/bin/ffmpeg');
const run=promisify(execFile),git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const sourcePaths=['src','public','index.html','vite.config.ts','package.json','package-lock.json','harness/ui.mjs','harness/novice-cognition-e2e.mjs','tests/fixtures/r2-v10-amo-checkpoints.json'];
function sourceFingerprint(){
  const hash=createHash('sha256');
  hash.update(execFileSync('git',['diff','--binary','HEAD','--',...sourcePaths],{cwd:root,maxBuffer:80*1024*1024}));
  const names=execFileSync('git',['ls-files','-z','--others','--exclude-standard','--',...sourcePaths],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
  for(const name of names){hash.update(name+'\0');hash.update(readFileSync(join(root,name)));}
  return hash.digest('hex');
}
const require=createRequire(import.meta.url);
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync('/usr/bin/ffmpeg')){
  const dir=await mkdtemp(join(tmpdir(),'tsp-cognition-playwright-'));
  const manifest=JSON.parse(await readFile(join(dirname(require.resolve('playwright-core/package.json')),'browsers.json'),'utf8'));
  const revision=manifest.browsers.find(row=>row.name==='ffmpeg')?.revision;
  assert.ok(revision,'Playwright ffmpeg revision');
  await mkdir(join(dir,`ffmpeg-${revision}`));
  await symlink('/usr/bin/ffmpeg',join(dir,`ffmpeg-${revision}`,'ffmpeg-linux'));
  process.env.PLAYWRIGHT_BROWSERS_PATH=dir;
}
const {chromium}=await import('playwright');
const port=Number(process.env.NOVICE_COGNITION_PORT??5821);
const server=await createServer({root,mode:'e2e',cacheDir:join(tmpdir(),`tsp-cognition-vite-${port}`),optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??(process.platform==='win32'?undefined:'/usr/bin/chromium'),args:['--disable-gpu','--disable-software-rasterizer']});
const diagnostic=process.env.NOVICE_COGNITION_DIAGNOSTIC==='1';
const specs=[
  {name:'desktop-five',width:1920,height:1080,touch:false,discardCount:5},
  {name:'desktop-one',width:1366,height:768,touch:false,discardCount:1},
  {name:'desktop-two',width:1366,height:768,touch:false,discardCount:2},
  {name:'phone390-five',width:390,height:740,touch:true,discardCount:5,restart:true},
  {name:'phone390-one',width:390,height:740,touch:true,discardCount:1,restart:true},
  {name:'phone390-two',width:390,height:740,touch:true,discardCount:2},
  {name:'short320-five',width:320,height:568,touch:true,discardCount:5,edgeCases:true},
  {name:'short320-one',width:320,height:568,touch:true,discardCount:1},
  {name:'short320-two',width:320,height:568,touch:true,discardCount:2,edgeCases:true,replay:true},
  {name:'legacy-v10',width:390,height:740,touch:true,legacy:true},
].filter(spec=>!process.env.NOVICE_COGNITION_CASE||process.env.NOVICE_COGNITION_CASE.split(',').includes(spec.name));
assert.ok(specs.length,'NOVICE_COGNITION_CASE must select at least one known case');
const report={scope:'Fresh tutorial uses mouse on desktop and emulated CDP touch on phones; all game actions use UI input. Separate legacy case preloads a validated frozen v10 checkpoint before starting the application. No human comprehension or physical-device claim.',geometryPolicy:'Guide panel requires scrollHeight <= clientHeight exactly. Individual text nodes allow a 1px CSSOM integer rounding difference (fractional rendered height); viewport, ancestor clipping, and protected-target overlap remain strict.',commit:git('rev-parse','HEAD'),dirtyAtStart:git('status','--porcelain=v1'),sourceBefore:sourceFingerprint(),browser:browser.version(),output:out,cases:[]};
console.log('Evidence directory:',out);
const sorted=ids=>[...ids].sort();
const sameBox=(a,b)=>Math.abs(a.x-b.x)<2&&Math.abs(a.y-b.y)<2&&Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2;
const overlaps=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
const fractionsEqual=(h,m,result)=>BigInt(h.n)*BigInt(m.n)===BigInt(result)*BigInt(h.d)*BigInt(m.d);
const fractionForms=f=>{const n=BigInt(f.n),d=BigInt(f.d);return [...new Set([d===1n?String(n):`${n}/${d}`,String(Number(n)/Number(d))])];};
const containsNumber=(text,forms)=>forms.some(value=>new RegExp('(?:^|[^0-9.])'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=$|[^0-9.])').test(text));
async function writeReport(){await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}

async function scenario(spec){
  const dir=join(out,spec.name);await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,isMobile:spec.touch,deviceScaleFactor:1,recordVideo:{dir,size:{width:spec.width,height:spec.height}}});
  const page=await context.newPage(),cdp=spec.touch?await context.newCDPSession(page):undefined;
  const row={...spec,status:'RUNNING',checks:[],shots:[],errors:[],network:[],console:[]};report.cases.push(row);
  const pending=new Map();
  const network=(type,request,detail={})=>{const url=request.url(),entry={type,at:Date.now(),url,resource:request.resourceType(),...detail};row.network.push(entry);if(row.network.length>500)row.network.shift();return entry;};
  page.on('request',request=>pending.set(request,network('request',request)));
  page.on('requestfinished',request=>{const entry=pending.get(request);pending.delete(request);if(entry){entry.finishedAt=Date.now();entry.status='finished';}});
  page.on('requestfailed',request=>{const entry=pending.get(request);pending.delete(request);network('requestfailed',request,{failure:request.failure(),previous:entry});});
  page.on('response',response=>{if(response.status()>=400)network('http-error',response.request(),{status:response.status()});});
  page.on('console',message=>{if(['warning','error'].includes(message.type())){row.console.push({type:message.type(),text:message.text()});if(row.console.length>100)row.console.shift();}});
  const edgeCases=!!spec.edgeCases&&!(diagnostic&&process.env.NOVICE_COGNITION_DIAG_EDGES==='0');
  page.setDefaultTimeout(30000);page.on('pageerror',error=>row.errors.push(String(error.stack??error)));
  if(diagnostic&&cdp){
    row.diagnostic={mode:{tap:process.env.NOVICE_COGNITION_DIAG_TAP??'playwright',edgeCases},breakpoints:[],resolved:[],scripts:[],pauses:[],events:[]};
    const transformed=await server.transformRequest('/src/game/GameScene.ts'),lines=transformed.code.split('\n'),start=lines.findIndex(line=>line.includes('onChoice: (id) =>'));
    assert.ok(start>=0,'diagnostic locates the real compiled choice callback');
    await cdp.send('Debugger.enable');
    cdp.on('Debugger.scriptParsed',event=>{if(event.url.includes('/src/game/GameScene.ts'))row.diagnostic.scripts.push({url:event.url,scriptId:event.scriptId});});
    cdp.on('Debugger.breakpointResolved',event=>row.diagnostic.resolved.push(event));
    cdp.on('Debugger.paused',async event=>{
      try{
        const frame=event.callFrames[0],result=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:'({id,storedKey:firstStage?.key,currentKey:firstStageKey(),options:firstStage?.options?.map(o=>o.id),target:firstStage?.target?.id,selected:[...this.selectedIds]})',returnByValue:true,silent:true});
        row.diagnostic.pauses.push({url:frame.url,location:frame.location,hitBreakpoints:event.hitBreakpoints,value:result.result?.value,error:result.exceptionDetails?.text});
      }catch(error){row.diagnostic.pauses.push({error:String(error)});}
      finally{await cdp.send('Debugger.resume').catch(()=>{});}
    });
    for(const lineNumber of [start+1,start+5])row.diagnostic.breakpoints.push(await cdp.send('Debugger.setBreakpointByUrl',{urlRegex:'/src/game/GameScene\\.ts(?:\\?.*)?$',lineNumber}));
  }
  const click=async locator=>spec.touch?locator.tap():locator.click();
  const tap=(scene,name)=>tapUI(page,scene,name,spec.touch);
  const saved=()=>page.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return c?{state:c.state,journal:c.journal,status:c.status}:null;});
  const state=async()=>(await saved()).state;
  const selected=()=>page.evaluate(()=>[...window.__harness.game.scene.getScene('game').selectedIds]);
  const waitSelected=ids=>page.waitForFunction(ids=>{const actual=[...window.__harness.game.scene.getScene('game').selectedIds].sort();return JSON.stringify(actual)===JSON.stringify([...ids].sort());},ids);
  const ready=()=>page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing&&!s.tweens.isTweening(v.container));},null,{timeout:45000});
  const shopReady=async()=>{await waitScene(page,'shop');await page.waitForFunction(()=>window.__harness.game.scene.getScene('shop').ready,null,{timeout:45000});};
  const guide=async step=>{await page.waitForFunction(step=>document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep===step,step,{timeout:45000});await page.locator('[data-novice-guide-panel]:visible').waitFor();};
  const touchEvent=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(({x,y})=>({x,y,id:1,radiusX:2,radiusY:2,force:1}))});
  const down=async p=>{if(spec.touch)await touchEvent('touchStart',[p]);else{await page.mouse.move(p.x,p.y);await page.mouse.down();}};
  const move=async p=>{if(spec.touch)await touchEvent('touchMove',[p]);else await page.mouse.move(p.x,p.y);};
  const up=async()=>{if(spec.touch)await touchEvent('touchEnd',[]);else await page.mouse.up();};
  // A real swipe has duration and traverses the cards. Instant, long CDP moves
  // can make Chromium suppress the next touch's compatibility click, even on
  // a plain HTML page, and are not a representative player gesture.
  const glide=async(a,b)=>{for(let n=1;n<=10;n++){await move({x:a.x+(b.x-a.x)*n/10,y:a.y+(b.y-a.y)*n/10});await page.waitForTimeout(20);}};
  const route=async ids=>{const ps=await Promise.all(ids.map(id=>point(page,'game','card/'+id)));await down(ps[0]);for(let i=1;i<ps.length;i++)await glide(ps[i-1],ps[i]);await up();if(spec.touch)await page.waitForTimeout(300);await ready();};
  const choose=async ids=>{for(const id of ids)await tap('game','card/'+id);await waitSelected(ids);await ready();};
  const clear=async()=>{for(const id of await selected())await tap('game','card/'+id);await waitSelected([]);await ready();};
  const afterCommand=async before=>{
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c?.status==='idle'&&c.state.commandSeq>seq;},before.state.commandSeq,{timeout:45000});
    await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('intermission')||s.scene.isActive()&&s.ready&&!s.playing&&!s.presentation;},null,{timeout:45000});
  };
  // Collect real painted hit columns, active buttons, held-card copy and guide
  // bounds. These observations never click or modify game state.
  const view=()=>page.evaluate(()=>{
    const g=window.__harness?.game,p=document.querySelector('[data-novice-guide-panel]:not([hidden])');
    if(!g||!p||!p.getClientRects().length||getComputedStyle(p).visibility==='hidden')return null;
    const key=g.scene.isActive('game')?'game':g.scene.isActive('shop')?'shop':g.scene.isActive('intermission')?'intermission':null;
    const s=key?g.scene.getScene(key):null,l=s?.view?.layout,c=g.canvas.getBoundingClientRect(),sx=l?c.width/l.width:1,sy=l?c.height/l.height:1;
    const box=b=>b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.width)&&Number.isFinite(b.height)?{x:c.left+b.x*sx,y:c.top+b.y*sy,width:b.width*sx,height:b.height*sy}:null;
    // getBounds() returns object world coordinates. Apply the actual scene
    // camera before mapping to CSS pixels, as the pointer hit testing does.
    const objectBox=o=>{
      if(!s||typeof o.getBounds!=='function')return null;
      const b=o.getBounds(),camera=s.cameras.main,points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>camera.matrix.transformPoint(x-camera.scrollX,y-camera.scrollY));
      const xs=points.map(p=>c.left+p.x*c.width/g.scale.width),ys=points.map(p=>c.top+p.y*c.height/g.scale.height);
      return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
    };
    const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
    const panel=rect(p),scroll=document.scrollingElement,protect=[],critical=[];
    const add=(name,b,important=false)=>{const x=box(b);if(x&&x.width>0&&x.height>0){protect.push({name,...x});if(important)critical.push({name,...x});}};
    let cards=[],owned=[],previewCount=0,selectedCount=0;
    if(key==='game'&&l){
      for(const [name,b] of Object.entries({hud:l.hud,score:l.scoreBoard,hand:l.hand,actions:l.actions,hero:l.heroAction,inventory:l.inventoryEntry,help:l.helpEntry,...Object.fromEntries(Object.entries(l.buttons??{}).map(([k,v])=>['button/'+k,v]))}))add(name,b,!['hud','score','hand'].includes(name));
      for(let i=0;i<s.run.jokers.length;i++)add('owned-slot/'+i,l.slots[i]);
      cards=s.hand.flatMap((card,i)=>{const v=s.cardViews[i],seat=l.cards[i];if(!v?.container.active||!v.container.visible||!seat?.visible)return[];const w=Number(v.container.getData('width')),h=Number(v.container.getData('height')),m=v.container.getWorldTransformMatrix(),a=m.transformPoint(-w/2,-h/2),z=m.transformPoint(w/2,h/2),b=box({x:a.x,y:a.y,width:Math.min(z.x-a.x,seat.hit.width),height:z.y-a.y});return b?[{id:card.id,suit:card.suit,rank:card.rank,...b}]:[];});
      const preview=s.previewCards,previewMap=preview?.active&&preview.visible?preview.getData('cardViews'):undefined;
      const previews=previewMap instanceof Map?[...previewMap].flatMap(([id,card])=>{
        const o=card.container;if(!o?.active||!o.visible||o.alpha<=.01)return[];
        const w=Number(o.getData('width')),h=Number(o.getData('height')),m=o.getWorldTransformMatrix(),a=m.transformPoint(-w/2,-h/2),z=m.transformPoint(w/2,h/2),camera=s.cameras.main;
        const points=[[a.x,a.y],[z.x,a.y],[a.x,z.y],[z.x,z.y]].map(([x,y])=>camera.matrix.transformPoint(x-camera.scrollX,y-camera.scrollY)),xs=points.map(point=>c.left+point.x*c.width/g.scale.width),ys=points.map(point=>c.top+point.y*c.height/g.scale.height);
        return [{name:'played-card/'+id,x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)}];
      }):[];
      protect.push(...previews);previewCount=previews.length;selectedCount=s.selectedIds.size;
      if(preview?.active&&preview.visible)for(const o of preview.list){if(!o.active||!o.visible||!o.input?.enabled||typeof o.getBounds!=='function')continue;const b=objectBox(o);if(b)protect.push({name:o.name||'preview-control',...b});}
      const caption=s.view.root.getByName('table/played-label');if(caption?.active&&caption.visible&&caption.text){const b=objectBox(caption);if(b)protect.push({name:'played-caption',...b});}
    }
    if(key==='shop'&&l){const geo=s.geometry();if(geo.play)add('shop/play',geo.play,true);if(geo.ownedToggle)add('shop/owned-toggle',geo.ownedToggle,true);if(!geo.inventoryCollapsed)geo.slots.slice(0,s.run.jokers.length).forEach((b,i)=>add('shop/owned-slot/'+i,b));}
    if(s){
      const walk=items=>items.flatMap(o=>[o,...(o.list?walk(o.list):[])]);
      for(const o of walk(s.children.list)){
        if(!o.active||!o.visible||o.alpha<=.01||typeof o.getBounds!=='function'||!['shop/held-purpose','shop/owned-state','shop/owned-route','shop/owned-name','shop/owned-identity','shop/owned-heading','shop/owned-drag-hint','joker/hover-purpose','pc/joker-name','pc/joker-rule'].includes(o.name))continue;
        const b=objectBox(o);if(b&&b.width&&b.height&&b.x<innerWidth&&b.y<innerHeight&&b.x+b.width>0&&b.y+b.height>0){const item={name:o.name,text:o.text??'',fullText:o.getData?.('fullText')??null,...b};owned.push(item);protect.push(item);critical.push(item);}
      }
    }
    const rings=[...document.querySelectorAll('[data-novice-guide-highlight]')].filter(el=>el.getClientRects().length).map(rect);
    const choices=[...p.querySelectorAll('[data-novice-guide-choice]')].filter(el=>el.getClientRects().length).map(el=>({id:el.dataset.noviceGuideChoice,ids:el.dataset.cardIds,text:el.innerText,pressed:el.getAttribute('aria-pressed'),box:rect(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    const textParts=[...p.querySelectorAll('.novice-guide-title,.novice-guide-body,[data-novice-guide-choice]')].filter(el=>el.getClientRects().length).map(el=>({text:el.innerText,box:rect(el),scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
    let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};for(let el=p.parentElement;el;el=el.parentElement){const style=getComputedStyle(el),r=el.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(style.overflowX)){clip.left=Math.max(clip.left,r.left);clip.right=Math.min(clip.right,r.right);}if(/auto|scroll|hidden|clip/.test(style.overflowY)){clip.top=Math.max(clip.top,r.top);clip.bottom=Math.min(clip.bottom,r.bottom);}}
    const demo=document.querySelector('[data-novice-gesture]:not([hidden])'),hand=demo?.querySelector('[data-novice-gesture-hand]');
    return {scene:key,step:document.querySelector('[data-novice-guide]')?.dataset.noviceGuideStep,title:p.querySelector('.novice-guide-title')?.textContent,body:p.querySelector('.novice-guide-body')?.textContent,text:p.innerText,panel,clip,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,documentScroll:{width:scroll?.scrollWidth,clientWidth:scroll?.clientWidth,height:scroll?.scrollHeight,clientHeight:scroll?.clientHeight},protect,critical,owned,cards,previewCount,selectedCount,rings,choices,textParts,demo:demo?{mode:demo.dataset.mode,phase:demo.dataset.phase,aria:demo.getAttribute('aria-hidden'),pointerEvents:getComputedStyle(demo).pointerEvents,hand:hand?rect(hand):null,opacity:hand?getComputedStyle(hand).opacity:null}:null,result:key==='game'?s.resultText?.text:null,status:key==='game'?s.statusText?.text:null};
  });
  const shot=async(name,{guideRequired=true}={})=>{
    // Record the picture before assertions so a failed geometry check is reviewable.
    await page.screenshot({path:join(dir,name+'.png'),scale:'css'});
    const v=await view();row.shots.push({name,view:v});
    if(guideRequired)assert.ok(v,`${name}: a visible guide is expected`);
    if(v){
      assert.ok(v.scrollHeight<=v.clientHeight,`${name}: guide must fit without internal scrolling: ${JSON.stringify(v)}`);
      const p=v.panel;assert.ok(p.x>=-1&&p.y>=-1&&p.x+p.width<=spec.width+1&&p.y+p.height<=spec.height+1,`${name}: guide leaves viewport`);
      assert.ok(p.x>=v.clip.left-1&&p.y>=v.clip.top-1&&p.x+p.width<=v.clip.right+1&&p.y+p.height<=v.clip.bottom+1,`${name}: guide is clipped by an ancestor`);
      assert.ok(v.documentScroll.width<=v.documentScroll.clientWidth+1,`${name}: unexpected horizontal page overflow`);
      for(const t of v.textParts)assert.ok(t.scrollHeight<=t.clientHeight+1&&t.scrollWidth<=t.clientWidth+1,`${name}: guide text or choice is clipped: ${JSON.stringify(t)}`);
      for(const b of v.protect)assert.ok(!overlaps(p,b),`${name}: guide covers ${b.name}: ${JSON.stringify({panel:p,covered:b})}`);
      if(v.scene==='game')assert.equal(v.previewCount,v.selectedCount,`${name}: every selected card has a measured visible preview`);
      for(const card of v.cards)assert.ok(!overlaps(p,card),`${name}: guide covers a painted hand card: ${JSON.stringify({panel:p,card})}`);
      if(v.demo?.hand&&v.demo.opacity!=='0'){
        assert.equal(v.demo.pointerEvents,'none',`${name}: visual hand must not intercept input`);assert.equal(v.demo.aria,'true');
        assert.ok(!overlaps(p,v.demo.hand),`${name}: visual hand covers tutorial text`);
        for(const b of v.critical)assert.ok(!overlaps(v.demo.hand,b),`${name}: visual hand covers ${b.name}`);
      }
    }
    console.log(spec.name,name,v?.step,v?.title,v?.body);
    return v;
  };
  const captureGesture=async(mode,name)=>{
    const selector=`[data-novice-gesture][data-mode="${mode}"]`;
    await page.locator(selector+':visible').waitFor();
    const before=await saved(),selectionBefore=mode==='sweep'?await selected():null;
    const meta=await page.locator(selector).evaluate(el=>({aria:el.getAttribute('aria-hidden'),pointer:getComputedStyle(el).pointerEvents,children:[...el.querySelectorAll('*')].map(x=>getComputedStyle(x).pointerEvents)}));
    assert.equal(meta.aria,'true');assert.equal(meta.pointer,'none');assert.ok(meta.children.every(x=>x==='none'));
    const route=await page.locator(selector+' polyline').evaluate(el=>el.getAttribute('points').trim().split(/\s+/).map(pair=>pair.split(',').map(Number)));
    assert.ok(route.length>=2&&route.every(p=>p.length===2&&p.every(Number.isFinite)),'gesture follows measurable live positions');
    // Sample changing frames as evidence and catch transient occlusion. In particular,
    // do not label the first moving frame as proof that the hand traverses the cards.
    for(const phase of mode==='hold-drag'?['press','hold','move','release']:['press','move','release']){
      await page.waitForFunction(({selector,phase,route})=>{const e=document.querySelector(selector);if(!e||e.hidden||e.dataset.phase!==phase)return false;if(phase!=='move')return true;const [a,b]=[route[0],route.at(-1)],p={x:Number(e.dataset.x),y:Number(e.dataset.y)};return Math.hypot(p.x-a[0],p.y-a[1])>=Math.hypot(b[0]-a[0],b[1]-a[1])*.45;},{selector,phase,route},{timeout:12000});
      await shot(`${name}-${phase}`);
    }
    assert.deepEqual(await saved(),before,'passive demonstration must not submit a command');
    if(selectionBefore)assert.deepEqual(await selected(),selectionBefore,'passive demonstration must not select cards');
  };
  const dragView=()=>page.evaluate(()=>{
    const g=window.__harness.game,s=g.scene.getScene('shop'),drag=s.ownedDrag,art=drag&&s.ownedArts.get(drag.id);if(!drag||!art)return null;
    const canvas=g.canvas.getBoundingClientRect(),camera=s.cameras.main,b=art.getBounds(),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>camera.matrix.transformPoint(x-camera.scrollX,y-camera.scrollY));
    const xs=points.map(p=>canvas.left+p.x*canvas.width/g.scale.width),ys=points.map(p=>canvas.top+p.y*canvas.height/g.scale.height),floating={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
    const visible=selector=>{const el=document.querySelector(selector);if(!el||el.hidden||!el.getClientRects().length||getComputedStyle(el).visibility==='hidden'||getComputedStyle(el).display==='none')return null;const r=el.getBoundingClientRect();return {text:el.innerText,box:{x:r.x,y:r.y,width:r.width,height:r.height},pointerEvents:getComputedStyle(el).pointerEvents};};
    return {id:drag.id,floating,panel:visible('[data-novice-guide-panel]'),status:visible('[data-owned-drag-status]')};
  });
  const recordDrag=async name=>{
    await page.waitForFunction(()=>!!window.__harness.game.scene.getScene('shop').ownedDrag,null,{timeout:3000});
    await page.screenshot({path:join(dir,name+'.png'),scale:'css'});const observed=await dragView();assert.ok(observed?.floating,'real lifted-card bounds are observable');
    for(const overlay of [observed.panel,observed.status].filter(Boolean))assert.ok(!overlaps(observed.floating,overlay.box),`${name}: floating card must not cover guide or drag feedback: ${JSON.stringify(observed)}`);
    if(observed.status)assert.equal(observed.status.pointerEvents,'none','drag feedback does not intercept the gesture');
    row.shots.push({name,drag:observed});return observed;
  };
  const restore=async scene=>{
    // DOMContentLoaded starts the real readiness checks below; waiting for the
    // window load event can outlast a streaming audio request on Windows.
    const before=await saved();await page.reload({waitUntil:'domcontentloaded'});await waitScene(page,'title');await tap('title','action/title-continue');await waitScene(page,scene);if(scene==='game')await ready();else if(scene==='shop'){await shopReady();await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached',timeout:45000});}
    const after=await saved();assert.deepEqual(after.state,before.state,'saved state survives refresh');assert.deepEqual(after.journal,before.journal,'saved commands survive refresh');return after;
  };
  const continueResult=async()=>{
    for(let i=0;i<10;i++){
      const p=await point(page,'intermission','action/continue-stage'),v=await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('intermission'),r=g.canvas.getBoundingClientRect(),v=s.resultContent.getData('viewport');return {top:r.top+v.top*r.height/s.view.layout.height,bottom:r.top+v.bottom*r.height/s.view.layout.height};});
      if(p.y>=v.top&&p.y<=v.bottom){await tap('intermission','action/continue-stage');return;}
      if(spec.touch){const downward=p.y>v.bottom,start={x:spec.width*.5,y:downward?v.bottom-18:v.top+18},end={x:start.x,y:downward?v.top+18:v.bottom-18};await down(start);await glide(start,end);await up();await page.waitForTimeout(300);}
      else{await page.mouse.move(spec.width/2,(v.top+v.bottom)/2);await page.mouse.wheel(0,p.y<v.top?-300:300);}
      await page.waitForTimeout(180);
    }
    throw Error('result continuation never entered its visible scroll viewport');
  };
  const buy=async definitionId=>{
    const before=await saved(),offer=before.state.shop.offers.find(o=>o.definitionId===definitionId&&!o.consumed);assert.ok(offer,`${definitionId} is actually offered`);
    await tap('shop','offer/'+offer.offerId);const dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();
    await click(dialog.getByRole('button',{name:/^(购买\s*·\s*\d+\s*金|确认购买)$/}));
    await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c?.status==='idle'&&c.state.commandSeq>seq;},before.state.commandSeq,{timeout:45000});await shopReady();
    const after=await saved();assert.equal(after.journal.at(-1).action.type,'BuyOffer');assert.equal(after.journal.at(-1).action.offerId,offer.offerId);assert.equal(after.state.jokers.length,before.state.jokers.length+1);return after;
  };
  try{
    if(spec.legacy){
      const fixture=JSON.parse(await readFile(join(root,'tests/fixtures/r2-v10-amo-checkpoints.json'),'utf8')).before;
      const {readCheckpoint}=await server.ssrLoadModule('/src/application/checkpoint.ts');const valid=readCheckpoint(fixture);
      assert.ok(valid.ok,`the historical checkpoint must validate before preloading: ${JSON.stringify(valid)}`);
      row.setup='Validated v10 checkpoint preloaded once in a blank independent context; not a UI import or a naturally created old run.';
      await page.route('**/__legacy-bootstrap',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Existing prior checkpoint</title>'}));
      await page.goto(`http://127.0.0.1:${port}/__legacy-bootstrap`);
      // Sole setup exception: create the already-existing save before the app opens.
      await page.evaluate(async checkpoint=>{const {IndexedDbSave}=await import('/src/platform/IndexedDbSave.ts');await new IndexedDbSave().commit(0,checkpoint,null);},fixture);
      await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');await tap('title','action/title-continue');await waitScene(page,'game');await ready();
      const loaded=await saved();assert.deepEqual(loaded.state,fixture.state);assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0,'old standard run must not enroll automatically');
      await shot('01-old-save-continued',{guideRequired:false});await restore('game');assert.deepEqual((await saved()).state,loaded.state);assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0);await shot('02-old-save-restored',{guideRequired:false});
      row.checks.push('validated pre-existing v10 save continued and reloaded unchanged without automatic novice guide');
    }else{
      await page.goto(`http://127.0.0.1:${port}/?harness=1`);await waitScene(page,'title');
      if(diagnostic)await page.evaluate(()=>{
        const log=[];window.__cognitionEventLog=log;
        for(const [where,node] of [['window',window],['document',document]])for(const capture of [true,false])for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchend','mousedown','mouseup','click'])node.addEventListener(type,event=>{
          const target=event.target instanceof Element?event.target:null,choice=target?.closest('[data-novice-guide-choice]');if(!choice)return;
          const point=event.changedTouches?.[0]??event,at=Number.isFinite(point.clientX)?document.elementFromPoint(point.clientX,point.clientY):null,r=choice.getBoundingClientRect(),s=window.__harness?.game.scene.getScene('game'),h=s?.handInput;
          const touches=list=>list?[...list].map(t=>({identifier:t.identifier,x:t.clientX,y:t.clientY,target:t.target instanceof Element?t.target.tagName:null})):null;
          const entry={type,where,capture,time:performance.now(),trusted:event.isTrusted,target:target.tagName,choice:choice.getAttribute('data-novice-guide-choice'),pressed:choice.getAttribute('aria-pressed'),pointerId:event.pointerId,pointerType:event.pointerType,isPrimary:event.isPrimary,x:point.clientX,y:point.clientY,touches:touches(event.touches),changedTouches:touches(event.changedTouches),connected:choice.isConnected,sameAsBefore:choice===window.__cognitionTappedElement,rect:{x:r.x,y:r.y,width:r.width,height:r.height},elementAtPoint:at?.outerHTML.slice(0,250),defaultPrevented:event.defaultPrevented,cancelBubble:event.cancelBubble,hand:{active:h?.active,owner:h?.owner,pointers:h?.pointers?[...h.pointers]:null,contacts:h?.contacts?[...h.contacts]:null}};log.push(entry);
          setTimeout(()=>{entry.afterDispatch=event.defaultPrevented;},0);
        },{capture,passive:true});
        new MutationObserver(changes=>{for(const change of changes){const el=change.target;if(change.type==='attributes'&&el instanceof HTMLElement&&el.matches('[data-novice-guide-choice]'))log.push({type:'aria-change',time:performance.now(),choice:el.dataset.noviceGuideChoice,pressed:el.getAttribute('aria-pressed')});if(change.type==='childList'&&window.__cognitionTappedElement)for(const n of [...change.addedNodes,...change.removedNodes])if(n===window.__cognitionTappedElement||n.contains?.(window.__cognitionTappedElement))log.push({type:'choice-ancestor-changed',time:performance.now(),connected:window.__cognitionTappedElement.isConnected,node:n.nodeName});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed']});
      });
      assert.equal(await page.evaluate(()=>!!window.__harness.game.registry.get('runController')),false,'fresh browser starts without a run');
      await tap('title','action/title-start');await waitScene(page,'game');await ready();await guide('pair');let first=await shot('01-pair');
      const initial=await state(),pair=['clubs-5','hearts-5'];assert.ok(pair.every(id=>initial.handOrder.includes(id)),'actual tutorial hand has the opening pair');
      if(edgeCases){
        const wrong=initial.handOrder.find(id=>!pair.includes(id));await choose([wrong]);const mistaken=await shot('02-wrong-pair');assert.match(mistaken.text,/取消|去掉|选错/,'mistake is correctable');await clear();
      }
      await choose([pair[0]]);let selectedView=await shot('03-one-five');
      const other=selectedView.cards.find(c=>c.id===pair[1]);assert.ok(other&&selectedView.rings.some(r=>sameBox(r,other)),'highlight points to the other actual five');
      await tap('game','card/'+pair[1]);await waitSelected(pair);await ready();await shot('04-pair-ready');
      let before=await saved();await tap('game','action/play');await afterCommand(before);await ready();await guide('discard');let current=await state();
      assert.equal(current.lastTrace.handType,'pair');assert.equal((await saved()).journal.at(-1).action.type,'PlayHand');
      const trace=current.lastTrace;assert.ok(fractionsEqual(trace.accumulator.H,trace.accumulator.M,trace.finalScore),'opening displayed product is backed by exact saved score');
      const base=trace.events.find(e=>e.phase==='base'&&e.operation==='base'),ordinary=trace.events.filter(e=>e.phase==='onCardScore'&&e.sourceType==='card'&&e.sourceDefinitionId.startsWith('rank-')&&e.operation==='add-heat');
      assert.ok(base&&ordinary.length===trace.sets.activeScoringIds.length,'the saved opening score has a complete base and card-event chain');
      await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='先看看三张红桃');
      const discardView=await shot('05-three-hearts');assert.match(discardView.text,/3张红桃/);assert.match(discardView.text,/5张同花色/);assert.match(discardView.text,/未必/,'the next draw is not promised');
      const openingHearts=['hearts-10','hearts-6','hearts-3'];
      for(const id of openingHearts){const card=discardView.cards.find(c=>c.id===id);assert.ok(card&&discardView.rings.some(r=>sameBox(r,card)),`actual ${id} is highlighted before sorting`);}
      if(spec.width===320&&!diagnostic){
        await page.waitForTimeout(10000);const lasting=await shot('05b-three-hearts-after-ten-seconds');
        assert.equal(lasting.title,discardView.title,'the player controls when to proceed');assert.equal(lasting.body,discardView.body,'the goal and caveat remain readable');
      }
      if(spec.restart){await restore('game');await guide('discard');await shot('06-intro-restored');}
      await click(page.locator('[data-novice-guide-choice="flush-intro"]'));await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='让同花色排在一起');
      const sortPrompt=await shot('07-sort-prompt'),sortPoint=await point(page,'game','action/sort-suit');
      assert.match(sortPrompt.text,/花色/);assert.ok(sortPrompt.rings.some(r=>sortPoint.x>=r.x-2&&sortPoint.x<=r.x+r.width+2&&sortPoint.y>=r.y-2&&sortPoint.y<=r.y+r.height+2),'sorting highlight frames the actual suit control');
      if(spec.width===320){const label=await page.evaluate(()=>window.__harness.game.scene.getScene('game').suitButton?.getData('label')?.text??'');assert.match(label,/点.*花色/);}
      // The arithmetic is deliberately available on demand while the goal-driven
      // instruction remains concise. Compare it with the saved trace, not a fixture.
      await click(page.locator('[data-novice-guide-details-toggle]'));const details=page.locator('dialog[open]').last();await details.waitFor();
      const scoreText=await details.innerText();await page.screenshot({path:join(dir,'07b-actual-score-details.png'),scale:'css'});
      assert.match(scoreText,/筹码/);assert.match(scoreText,/倍率/);assert.match(scoreText,/基础|牌型/);assert.match(scoreText,/牌点|点数/);assert.match(scoreText,/×|乘/);
      for(const [label,value] of [['base',base.after.H],['chips',trace.accumulator.H],['multiplier',trace.accumulator.M],...ordinary.map((event,index)=>['card '+index,event.value])])assert.ok(containsNumber(scoreText,fractionForms(value)),`score details match saved ${label}: ${JSON.stringify({value,scoreText})}`);
      assert.ok(containsNumber(scoreText,[trace.finalScore])&&containsNumber(scoreText,[current.stage.targetHeat]));
      row.firstScore={handType:trace.handType,base:base.after,cardEvents:ordinary,accumulator:trace.accumulator,score:trace.finalScore,stage:current.stage.heat,target:current.stage.targetHeat,guide:scoreText};
      await click(details.getByRole('button',{name:'返回练习',exact:true}));await guide('discard');
      before=await saved();await tap('game','action/sort-suit');await ready();current=await state();
      assert.equal((await saved()).journal.at(-1).action.type,'ReorderHand');assert.ok(current.commandSeq>before.state.commandSeq);
      const left=['spades-14','spades-11'],hearts=['hearts-10','hearts-6','hearts-3'],right=['clubs-7','clubs-4','diamonds-4'];
      assert.deepEqual(current.handOrder,[...left,...hearts,...right],'actual suit sort groups two left, three hearts, three right');
      await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='三张红桃排在一起了');const sortedView=await shot('08-sorted-hearts');
      for(const id of hearts){const card=sortedView.cards.find(c=>c.id===id);assert.ok(card&&sortedView.rings.some(r=>sameBox(r,card)),`sorted ${id} remains highlighted`);}
      await click(page.locator('[data-novice-guide-choice="flush-sorted"]'));await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='选左侧其他花色');
      await page.locator('[data-novice-gesture][data-mode="sweep"]:visible').waitFor({timeout:45000});await shot('09-left-sweep');
      if(edgeCases){
        await captureGesture('sweep','09b-left-demo');
        await choose([hearts[0]]);const alternative=await shot('09c-alternative-heart');assert.match(alternative.text,/取消/);
        assert.equal((await point(page,'game','action/discard')).enabled,true,'a different legal discard is never blocked');await clear();
        const unchanged=await saved(),a=await point(page,'game','card/'+left[0]),b=await point(page,'game','card/'+left[1]);
        await down(a);await glide(a,b);const applied=await selected();if(spec.touch)await touchEvent('touchCancel',[]);else{await page.keyboard.press('Escape');await up();}
        await page.waitForTimeout(300);await ready();if(spec.touch)assert.deepEqual(sorted(await selected()),sorted(applied),'touch cancellation retains applied selection');
        await clear();assert.deepEqual(await saved(),unchanged,'interrupted gestures never submit commands');
      }
      const chosen=spec.discardCount===5?[...left,...right]:left.slice(0,spec.discardCount);
      if(spec.discardCount===1)await choose([left[0]]);else{await route(left);await waitSelected(left);}
      if(spec.discardCount===5){
        await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='选右侧其他花色');await shot('10-right-sweep');
        await route([right[0],right.at(-1)]);await waitSelected(chosen);
        await page.waitForFunction(()=>document.querySelector('.novice-guide-title')?.textContent==='选好了，试试换牌');
      }
      assert.equal(await page.locator('dialog[open]').count(),0);assert.equal((await point(page,'game','action/discard')).enabled,true,'partial or full legal selection can be discarded');
      await shot('11-discard-ready');before=await saved();await tap('game','action/discard');await afterCommand(before);await ready();current=await state();const action=(await saved()).journal.at(-1).action;
      assert.equal(action.type,'DiscardHand');assert.deepEqual(sorted(action.selectedIds),sorted(chosen));assert.equal(current.stage.discardsLeft,before.state.stage.discardsLeft-1);assert.equal(current.stage.handsLeft,before.state.stage.handsLeft);
      assert.equal(current.handOrder.filter(id=>!before.state.handOrder.includes(id)).length,chosen.length);row.discard={selected:chosen,replacements:current.handOrder.filter(id=>!before.state.handOrder.includes(id))};
      await guide('independent');await page.locator('[data-novice-guide-choice]:visible').first().waitFor({timeout:45000});
      const afterRefill=await shot('12-actual-refill'),actualHearts=current.handOrder.filter(id=>id.startsWith('hearts-'));
      assert.equal(actualHearts.length,3+Math.min(spec.discardCount,3),'fixed-seed refill produces the observed count');
      assert.match(afterRefill.body,new RegExp(actualHearts.length+'张红桃'),'the guidance reports the actual result');
      await choose(actualHearts.slice(0,4));await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').resultText.text.includes('高牌'));
      const four=await shot('13-four-hearts-high-card');assert.match(four.result??'',/高牌/);assert.match(four.text,/同花|同花色|同色/);assert.match(four.text,/差1张/);assert.match(four.text,/最高/);
      if(actualHearts.length>=5){
        await tap('game','card/'+actualHearts[4]);await waitSelected(actualHearts.slice(0,5));await ready();
        await page.waitForFunction(()=>window.__harness.game.scene.getScene('game').resultText.text.includes('同花'));const five=await shot('14-five-hearts-flush');assert.match(five.result??'',/同花/);
        const flush=page.locator('[data-novice-guide-choice="flush"]');await flush.waitFor({state:'visible'});
        await page.evaluate(()=>{const button=document.querySelector('[data-novice-guide-choice="flush"'),events=[];window.__cognitionFlushClick=events;for(const type of ['pointerdown','pointerup','click'])button.addEventListener(type,event=>events.push({type,trusted:event.isTrusted,time:performance.now()}),{once:true,passive:true});});
        if(diagnostic)await page.evaluate(()=>{window.__cognitionEventLog.length=0;window.__cognitionTappedElement=document.querySelector('[data-novice-guide-choice="flush"]');});
        if(spec.touch&&(!diagnostic||process.env.NOVICE_COGNITION_DIAG_TAP==='cdp')){
          const b=await flush.boundingBox();assert.ok(b,'choice has a real touch target');const p={x:b.x+b.width/2,y:b.y+b.height/2};await touchEvent('touchStart',[p]);await touchEvent('touchEnd',[]);
        }else await click(flush);
        if(diagnostic)row.diagnostic.afterTap=await page.evaluate(()=>{const old=window.__cognitionTappedElement,current=document.querySelector('[data-novice-guide-choice="flush"]'),s=window.__harness.game.scene.getScene('game'),h=s.handInput;return{same:old===current,oldConnected:old?.isConnected,oldPressed:old?.getAttribute('aria-pressed'),currentPressed:current?.getAttribute('aria-pressed'),hand:{active:h?.active,owner:h?.owner,pointers:h?.pointers?[...h.pointers]:null,contacts:h?.contacts?[...h.contacts]:null}};});
        await page.waitForFunction(()=>document.querySelector('[data-novice-guide-choice="flush"]')?.getAttribute('aria-pressed')==='true',null,{timeout:diagnostic?5000:30000});
        row.flushClick=await page.evaluate(()=>window.__cognitionFlushClick??[]);assert.ok(row.flushClick.some(event=>event.type==='click'&&event.trusted),'a real input chose the flush example');
        assert.deepEqual(sorted(await selected()),sorted(actualHearts.slice(0,5)),'choosing an example never auto-selects or changes cards');
        assert.equal((await point(page,'game','action/play')).enabled,true);await shot('15-flush-example-selected');
        if(diagnostic){row.diagnostic.events=await page.evaluate(()=>window.__cognitionEventLog??[]);row.checks.push('diagnostic ended after the real flush choice; not a complete acceptance scenario');row.status='PASS';return;}
        row.hearts={four:{ids:actualHearts.slice(0,4),label:four.result},five:{ids:actualHearts.slice(0,5),total:actualHearts.length,label:five.result}};
      }
      await clear();
      if(edgeCases){
        const stable=await saved(),ids=(await state()).handOrder;assert.equal(ids.length,8);
        await route([ids[0],ids[4],ids[0]]);await waitSelected(ids.slice(0,5));await route([ids[4],ids[0],ids[4]]);await waitSelected([]);
        await choose([ids[2]]);await clear();await route([ids[0],ids[7]]);await waitSelected(ids.slice(0,5));await tap('game','card/'+ids[7]);await waitSelected(ids.slice(0,5));
        const limit=await shot('16-selection-limit');assert.match(limit.status??'',/最多.*5|5.*上限/);await clear();
        await route([ids[7],ids[0]]);await waitSelected(ids.slice(3));await clear();assert.deepEqual(await saved(),stable,'reverse, cancel and limit do not change saved gameplay');
      }
      const hands=[];
      for(let attempt=0;attempt<3;attempt++){
        await page.locator('[data-novice-guide-choice]:visible').first().waitFor({timeout:45000});const choicesView=await shot(`19-${attempt}-choices`),choices=choicesView.choices;assert.ok(choices.length>=1&&choices.length<=2);
        current=await state();for(const option of choices){const ids=JSON.parse(option.ids);assert.ok(ids.length>=1&&ids.length<=5&&ids.every(id=>current.handOrder.includes(id)),'each suggestion is built from the visible hand');assert.match(option.text,/\d+\s*分/,'each visible suggestion contains a score estimate');}
        // Explicitly choose one plan, then manually play a different offered hand.
        // The selected plan may guide, but must not take control of the cards.
        const desired=attempt===0&&choices.length>1?choices[1]:choices.reduce((best,c)=>Number(c.text.match(/(\d+)\s*分/)?.[1]??0)>Number(best.text.match(/(\d+)\s*分/)?.[1]??0)?c:best,choices[0]);
        const plan=choices[0];await click(page.locator('[data-novice-guide-choice]').filter({hasText:plan.text}).first());
        await page.waitForFunction(id=>[...document.querySelectorAll('[data-novice-guide-choice]')].some(el=>el.dataset.noviceGuideChoice===id&&el.getAttribute('aria-pressed')==='true'),plan.id);
        assert.deepEqual(await selected(),[],'choosing a plan must not auto-select cards');
        const planned=await shot(`19-${attempt}-plan-highlight`),planIds=JSON.parse(plan.ids),lit=planned.cards.filter(card=>planned.rings.some(r=>sameBox(r,card)));
        assert.ok(lit.length>0&&lit.every(card=>planIds.includes(card.id)),'the chosen plan highlights its own real cards');
        const ids=JSON.parse(desired.ids);await choose(ids);await shot(`20-${attempt}-manual-hand`);assert.equal((await point(page,'game','action/play')).enabled,true,'player may submit the actually selected hand even if a different plan was chosen');
        before=await saved();await tap('game','action/play');await afterCommand(before);current=await state();const command=(await saved()).journal.at(-1).action;
        assert.equal(command.type,'PlayHand');assert.deepEqual(sorted(command.selectedIds),sorted(ids));assert.equal(current.lastTrace.handType,desired.id,'actual score uses the player-selected hand');
        const estimate=desired.text.match(/(\d+)\s*分/);if(estimate&&!/[–~-]/.test(desired.text))assert.equal(current.lastTrace.finalScore,estimate[1],'displayed estimate equals saved score');
        hands.push({planned:plan.id,played:desired.id,ids,estimate:desired.text,score:current.lastTrace.finalScore,cumulative:current.stage.heat});if(current.phase==='stage-cleared')break;await ready();
      }
      assert.equal(current.phase,'stage-cleared','real first-stage play reaches its goal');assert.equal(Number(current.stage.targetHeat),400);assert.ok(Number(current.stage.heat)>=400);row.hands=hands;await waitScene(page,'intermission');await shot('21-first-stage-cleared',{guideRequired:false});
      await continueResult();await shopReady();await page.locator('.qiyu-entrance-burst-canvas').waitFor({state:'detached',timeout:45000});
      const firstPurchase=await buy('b02');assert.equal(firstPurchase.state.jokers.length,1);await guide('payoff');await shot('22-first-purchase');
      let rack=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),p=s.geometry();return {collapsed:p.inventoryCollapsed,slots:p.slots.length,ids:s.run.jokers.map(j=>j.instanceId)};});
      if(rack.collapsed){await tap('shop','action/toggle-owned');await page.waitForFunction(()=>!window.__harness.game.scene.getScene('shop').geometry().inventoryCollapsed);}
      rack=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('shop'),p=s.geometry();return {collapsed:p.inventoryCollapsed,slots:p.slots.length,ids:s.run.jokers.map(j=>j.instanceId)};});
      assert.equal(rack.slots,5);assert.equal(rack.ids.length,1);const firstRack=await shot('23-five-slots-one-owned');assert.match(firstRack.text,/(五|5).*槽/,'five slots are explained');assert.match(firstRack.text,/左.*右/,'the usual left-to-right order is explained');assert.match(firstRack.text,/继续买|继续购买|进入牌桌|下一场/,'one-card explanation gives a feasible next action');
      if(edgeCases){
        const oneBefore=await saved(),position=await point(page,'shop','joker/'+rack.ids[0]);await down(position);await page.waitForTimeout(450);const holding=await recordDrag('23b-one-card-hold');
        assert.match([holding.panel?.text,holding.status?.text].filter(Boolean).join(' '),/多张|两张|2张/,'single-card long hold explains that reordering needs more cards');
        await up();await shopReady();assert.deepEqual(await saved(),oneBefore,'a single-card hold makes no impossible reorder');assert.equal(await page.locator('.detail-dialog[open]').count(),0);
      }
      const secondPurchase=await buy('c03');assert.equal(secondPurchase.state.jokers.length,2);rack=await page.evaluate(()=>window.__harness.game.scene.getScene('shop').geometry());if(rack.inventoryCollapsed){await tap('shop','action/toggle-owned');await page.waitForFunction(()=>!window.__harness.game.scene.getScene('shop').geometry().inventoryCollapsed);}
      await page.locator('[data-novice-gesture][data-mode="hold-drag"]:visible').waitFor({timeout:45000});const two=await shot('24-two-owned');assert.match(two.text,/按住|长按/);assert.match(two.text,/拖|移动/);
      if(!spec.touch){const effect=two.owned.find(item=>item.name==='shop/held-purpose');assert.ok(effect&&effect.text,'desktop two-card shop has a measurable, visible held-card effect explanation');assert.ok(!overlaps(two.panel,effect),'desktop guide avoids the actual held-card effect text bounds');row.desktopHeldEffect=effect;}
      const beforeDrag=await saved(),owned=beforeDrag.state.jokers.map(j=>j.instanceId);let from=await point(page,'shop','joker/'+owned[0]),to=await point(page,'shop','joker/'+owned[1]);
      if(edgeCases)await captureGesture('hold-drag','25-demo-drag');
      if(edgeCases){
        await down(from);await page.waitForTimeout(450);await recordDrag('25b-drag-before-cancel');await glide(from,{x:spec.width-3,y:from.y});await page.screenshot({path:join(dir,'25c-drag-outside-rail.png'),scale:'css'});await up();if(spec.touch)await page.waitForTimeout(300);await shopReady();
        assert.deepEqual(await saved(),beforeDrag,'releasing outside the rail cancels without saving');assert.equal(await page.locator('.detail-dialog[open]').count(),0,'cancelled drag is not a tap');
        await tap('shop','joker/'+owned[0]);let dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await click(dialog.getByRole('button',{name:'出售',exact:true}));dialog=page.locator('.detail-dialog[open]').last();await dialog.waitFor();await click(dialog.getByRole('button',{name:'取消',exact:true}));dialog=page.locator('.detail-dialog[open]').last();if(await dialog.count())await click(dialog.getByRole('button',{name:'关闭',exact:true}));
        assert.deepEqual(await saved(),beforeDrag,'opening and cancelling the real sale leaves the order and resources unchanged');from=await point(page,'shop','joker/'+owned[0]);to=await point(page,'shop','joker/'+owned[1]);
      }
      await down(from);await page.waitForTimeout(450);await glide(from,to);await recordDrag('26-drag-held');assert.deepEqual(await saved(),beforeDrag,'drag preview is not a saved reorder');await up();if(spec.touch)await page.waitForTimeout(300);
      await page.waitForFunction(seq=>{const c=window.__harness.game.registry.get('runController');return c?.status==='idle'&&c.state.commandSeq>seq;},beforeDrag.state.commandSeq,{timeout:45000});await shopReady();const afterDrag=await saved();
      assert.deepEqual(afterDrag.state.jokers.map(j=>j.instanceId),[owned[1],owned[0]]);assert.equal(afterDrag.state.gold,beforeDrag.state.gold);assert.equal(afterDrag.journal.at(-1).action.type,'ReorderJokers');await shot('27-order-saved');
      if(spec.restart){await restore('shop');assert.deepEqual((await state()).jokers.map(j=>j.instanceId),[owned[1],owned[0]]);await shot('28-order-restored');}
      await tap('shop','action/start-stage');await waitScene(page,'game');await ready();await guide('payoff');const entryGuide=await shot('29-payoff-before-play');
      if(!spec.touch){
        const names=entryGuide.owned.filter(item=>item.name==='pc/joker-name'&&item.text),rules=entryGuide.owned.filter(item=>item.name==='pc/joker-rule'&&item.text);
        assert.equal(names.length,2,'desktop table renders two actual owned-card names');assert.equal(rules.length,2,'desktop table renders two actual owned-card effect descriptions');
        for(const item of [...names,...rules])assert.ok(!overlaps(entryGuide.panel,item),'desktop guide avoids actual table card name and rule bounds');
        row.desktopTableEffects={names,rules};
      }
      const firstName=await page.evaluate(async id=>(await import('/src/game/tangsongCardNames.ts')).cardDisplayName(id),firstPurchase.state.jokers[0].definitionId);
      assert.ok(entryGuide.text.includes(firstName),'buying/reordering a second card does not silently replace the first target before any real contribution');assert.match(entryGuide.body,/同点/);assert.match(entryGuide.body,/有效计分/);
      // First play a genuine single card: b02 needs at least two equal ranks.
      current=await state();
      // c03 is also owned now; a red single neither forms b02's pair nor
      // satisfies c03's black-suit condition. Otherwise c03 can legitimately
      // advance the lesson even though b02 did not fire.
      const single=current.handOrder.find(id=>['hearts','diamonds'].includes(current.deckInstances.find(c=>c.id===id)?.suit));
      assert.ok(single,'the real hand contains a red single which triggers neither purchased card');
      await choose([single]);assert.equal((await point(page,'game','action/play')).enabled,true,'payoff guidance does not forbid another legal hand');await shot('30-payoff-single-selected');
      before=await saved();await tap('game','action/play');await afterCommand(before);await ready();current=await state();
      const purchased=firstPurchase.state.jokers[0],missed=current.lastTrace.events.filter(e=>e.sourceInstanceId===purchased.instanceId&&e.sourceDefinitionId===purchased.definitionId&&['onCardScore','onHeldCard','jokerScore'].includes(e.phase));
      assert.equal(current.lastTrace.handType,'high-card');assert.equal(missed.length,0,'a single card cannot trigger the purchased paired-rank effect');
      const allPurchased=new Set(secondPurchase.state.jokers.map(j=>j.instanceId));
      assert.equal(current.lastTrace.events.filter(e=>allPurchased.has(e.sourceInstanceId)&&['onCardScore','onHeldCard','jokerScore'].includes(e.phase)).length,0,'neither purchased card triggered on the red single');
      await guide('payoff');const miss=await shot('31-payoff-not-triggered');
      assert.ok(miss.text.includes(firstName),'a non-triggering hand retains the first purchased target');assert.match(miss.text,/上手|上一手|刚才|未加成|未生效|未触发/,'the explanation distinguishes the missed previous result');assert.match(miss.text,/未|没有|不满足|没能|无/,'the explanation does not claim a nonexistent trigger');assert.match(miss.text,/(?:无|没有|未).{0,10}同点|同点.{0,10}(?:不足|不满足|没有|未|无)/,'the missed result identifies the actual lack of paired-rank scoring');assert.match(miss.text,/有效计分/,'the effect condition distinguishes scoring cards');
      row.notTriggered={trace:current.lastTrace,guide:miss.text};
      // Find a pair in the actual post-play hand, exchanging real cards only if needed.
      const findPair=s=>{const byRank=new Map();for(const id of s.handOrder){const rank=s.deckInstances.find(c=>c.id===id)?.rank;byRank.set(rank,[...(byRank.get(rank)??[]),id]);}return [...byRank.values()].find(a=>a.length>=2)?.slice(0,2);};
      let payPair=findPair(current);for(let attempt=0;!payPair&&attempt<3;attempt++){
        assert.ok(current.stage.discardsLeft>0,'a real discard remains available to look for a pair');await choose(current.handOrder.slice(0,5));before=await saved();await tap('game','action/discard');await afterCommand(before);await ready();current=await state();payPair=findPair(current);
      }
      assert.ok(payPair,'actual dealt or exchanged hand contains a pair');let payoffGuide=await view();
      const ringed=payoffGuide.cards.filter(c=>payoffGuide.rings.some(r=>sameBox(r,c)));
      const highlighted=ringed.find(card=>current.handOrder.some(id=>id!==card.id&&current.deckInstances.find(c=>c.id===id)?.rank===card.rank));
      assert.ok(highlighted,'payoff highlight points to an actual pair card');
      payPair=[highlighted.id,current.handOrder.find(id=>id!==highlighted.id&&current.deckInstances.find(c=>c.id===id)?.rank===highlighted.rank)];
      await choose([payPair[0]]);const onePair=await shot('32a-payoff-one-selected'),otherPair=onePair.cards.find(card=>card.id===payPair[1]);
      assert.ok(otherPair&&onePair.rings.some(r=>sameBox(r,otherPair)),'after choosing one pair card, the remaining real matching card is highlighted');
      assert.match(onePair.body,/同点/);assert.match(onePair.body,/有效计分/);
      await tap('game','card/'+payPair[1]);await waitSelected(payPair);await ready();const pairReady=await shot('32-payoff-pair-selected');assert.match(pairReady.body,/同点/);assert.match(pairReady.body,/有效计分/);before=await saved();await tap('game','action/play');await afterCommand(before);current=await state();
      const paid=current.lastTrace.events.filter(e=>e.sourceInstanceId===purchased.instanceId&&e.sourceDefinitionId===purchased.definitionId&&e.operation==='add-multiplier');assert.ok(paid.length>0,'the first purchased card contributed in the saved trace');
      for(const [label,reading] of [['before selection',entryGuide],['not triggered',miss],['one selected',onePair],['pair selected',pairReady]])assert.ok(containsNumber(reading.body,fractionForms(paid[0].value)),`${label}: effect explanation matches the real per-card value in the saved score event`);
      // Either purchase can be the first contributor after reordering. Check
      // the actual saved event's source and exact accumulated contribution.
      const contributes=e=>{
        if(!allPurchased.has(e.sourceInstanceId)||!['onCardScore','onHeldCard','jokerScore'].includes(e.phase)||!['add-multiplier','add-heat'].includes(e.operation))return false;
        const k=e.operation==='add-multiplier'?'M':'H',a=e.after[k],b=e.before[k];return BigInt(a.n)*BigInt(b.d)>BigInt(b.n)*BigInt(a.d);
      };
      const actualEvents=current.lastTrace.events.filter(contributes),firstEvent=actualEvents[0];assert.ok(firstEvent,'a purchased instance produced a real positive score event');
      const related=actualEvents.filter(e=>e.sourceInstanceId===firstEvent.sourceInstanceId&&e.operation===firstEvent.operation&&e.reasonKey===firstEvent.reasonKey),key=firstEvent.operation==='add-multiplier'?'M':'H';
      let numerator=0n,denominator=1n;
      for(const event of related){const a=event.after[key],b=event.before[key],n=BigInt(a.n)*BigInt(b.d)-BigInt(b.n)*BigInt(a.d),d=BigInt(a.d)*BigInt(b.d);numerator=numerator*d+n*denominator;denominator*=d;}
      const gcd=(a,b)=>b?gcd(b,a%b):a,divisor=gcd(numerator,denominator);numerator/=divisor;denominator/=divisor;
      const exactValues=[denominator===1n?String(numerator):`${numerator}/${denominator}`,String(Number(numerator)/Number(denominator))];
      const sourceName=await page.evaluate(async id=>(await import('/src/game/tangsongCardNames.ts')).cardDisplayName(id),firstEvent.sourceDefinitionId);
      await guide('skill');const payoff=await shot('33-payoff-actually-triggered',{guideRequired:current.phase==='await-input'});
      assert.ok(payoff?.text.includes(sourceName),`payoff names the purchased card that actually contributed: ${sourceName}`);
      assert.ok(payoff.text.includes(key==='M'?'倍率':'筹码'),'payoff names the statistic actually changed');
      assert.ok(exactValues.some(value=>payoff.text.includes(value)),`payoff value matches the saved event total ${exactValues.join(' or ')}: ${payoff.text}`);
      row.triggered={pair:payPair,firstEvent,related,firstPurchaseEvents:paid,expectedContribution:exactValues,guide:payoff.text,finalScore:current.lastTrace.finalScore};
      row.checks.push('fresh real run reaches 400, manually chooses and plays a hand, buys two cards, reorders by real hold, and observes a non-trigger followed by a saved trigger');
      if(spec.replay){
        await openMenuSection(page,'more',spec.touch);await click(page.getByRole('button',{name:'重玩新手教程',exact:true}));await waitScene(page,'game');await page.waitForFunction(id=>window.__harness.game.registry.get('runController')?.state.runId!==id,current.runId);await ready();await guide('pair');await shot('34-replayed');const retry=await state();
        await click(page.locator('[data-novice-guide-skip]'));await waitScene(page,'character-select');assert.equal((await state()).runId,retry.runId);assert.equal((await state()).commandSeq,retry.commandSeq);
        await tap('character-select','character/amo');await confirmHeroRoute(page,spec.touch,'group');await enterOpeningShop(page,spec.touch);await shopReady();current=await state();assert.equal(current.mode,'standard');assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0);await shot('35-skipped-normal-game',{guideRequired:false});
        await restore('shop');assert.equal((await state()).runId,current.runId);assert.equal(await page.locator('[data-novice-guide-panel]:visible').count(),0);await shot('36-skipped-restored',{guideRequired:false});row.checks.push('replay starts a new guided run; skip preserves it until a normal run is started, and that normal run restores without a guide');
      }
    }
    assert.deepEqual(row.errors,[],'no uncaught browser errors');row.status='PASS';
  }catch(error){
    row.status='FAIL';row.error=String(error.stack??error);console.error(spec.name,row.error);
    if(diagnostic)row.diagnostic.events=await page.evaluate(()=>window.__cognitionEventLog??[]).catch(()=>[]);
    row.flushClick=await page.evaluate(()=>window.__cognitionFlushClick??[]).catch(()=>[]);
    row.pendingRequests=[...pending.values()].map(entry=>({...entry,pendingMs:Date.now()-entry.at}));
    row.failure=await page.evaluate(()=>{const g=window.__harness?.game,c=g?.registry.get('runController'),loading=document.querySelector('#resource-loading');return {readyState:document.readyState,url:location.href,active:g?.scene.getScenes(true).map(s=>s.scene.key),boot:g?.scene.getScene('boot')?{active:g.scene.isActive('boot'),loader:g.scene.getScene('boot').load?.state}:null,loading:loading?{dataset:{...loading.dataset},text:loading.innerText}:null,scripts:[...document.scripts].map(s=>s.src||s.textContent?.slice(0,120)),resources:performance.getEntriesByType('resource').slice(-30).map(r=>({name:r.name,initiator:r.initiatorType,duration:r.duration,responseEnd:r.responseEnd,transferSize:r.transferSize})),state:c?.state,journal:c?.journal,guide:document.querySelector('[data-novice-guide]')?.outerHTML,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.innerText)};}).catch(()=>null);
    await page.screenshot({path:join(dir,'failure.png'),scale:'css'}).catch(()=>{});await writeReport();console.error(spec.name,'startup/network observation',JSON.stringify({pending:row.pendingRequests,console:row.console,failure:row.failure},null,2));process.exitCode=1;
  }finally{
    await cdp?.detach().catch(()=>{});const video=page.video();await context.close();
    if(video){
      const source=await video.path(),target=join(dir,'session.webm');await video.saveAs(target);if(source!==target)await unlink(source);row.video=target;
      const frames=join(dir,'frames');await mkdir(frames,{recursive:true});
      try{
        await run(ffmpeg,['-hide_banner','-loglevel','error','-threads','1','-i',target,'-vf','fps=1/2','-threads','1','-q:v','3',join(frames,'frame-%05d.jpg')],{maxBuffer:1024*1024});
        row.frames={directory:frames,intervalSeconds:2,count:(await readdir(frames)).filter(n=>n.endsWith('.jpg')).length};
        assert.ok(row.frames.count>0,'complete video has sampled frames');
      }catch(error){row.status='FAIL';row.frameError=String(error.stack??error);process.exitCode=1;}
    }else{row.status='FAIL';row.frameError='Browser did not provide a complete session video';process.exitCode=1;}
    await writeReport();
  }
}

try{for(const spec of specs)await scenario(spec);}
finally{
  await browser.close();await server.close();report.commitAfter=git('rev-parse','HEAD');report.sourceAfter=sourceFingerprint();
  if(report.commitAfter!==report.commit||report.sourceAfter!==report.sourceBefore){report.sourceChangedDuringRun=true;process.exitCode=1;}
  await writeReport();
}
if(report.cases.some(row=>row.status!=='PASS'))process.exitCode=1;
