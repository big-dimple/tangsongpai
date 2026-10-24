import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {openSelector,tapUI} from '../../../../../harness/ui.mjs';
const stage=process.env.SELECTION_PERF_STAGE??'after',out=new URL('./'+stage+'/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',server:{host:'127.0.0.1',port:5799,strictPort:true},logLevel:'error'});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),stage,sourceHash:createHash('sha256').update(await readFile('src/game/SelectionEntryParticles.ts')).digest('hex'),viewport:{width:1366,height:768},browser:browser.version(),scope:'One identical native desktop selection/route/save-confirm flow per source. Serial, same browser flags, original-speed video, no snapshots during samples. Draw CPU is clear-to-postupdate, frame CPU preupdate-to-postrender; neither is physical GPU certification.',errors:[]};
try{
 const context=await browser.newContext({viewport:report.viewport,recordVideo:{dir:out,size:report.viewport}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.goto('http://127.0.0.1:5799/?harness=1');await openSelector(page,false);await page.waitForTimeout(500);await tapUI(page,'character-select','character/amo');await page.waitForTimeout(900);
 await page.evaluate(()=>{
  const game=window.__harness.game,s=game.scene.getScene('character-select'),p=s.entryParticles,play=p.playFeedback;
  window.perfSamples=[];window.perfPhase='idle';window.perfClears=[];window.perfShop=0;
  let frameStart,drawStart,lastDraw=0,lastCommands=0,wasShop=false;
  p.playFeedback=function(...args){const promise=play.apply(this,args),g=this.feedback;if(g&&!g.__perfWrapped){g.__perfWrapped=true;const clear=g.clear;g.clear=function(...a){drawStart=performance.now();const before=this.commandBuffer.length,result=clear.apply(this,a);window.perfClears.push({kind:p.activeKind,before,after:this.commandBuffer.length});return result;};}return promise;};
  s.events.on('preupdate',()=>{frameStart=performance.now();lastDraw=0;lastCommands=0;});
  s.events.on('postupdate',()=>{if(drawStart!==undefined){lastDraw=performance.now()-drawStart;drawStart=undefined;}lastCommands=p.feedback?.commandBuffer.length??0;});
  game.events.on('postrender',()=>{if(game.scene.isActive('character-select'))window.perfSamples.push({at:performance.now(),phase:window.perfPhase,kind:p.activeKind,progress:p.motion?.targets?.[0]?.progress,drawMs:lastDraw,frameCpuMs:performance.now()-frameStart,commands:lastCommands});const shop=game.scene.isActive('shop');if(shop&&!wasShop)window.perfShop++;wasShop=shop;});
 });
 await page.waitForTimeout(1800);await page.evaluate(()=>window.perfPhase='switch');await tapUI(page,'character-select','character/erxiang');await page.waitForTimeout(1050);
 await tapUI(page,'character-select','action/confirm-character');await page.evaluate(()=>window.perfPhase='route');await tapUI(page,'character-select','route/straight');await page.waitForTimeout(650);
 assert.equal(await page.evaluate(()=>window.__harness.game.registry.get('runController')??null),null);
 await page.evaluate(()=>window.perfPhase='confirm');await tapUI(page,'character-select','action/confirm-character');await page.waitForFunction(()=>window.__harness.game.scene.isActive('shop'));await page.waitForTimeout(300);
 const raw=await page.evaluate(async()=>{const g=window.__harness.game,p=g.scene.getScene('character-select').entryParticles,c=g.registry.get('runController');return{frames:window.perfSamples,clears:window.perfClears,shopEntries:window.perfShop,saved:{state:c.state,storage:await c.store.read()},cleanup:{nodes:p.nodes.length,motion:!!p.motion,gather:p.gathering.length,trail:p.trailing.length,listening:p.listening,destroyed:p.destroyed}};});
 assert.equal(raw.shopEntries,1);assert.equal(raw.saved.state.characterId,'erxiang');assert.equal(raw.saved.state.openingRoute,'straight');assert.deepEqual(raw.saved.state,raw.saved.storage.current.state);assert.deepEqual(raw.cleanup,{nodes:0,motion:false,gather:0,trail:0,listening:false,destroyed:true});assert.deepEqual(report.errors,[]);
 const stats=a=>{const s=a.toSorted((a,b)=>a-b);return{p50:s[Math.floor(s.length*.5)]??null,p95:s[Math.floor(s.length*.95)]??null,max:s.at(-1)??null};};
 report.phases=Object.fromEntries(['idle','switch','route','confirm'].map(k=>{const f=raw.frames.filter(x=>x.phase===k&&(k==='idle'||x.kind===k)),c=raw.clears.filter(x=>x.kind===k);return[k,{frames:f.length,frameIntervalMs:stats(f.slice(1).map((x,i)=>x.at-f[i].at)),drawCpuMs:stats(f.filter(x=>x.drawMs>0).map(x=>x.drawMs)),frameCpuMs:stats(f.map(x=>x.frameCpuMs)),maxCommands:Math.max(0,...f.map(x=>x.commands)),clearCalls:c.length,maxCommandsBeforeClear:Math.max(0,...c.map(x=>x.before)),maxCommandsAfterClear:Math.max(0,...c.map(x=>x.after))}];}));
 report.shopEntries=raw.shopEntries;report.cleanup=raw.cleanup;await writeFile(out+'samples.json.gz',gzipSync(JSON.stringify(raw)));const video=page.video();await context.close();await rename(await video.path(),out+'1366-original-speed.webm');report.status='PASS';
}catch(e){report.status='FAIL';report.error=e.stack;process.exitCode=1;}
finally{await browser.close();await server.close();report.cleanupServices='browser/Vite closed in finally';await writeFile(out+'report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
