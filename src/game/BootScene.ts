import {LoadingScreen,prepareDestinationBackground} from './LoadingScreen';
import Phaser from 'phaser';
import {gameSession} from './session';
import {P00_ASSETS,assetUrl} from './theme';

/** Paper and immediate selection art only; the card catalog and music never gate entry. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  private loading?:LoadingScreen;
  private generation=0;
  preload(): void {
    this.generation++;this.loading=new LoadingScreen('为你铺开这一局',true);const loading=this.loading,loaded=new Set<string>(),failed=new Set<string>();const refresh=()=>loading.base(loaded.size,P00_ASSETS.length,failed.size);
    const complete=(key:string)=>{loaded.add(key);failed.delete(key);refresh();},failure=(file:Phaser.Loader.File)=>{if(!loaded.has(file.key))failed.add(file.key);refresh();console.warn(`[boot] 资源暂未就绪，将自动恢复: ${file.key} -> ${file.url}`);};
    this.load.on('filecomplete',complete);this.load.on('loaderror',failure);refresh();
    this.events.once('shutdown',()=>{this.generation++;this.load.off('filecomplete',complete);this.load.off('loaderror',failure);loading.close();if(this.loading===loading)this.loading=undefined;});
    // File-local settings are required: Phaser's image defaults otherwise override loader.timeout with 0.
    const svgXHR:Phaser.Types.Loader.XHRSettingsObject={responseType:'text',timeout:5000};
    this.load.maxRetries=0;
    for(const asset of P00_ASSETS)this.load.svg(asset.key,assetUrl(asset.path),{width:asset.width,height:asset.height},svgXHR);
    // D44: the paper stage is procedural; the former heavy timber backdrop is not preloaded.
  }

  create(): void {
    const generation=this.generation,loading=this.loading;
    // Old-run recovery is useful to the title menu but must never own the
    // first navigation frame. Let it finish in the background so a blocked
    // IndexedDB read cannot leave the static opening page on screen forever.
    void gameSession().initialize().catch(error=>console.warn('[boot] 存档恢复将在后台重试',error));
    void prepareDestinationBackground(this.game,'title').catch(error=>console.warn('[boot] 首屏素材将在后台重试',error));
    const query=new URLSearchParams(location.search),seed=query.get('seed')??undefined;
    if(generation!==this.generation)return;
    this.loading=undefined;loading?.close();
    // Phaser marks a scene active only after create() returns, so do not use
    // isActive() as a synchronous guard here. The generation check above still
    // prevents a late create from restarting a shut-down boot scene.
    this.scene.start('title',{seed});
  }
}
