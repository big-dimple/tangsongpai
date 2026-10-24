import {waitScene} from './ui.mjs';
/** Follow the real stage-ready directory; observers never enter or draw on the player's behalf. */
export async function enterCurrentStage(page,touch=false){
 await waitScene(page,'game');
 try {
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController').state.phase==='await-input'||!!document.querySelector('dialog.blind-select-dialog[data-context="entrance"][open]'));
  const directory=page.locator('dialog.blind-select-dialog[data-context="entrance"][open]');
  if(await directory.count()){
   const start=directory.locator('.dialog-actions > .dialog-primary');
   if(touch)await start.tap();else await start.click();
  }
  await page.waitForFunction(()=>window.__harness.game.registry.get('runController').state.phase==='await-input'&&window.__harness.game.scene.getScene('game').cardViews.length>0);
 }catch(error){
  const snapshot=await page.evaluate(()=>({phase:window.__harness?.game.registry.get('runController')?.state.phase,waitingForStage:window.__harness?.game.scene.getScene('game').waitingForStage,cards:window.__harness?.game.scene.getScene('game').cardViews.length,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>({className:d.className,context:d.dataset.context}))})).catch(()=>({unavailable:true}));
  error.message+=' [stage-entry '+JSON.stringify(snapshot)+']';throw error;
 }
}
