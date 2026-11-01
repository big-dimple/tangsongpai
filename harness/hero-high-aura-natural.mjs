import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {chooseCharacter,tapUI,waitScene} from './ui.mjs';

// This seed naturally deals two queens to Liu E. Only actual UI actions select
// cards and invoke the hero; no save, hand, score, resource or RNG is injected.
const out=resolve(process.env.AURA_NATURAL_OUT??'shots/hero-high-aura-natural'),reduced=process.env.AURA_NATURAL_REDUCED==='1',skip=process.env.AURA_NATURAL_SKIP==='1',port=Number(process.env.AURA_NATURAL_PORT??5762);assert.ok(!(reduced&&skip),'run reduced-motion and skip checks separately');
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:'/tmp/tsp-aura-natural-vite',optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={seed:'six-new-1',reduced,skip,scope:'Actual current-identity new run and native mouse/touch actions, Chromium emulation; no injected state or score. Skip mode invokes the actual controller handler.',cases:[]};
try{
 for(const phone of process.env.AURA_PHONE_ONLY==='1'?[true]:[false,true]){
  const name=phone?'phone':'pc',viewport=phone?{width:Number(process.env.AURA_PHONE_WIDTH??390),height:Number(process.env.AURA_PHONE_HEIGHT??844)}:{width:1366,height:768},started=Date.now(),context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:phone,reducedMotion:reduced?'reduce':'no-preference',recordVideo:{dir:out,size:viewport}}),page=await context.newPage(),video=page.video(),row={name,viewport,errors:[],marks:{}};report.cases.push(row);page.setDefaultTimeout(30000);page.on('pageerror',e=>row.errors.push(String(e)));const mark=k=>{row.marks[k]=(Date.now()-started)/1000;};
  try{
   await page.addInitScript(value=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:1,reducedMotion:value})),reduced);
   await page.goto('http://127.0.0.1:'+port+'/?harness=1&seed=six-new-1');await chooseCharacter(page,'erxiang',phone);mark('shop');
   await tapUI(page,'shop','action/start-stage',phone);await waitScene(page,'game');const enter=page.getByRole('button',{name:/^进入.*›$/});if(await enter.count()){if(phone)await enter.tap();else await enter.click();}
   await page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('game')&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});
   const before=await page.evaluate(()=>window.__harness.game.registry.get('runController').state);const ids=['spades-12','diamonds-12'];assert.ok(ids.every(id=>before.handOrder.includes(id)));
   for(const id of ids)await tapUI(page,'game','card/'+id,phone);
   await tapUI(page,'game','hero/action-shortcut',phone);const index=before.handOrder.indexOf(ids[0])+1,choice=page.getByRole('button',{name:new RegExp('^第'+index+'张 · ')});if(phone)await choice.tap();else await choice.click();
   await page.evaluate(()=>{const g=window.__harness.game,s=g.scene.getScene('game'),p=window.__auraNatural={frames:[],deltas:[],shots:{},at:performance.now()};const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);p.tick=()=>{if(!s.scene.isActive())return;const objects=walk(s.view.root?.list??[]),a=objects.find(o=>o.name==='score/high-multiplier-aura'&&o.active&&o.visible),eventId=s.scoreTotal?.getData('eventId'),phase=s.scoreTotal?.getData('eventPhase');if(a){const time=performance.now(),segments=a.getData('visibleSegments')??0;if(p.last!==undefined)p.deltas.push(time-p.last);p.last=time;p.frames.push({at:time,eventId:a.getData('eventId'),currentEventId:eventId,phase,segments,elapsed:a.getData('elapsed'),interactive:!!a.input,mult:s.scoreMult.text});if(segments>0&&!p.shots.first)p.shots.first=g.canvas.toDataURL('image/png').split('base64,')[1];if(segments>0&&a.getData('elapsed')>=600&&!p.shots.later)p.shots.later=g.canvas.toDataURL('image/png').split('base64,')[1];}else p.last=undefined;};g.events.on('postrender',p.tick);});
   mark('play');await tapUI(page,'game','action/play',phone);await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,before.commandSeq);const after=await page.evaluate(()=>window.__harness.game.registry.get('runController').state),trace=after.lastTrace;
   const crossing=trace.events.find(e=>e.reasonKey==='erxiang.handoff'&&BigInt(e.before.M.n)<10n*BigInt(e.before.M.d)&&BigInt(e.after.M.n)>=10n*BigInt(e.after.M.d));assert.ok(crossing,'the actual saved character event crosses ×10');
   if(skip){await page.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game'),a=s.view.root?.getByName('score/high-multiplier-aura');return a?.active&&(a.getData('visibleSegments')??0)>0;});mark('skip');await page.evaluate(()=>window.__harness.game.scene.getScene('game').view.controllerAction('confirm'));}
   await waitScene(page,'intermission');mark('stage_cleared');const visual=await page.evaluate(()=>{const g=window.__harness.game,p=window.__auraNatural;g.events.off('postrender',p.tick);return p;});
   row.frames=visual.frames;row.frameDeltas=visual.deltas;row.eventId=crossing.eventId;row.beforeMultiplier=crossing.before.M;row.afterMultiplier=crossing.after.M;row.score=trace.finalScore;
   for(const [label,bytes]of Object.entries(visual.shots))await writeFile(resolve(out,name+'-'+label+'.png'),Buffer.from(bytes,'base64'));
   if(reduced)assert.equal(visual.frames.length,0,'reduced motion must not start a moving aura');else{
    const lit=visual.frames.filter(f=>f.segments>0);assert.ok(lit.length>=1,'visible aura occurs in real gameplay');assert.ok(lit.every(f=>f.eventId===crossing.eventId&&!f.interactive),'aura belongs to the saved event and cannot receive input');assert.equal(lit[0].currentEventId,crossing.eventId);assert.equal(lit[0].phase,'impact');assert.ok(new Set(lit.map(f=>f.eventId)).size===1,'the hand has only its selected cue');if(!skip)assert.ok(lit.length>=3&&visual.shots.first&&visual.shots.later,'record both early and later visible frames');
   }
   if(skip){const remaining=await page.evaluate(()=>{const s=window.__harness.game.scene.getScene('game'),a=s.view.root?.getByName('score/high-multiplier-aura');return !!a?.active;});assert.equal(remaining,false,'skipping cleans the aura without a late replay');}
   assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);await page.screenshot({path:resolve(out,name+'-failure.png')}).catch(()=>{});throw error;}
  finally{await context.close();await rename(await video.path(),resolve(out,name+'-full.webm'));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(name+' '+row.status+' '+JSON.stringify(row.marks));
 }
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{await browser.close();await server.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
