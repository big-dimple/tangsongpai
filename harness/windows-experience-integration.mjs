import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

// Reuse the exact source driver and its score/state assertions. Only observe
// the real audio graph and calls; do not alter the run or audio policy.
const out=process.env.OWNED_MOTION_OUT??'shots/windows-experience-integration-20261017/joint';
process.env.OWNED_MOTION_OUT=out;
process.env.OWNED_MOTION_PHRASE='1';
process.env.OWNED_MOTION_STRIKE='1';
process.env.OWNED_MOTION_DIRECTED='1';
process.env.OWNED_MOTION_CASES='pc,cancel-rebound';
await mkdir(out,{recursive:true});
const rows=[];
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
  const browser=await launch({...options,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async options=>{
    const context=await newContext(options);
    await context.addInitScript(()=>{
      const links=new WeakMap(),connect=AudioNode.prototype.connect,disconnect=AudioNode.prototype.disconnect;
      AudioNode.prototype.connect=function(destination,...args){
        const result=connect.call(this,destination,...args);
        if(!links.has(this))links.set(this,new Set());
        links.get(this).add(destination);return result;
      };
      AudioNode.prototype.disconnect=function(...args){
        const result=disconnect.apply(this,args);
        if(!args.length)links.delete(this);else links.get(this)?.delete(args[0]);
        return result;
      };
      window.__jointMusic={calls:[]};
      window.__jointMusic.observe=audio=>{
        if(audio.__jointObserved)return;audio.__jointObserved=true;
        for(const method of ['scoreImpact','scoreRebound']){
          const original=audio[method].bind(audio);
          audio[method]=(...args)=>{
            const result=original(...args),g=audio.gains;
            const has=(a,b)=>!!a&&!!b&&!!links.get(a)?.has(b);
            window.__jointMusic.calls.push({method,eventId:args[1],kind:method==='scoreImpact'?args[2]:'rebound',at:performance.now(),dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id||d.className),slots:audio.musicSlots.length,track:audio.activeMusic?.track?.runtimePath,musicPaused:audio.activeMusic?.element.paused,musicRest:!!audio.musicRest,scoreVoices:[...audio.voices].filter(v=>v.scoreAccent).length,graph:{musicDirect:has(g?.music,g?.master),sfxDirect:has(g?.sfx,g?.master),uiDirect:has(g?.ui,g?.master)}});
            return result;
          };
        }
      };
    });
    const newPage=context.newPage.bind(context);
    context.newPage=async()=>{
      const page=await newPage(),goto=page.goto.bind(page);
      page.goto=async(...args)=>{
        const result=await goto(...args);
        if(String(args[0]).includes('127.0.0.1:5596')){
          await page.waitForFunction(()=>window.__harness?.game?.scene?.getScenes(true).some(s=>s.audio));
          await page.evaluate(()=>window.__jointMusic.observe(window.__harness.game.scene.getScenes(true).find(s=>s.audio).audio));
        }
        return result;
      };
      return page;
    };
    const close=context.close.bind(context);
    context.close=async()=>{
      for(const page of context.pages()){
        const row=await page.evaluate(()=>({url:location.href,calls:window.__jointMusic?.calls??[]})).catch(()=>undefined);
        if(row?.calls.length)rows.push(row);
      }
      return close();
    };
    return context;
  };
  return browser;
};
await import('./owned-joker-score-motion.mjs');
const source=JSON.parse(await readFile(out+'/report.json','utf8'));
const report={productHead:source.head,browser:source.browser,scope:'One compiled production app with existing public checkpoint import and native inputs. Controlled frozen pre-exile inventory, not natural acquisition or a current-new-Su-Shi test. Source assertions retained; SSR fixture startup disables discovery/HMR/watching as in the existing Windows integration driver. Actual mixed canvas+WebAudio recordings in each case. No subjective listening or physical-device approval.',cases:source.cases.map((c,i)=>({key:c.key,status:c.status,stateExact:c.stateExact,directedSources:c.directed?.sources.length,polyFlights:c.directed?.polyFlights.length,cancelCleanup:c.cancelCleanup,cancelBoundary:c.cancelBoundary,...rows[i]})),sourceHashes:source.sources};
for(const file of ['src/audio/AudioEngine.ts','src/main.ts','src/game/GameScene.ts','src/game/ShopScene.ts','src/game/StageImageWarmup.ts','public/assets/audio/bgm/manifest.json','harness/windows-experience-integration.mjs'])report.sourceHashes[file]=createHash('sha256').update((await readFile(file,'utf8')).replaceAll('\r\n','\n')).digest('hex');
try{
  assert.equal(source.status,'PASS');assert.equal(rows.length,2);
  assert.equal(report.cases[0].directedSources,13);assert.ok(report.cases[0].polyFlights>0);
  for(const row of report.cases){
    assert.equal(row.status,'PASS');assert.equal(row.stateExact,true);assert.ok(row.calls.length>0);
    for(const c of row.calls){
      assert.deepEqual(c.graph,{musicDirect:true,sfxDirect:true,uiDirect:true});
      assert.ok(c.slots<=2);assert.ok(c.scoreVoices<=6);
      assert.match(c.track,/assets\/audio\/bgm\/user-20261018\/(go-cake|vsboss)\.(ogg|mp3)/);assert.ok(!c.musicPaused||c.musicRest);
    }
  }
  const canceled=report.cases[1];assert.equal(canceled.cancelBoundary.phase,'rebound');
  assert.ok(canceled.calls.some(c=>c.dialogs.includes('run-menu-modal')),'music and real score SFX stay direct while the native menu is open');
  assert.ok(canceled.calls.every(c=>c.at<=canceled.cancelCleanup.at),'no main or rebound call after native cancellation');
  assert.deepEqual([canceled.cancelCleanup.scoreVoices,canceled.cancelCleanup.strikes,canceled.cancelCleanup.snapshots],[0,0,0]);
  report.status='PASS';
}catch(error){report.status='FAIL';report.failure=String(error.stack);process.exitCode=1;}
await writeFile(out+'/joint-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,cases:report.cases.map(c=>({key:c.key,sources:c.directedSources,polyFlights:c.polyFlights,calls:c.calls?.length,lowCalls:c.calls?.filter(x=>x.depth>0&&x.cutoff<500).length})),failure:report.failure,out}));
