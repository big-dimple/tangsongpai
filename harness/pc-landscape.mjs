/** Real UI smoke: no state mutation. Captures the same seeded decisions at each viewport. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {chooseCharacter,tapUI,buyOffer,waitScene} from './ui.mjs';
const url=process.env.PC_URL??'http://127.0.0.1:5173',out=process.env.PC_OUT??'shots/pc-landscape/after';
const sizes=(process.env.PC_SIZES??'1920x1080,1920x924,1366x768,390x844').split(',').map(s=>{const [width,height]=s.split('x').map(Number);return {width,height};});
await mkdir(out,{recursive:true});
const report={url,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{encoding:'utf8'}).trim(),seed:'r03-651',method:'Natural new run. Actual browser inputs only; screenshots use reduced motion.',cases:[]};
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
try{for(const viewport of sizes){
 const touch=viewport.width<700,p=await browser.newPage({viewport,hasTouch:touch,deviceScaleFactor:1,reducedMotion:'reduce'}),row={viewport,errors:[],screenshots:[],hands:[]};report.cases.push(row);p.setDefaultTimeout(30000);p.on('pageerror',e=>row.errors.push(e.message));
 const state=()=>p.evaluate(()=>window.__harness.game.registry.get('runController').state);
 const shot=async name=>{await p.waitForTimeout(350);const file=`${name}-${viewport.width}x${viewport.height}.png`;await p.screenshot({path:out+'/'+file});row.screenshots.push(file);};
 try{
  await p.goto(url+'/?harness=1&seed=r03-651');await chooseCharacter(p,'erxiang',touch);await shot('shop-empty');
  const before=await state(),offer=before.shop.offers.find(o=>o.definitionId==='mantangcai');assert.ok(offer,'seed has pair support');await buyOffer(p,offer.offerId,touch);await p.waitForFunction(()=>window.__harness.game.registry.get('runController').state.jokers.length===1);const bought=await state();assert.equal(bought.gold,before.gold-4);row.purchase={goldBefore:before.gold,goldAfter:bought.gold,jokers:bought.jokers.length};await shot('shop-owned');
  await tapUI(p,'shop','action/start-stage',touch);await waitScene(p,'game');await p.getByRole('button',{name:'进入暖场 ›',exact:true}).click();await p.waitForFunction(()=>window.__harness.game.scene.getScene('game').cardViews.length===8);await shot('table');
  for(let turn=0;turn<5;turn++){
   const s=await state();const cards=s.handOrder.map(id=>s.deckInstances.find(c=>c.id===id));let picked;
   for(const c of cards){const pair=cards.filter(x=>x.rank===c.rank);if(pair.length>=2){picked=pair.slice(0,2).map(x=>x.id);break;}}
   picked??=cards.sort((a,b)=>b.rank-a.rank).slice(0,5).map(c=>c.id);
   for(const id of picked)await tapUI(p,'game','card/'+id,touch);if(!turn)await shot('table-selected');
   await tapUI(p,'game','action/play',touch);const confirm=p.getByRole('button',{name:'继续出牌',exact:true});if(await confirm.count())await confirm.click();
   if(!turn){
    await p.waitForFunction(()=>{const s=window.__harness.game.scene.getScene('game');return s.presentation&&s.scoreTotal.visible&&/\d/.test(s.scoreTotal.text);});
    row.liveScore=await p.evaluate(()=>{const s=window.__harness.game.scene.getScene('game');return {heat:s.scoreHeat.text,multiplier:s.scoreMult.text,total:s.scoreTotal.text};});
    const file=`table-scoring-${viewport.width}x${viewport.height}.png`;await p.screenshot({path:out+'/'+file});row.screenshots.push(file);
   }
   await p.waitForFunction(()=>window.__harness.game.scene.isActive('intermission')||(!window.__harness.game.scene.getScene('game').playing&&window.__harness.game.registry.get('runController').state.phase==='await-input'));
   const after=await state();row.hands.push({selected:picked,score:after.lastTrace?.finalScore,heat:after.stage?.heat,phase:after.phase});if(await p.evaluate(()=>window.__harness.game.scene.isActive('intermission')))break;
  }
  await waitScene(p,'intermission');await shot('result');const settled=await state();assert.equal(settled.stage.heat,'584');assert.equal(settled.lastTrace.finalScore,'290');
  row.layout=await p.evaluate(()=>({scrollX:document.documentElement.scrollWidth-innerWidth,scrollY:document.documentElement.scrollHeight-innerHeight,canvas:window.__harness.game.canvas.getBoundingClientRect().toJSON()}));assert.equal(row.layout.scrollX,0);assert.equal(row.layout.scrollY,0);
  await tapUI(p,'intermission','action/continue-stage',touch);await waitScene(p,'shop');row.continued=true;assert.deepEqual(row.errors,[]);row.status='PASS';console.log('PASS',viewport);
 }catch(e){row.status='FAIL';row.error=e.stack;await shot('failure');throw e;}finally{await p.close();}
}}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
