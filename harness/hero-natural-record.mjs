import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {chooseCharacter,tapUI,waitScene} from './ui.mjs';

// A real new run and real mouse/touch actions. This seed supplies two natural
// two-pair hands; no checkpoint, score, hero state or drawn cards are injected.
const seed='visual-natural-1',speed=Number(process.env.HERO_NATURAL_SPEED??1),first=['hearts-7','diamonds-7','spades-9','diamonds-9','hearts-6'],second=['spades-5','diamonds-5','hearts-3','diamonds-3','clubs-2'];
assert.ok([1,2,4].includes(speed),'use a supported presentation speed');
const out=resolve(process.env.HERO_NATURAL_OUT??'shots/hero-natural-review'),port=Number(process.env.HERO_NATURAL_PORT??5758);
await mkdir(out,{recursive:true});
const server=await createServer({mode:'e2e',cacheDir:'/tmp/tsp-hero-natural-vite',optimizeDeps:{noDiscovery:true,include:['phaser']},server:{host:'127.0.0.1',port,strictPort:true,watch:null,hmr:false},logLevel:'error'});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.SMOKE_CHROMIUM_EXECUTABLE_PATH??'/usr/bin/chromium',args:['--disable-gpu','--disable-software-rasterizer']});
const report={seed,speed,scope:'Actual new run, native hero dialog and mouse/touch inputs; Chromium emulation, no fixture or score injection.',cases:[]};
const read=page=>page.evaluate(()=>{const c=window.__harness.game.registry.get('runController');return {state:c.state,journal:c.journal};});
const waitTable=page=>page.waitForFunction(()=>{const g=window.__harness.game,s=g.scene.getScene('game');return g.scene.isActive('game')&&s.ready&&!s.playing&&!s.presentation&&s.cardViews.length&&s.cardViews.every(v=>!v.dealing);});
async function enterStage(page,touch){
 await tapUI(page,'shop','action/start-stage',touch);await waitScene(page,'game');
 const enter=page.getByRole('button',{name:/^进入.*›$/});if(await enter.count()){if(touch)await enter.tap();else await enter.click();}
 await waitTable(page);
}
try {
 for(const phone of [false,true]){
  const name=phone?'phone':'pc',size=phone?{width:390,height:844}:{width:1366,height:768},createdAt=Date.now();
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1,hasTouch:phone,recordVideo:{dir:out,size}});
  const page=await context.newPage(),video=page.video(),row={name,viewport:size,errors:[],marks:{}};report.cases.push(row);page.setDefaultTimeout(30000);page.on('pageerror',e=>row.errors.push(String(e)));
  const mark=key=>{row.marks[key]=(Date.now()-createdAt)/1000;};
  try {
   await page.addInitScript(value=>localStorage.setItem('tangsongpai-presentation-v1',JSON.stringify({speed:value,reducedMotion:false})),speed);
   await page.goto('http://127.0.0.1:'+port+'/?harness=1&seed='+seed);
   mark('title');await chooseCharacter(page,'azao',phone);mark('shop');
   await enterStage(page,phone);mark('first_stage');
   const initial=await read(page);assert.equal(initial.state.seed,seed);assert.ok(first.every(id=>initial.state.handOrder.includes(id)));
   for(const id of first)await tapUI(page,'game','card/'+id,phone);
   mark('first_hand_play');await tapUI(page,'game','action/play',phone);
   await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,initial.state.commandSeq);
   await waitTable(page);const charged=await read(page);assert.equal(charged.state.stage.azaoCharge.charge,1);assert.ok(second.every(id=>charged.state.handOrder.includes(id)));
   for(const id of second)await tapUI(page,'game','card/'+id,phone);
   await tapUI(page,'game','hero/action-shortcut',phone);
   const release=page.getByRole('button',{name:/^本手释放 ×/});if(phone)await release.tap();else await release.click();
   await page.evaluate(()=>{
    const g=window.__harness.game,s=g.scene.getScene('game'),p=window.__naturalVisual={start:performance.now(),rows:[],sourceFrames:[],glowFrames:[],stageFrames:[],effectFrameDeltas:[],unexpectedAuraFrames:0,shots:{}};
    const walk=list=>list.flatMap(o=>[o,...(o.list?walk(o.list):[])]);
    const tick=()=>{
     if(!s.scene.isActive())return;
     const now=performance.now(),objects=walk(s.view.root?.list??[]),visible=objects.filter(o=>['hero/target-current','hero/target-afterglow'].includes(o.name)&&o.active&&o.visible&&(o.getData('stats')?.electricSegments??o.getData('electricSegments')??0)>0);
     if(objects.some(o=>o.name==='score/high-multiplier-aura'&&o.active&&o.visible&&(o.getData('visibleSegments')??0)>0))p.unexpectedAuraFrames++;
     const current=visible.find(o=>o.name==='hero/target-current'),glows=visible.filter(o=>o.name==='hero/target-afterglow'),progress=current?.getData('progress'),ids=s.presentation?.score?.sets?.playedIds??[],boxes=s.landingBoxes(ids.length),settled=ids.flatMap((id,i)=>{const v=s.settledCards.get(id),b=boxes[i];return v?.container.active&&b?[{id,x:v.container.x,y:v.container.y,atDestination:Math.hypot(v.container.x-b.x-b.width/2,v.container.y-b.y-b.height/2)<3}]:[];}),arrived=ids.length===5&&settled.length===5&&settled.every(v=>v.atDestination),stage=objects.find(o=>o.name==='hero/skill-stage'&&o.active&&o.visible&&o.alpha>.1);
     const electric=!!current||glows.length>0;if(electric&&p.wasElectric&&p.lastFrame!==undefined)p.effectFrameDeltas.push(now-p.lastFrame);p.lastFrame=now;p.wasElectric=electric;
     const stageBounds=stage?.getBounds(),overlaps=b=>stageBounds&&b&&stageBounds.x<b.right&&stageBounds.right>b.x&&stageBounds.y<b.bottom&&stageBounds.bottom>b.y,obscuredCards=stageBounds?s.cardViews.filter(v=>v.container.active&&v.container.visible&&overlaps(v.container.getBounds())).map(v=>v.card.id):[],obscuredScore=!!stageBounds&&[s.scoreHeat,s.scoreMult,s.scoreTotal].some(o=>o?.active&&o.visible&&overlaps(o.getBounds()));
     if(stage)p.stageFrames.push({at:now,obscuredCards,obscuredScore});
     if(arrived&&p.arrival===undefined)p.arrival=now;
     if(current)p.sourceFrames.push({at:now,progress});
     if(glows.length)p.glowFrames.push({at:now,arrived,ids:glows.map(o=>o.getData('targetCardId'))});
     if(!p.rows.length||now-p.rows.at(-1).at>=90)p.rows.push({at:now,progress,glows:glows.map(o=>o.getData('targetCardId')),settled,arrived,skillStage:!!stage,obscuredCards,obscuredScore,playing:s.playing});
     const take=key=>{if(!p.shots[key])p.shots[key]=g.canvas.toDataURL('image/png').split('base64,')[1];};
     if(current&&progress>.3&&progress<.55)take('source-mid');
     if(current&&progress>.7)take('source-late');
     if(glows.length>=4&&arrived)take('landed-glow');
     if(glows.length>=4&&arrived&&now-p.arrival>=900)take('landed-glow-after-900ms');
     if(stage)take('skill-stage');
    };
    g.events.on('postrender',tick);p.stop=()=>g.events.off('postrender',tick);
   });
   mark('release_play');await tapUI(page,'game','action/play',phone);
   await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,charged.state.commandSeq);
   const released=await read(page);assert.equal(released.state.lastTrace.azaoCharge.release,true);assert.equal(released.state.lastTrace.sets.activeScoringIds.length,4);
   await waitScene(page,'intermission');mark('stage_cleared');
   const visual=await page.evaluate(()=>{const p=window.__naturalVisual;p.stop();return {rows:p.rows,sourceFrames:p.sourceFrames,glowFrames:p.glowFrames,stageFrames:p.stageFrames,effectFrameDeltas:p.effectFrameDeltas,unexpectedAuraFrames:p.unexpectedAuraFrames,arrival:p.arrival,shots:p.shots};});
   for(const [label,bytes]of Object.entries(visual.shots))await writeFile(resolve(out,name+'-'+label+'.png'),Buffer.from(bytes,'base64'));
   row.visual=visual.rows;row.sourceFrames=visual.sourceFrames;row.glowFrames=visual.glowFrames;row.stageFrames=visual.stageFrames;row.effectFrameDeltas=visual.effectFrameDeltas;row.unexpectedAuraFrames=visual.unexpectedAuraFrames;row.screenshots=Object.keys(visual.shots);row.score=released.state.lastTrace.finalScore;row.targetIds=released.state.lastTrace.sets.activeScoringIds;
   assert.ok(visual.sourceFrames.some(x=>x.progress>.6),'source line progresses after actual play');
   assert.ok(visual.glowFrames.some(x=>x.ids.length>=4&&x.arrived),'real scoring targets glow after five cards actually arrive');
   const firstGlow=visual.glowFrames.find(x=>x.ids.length>=4),arrival=visual.arrival,sourceStart=visual.sourceFrames[0];
   assert.ok(firstGlow&&arrival!==undefined&&sourceStart&&firstGlow.at>=arrival-120&&firstGlow.at-sourceStart.at>=350/speed,'the saved source travels before landed targets light');
   assert.ok(visual.stageFrames.length,'the saved hero event reaches its actual skill stage');
   assert.ok(visual.stageFrames.every(x=>!x.obscuredCards.length&&!x.obscuredScore),'skill stage must not cover any live card or score in any frame');
   assert.equal(visual.unexpectedAuraFrames,0,'this low-multiplier hand must not receive a high-multiplier aura');
   await tapUI(page,'intermission','action/continue-stage',phone);await waitScene(page,'shop');await enterStage(page,phone);mark('second_stage');
   // Complete the actual run through loss using single-card hands, without skipping presentation.
   for(let hand=0;hand<4;hand++){
    const before=await read(page);assert.equal(before.state.phase,'await-input');
    await tapUI(page,'game','card/'+before.state.handOrder[0],phone);await tapUI(page,'game','action/play',phone);
    await page.waitForFunction(seq=>window.__harness.game.registry.get('runController').state.commandSeq>seq,before.state.commandSeq);
    const after=await read(page);
    if(after.state.phase==='run-lost'){await waitScene(page,'intermission');break;}
    assert.equal(after.state.phase,'await-input');await waitTable(page);
   }
   const terminal=await read(page);assert.equal(terminal.state.phase,'run-lost');mark('run_lost');row.commandCount=terminal.state.commandSeq;row.outcome=terminal.state.outcome;assert.deepEqual(row.errors,[]);row.status='PASS';
  }catch(error){row.status='FAIL';row.error=String(error.stack??error);await page.screenshot({path:resolve(out,name+'-failure.png')}).catch(()=>{});throw error;}
  finally {await context.close();const path=await video.path();await rename(path,resolve(out,name+'-full.webm'));await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
  console.log(name+' '+row.status+' '+JSON.stringify(row.marks));
 }
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally {await browser.close();await server.close();await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
