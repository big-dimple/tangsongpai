import {LoadingScreen,prepareDestinationBackground} from './LoadingScreen';
import Phaser from 'phaser';
import {AudioEngine,type OpeningSoundProgress} from '../audio/AudioEngine';
import {gameSession} from './session';
import {P00_ASSETS,assetUrl} from './theme';
import {prepareTitleEnsembleImages,type EnsemblePreparation} from './TangSongEntranceBurst';

/** Prepare the paper, the visible title reveal and a small first-interaction sound set. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  private loading?:LoadingScreen;
  private generation=0;
  private opening?:Promise<void>;
  preload(): void {
    const generation=++this.generation;
    const loading=this.loading=new LoadingScreen('为你铺开这一局',true);
    const loaded=new Set<string>(),failed=new Set<string>();
    let sound:OpeningSoundProgress={loaded:0,total:0,status:'loading'};
    let portraits:EnsemblePreparation={loaded:0,total:0,failed:0,status:'loading'};
    const refresh=()=>{
      if(generation!==this.generation||this.loading!==loading)return;
      const complete=sound.status!=='loading'&&portraits.status!=='loading';
      const total=P00_ASSETS.length+sound.total+portraits.total;
      const count=loaded.size+sound.loaded+portraits.loaded;
      const errors=failed.size+portraits.failed;
      const label=complete&&(sound.status==='degraded'||portraits.status==='degraded'||errors)
        ?'部分资源稍后继续准备':'准备纸面、群英与常用声音';
      loading.initial(count,total,errors,complete,label);
    };
    const complete=(key:string)=>{loaded.add(key);failed.delete(key);refresh();};
    const failure=(file:Phaser.Loader.File)=>{if(!loaded.has(file.key))failed.add(file.key);refresh();console.warn(`[boot] 资源暂未就绪，将自动恢复: ${file.key} -> ${file.url}`);};
    this.load.on('filecomplete',complete);this.load.on('loaderror',failure);
    this.events.once('shutdown',()=>{
      this.generation++;this.load.off('filecomplete',complete);this.load.off('loaderror',failure);
      if(this.loading===loading){loading.close();this.loading=undefined;}
    });
    // Decode without resuming a suspended AudioContext. A real gesture still owns unlock.
    const audio=AudioEngine.shared.prepareOpeningSounds(p=>{sound=p;refresh();});
    const images=loading.host.dataset.loadMotion==='reduce'
      ?Promise.resolve().then(()=>{portraits={loaded:0,total:0,failed:0,status:'ready'};refresh();})
      :prepareTitleEnsembleImages(p=>{portraits=p;refresh();});
    this.opening=Promise.all([audio,images]).then(()=>undefined);
    refresh();
    // File-local settings are required: Phaser's image defaults override loader.timeout with 0.
    const svgXHR:Phaser.Types.Loader.XHRSettingsObject={responseType:'text',timeout:5000};
    this.load.maxRetries=0;
    for(const asset of P00_ASSETS)this.load.svg(asset.key,assetUrl(asset.path),{width:asset.width,height:asset.height},svgXHR);
  }

  create(): void {
    const generation=this.generation,loading=this.loading;
    void gameSession().initialize().catch(error=>console.warn('[boot] 存档恢复将在后台重试',error));
    void (async()=>{
      await this.opening;
      // Let a fast cold load finish its first visual beat; this never fabricates readiness.
      const delay=document.hidden?0:Math.max(60,700-performance.now());
      await new Promise(resolve=>setTimeout(resolve,delay));
      if(generation!==this.generation||!loading)return;
      void prepareDestinationBackground(this.game,'title').catch(error=>console.warn('[boot] 首屏素材将在后台重试',error));
      const query=new URLSearchParams(location.search),seed=query.get('seed')??undefined;
      // The title owns the loading dialog until its home and scroll have mounted,
      // avoiding a blank frame and a replay of the paper's entry animations.
      this.loading=undefined;
      let released=false;
      const release=()=>{if(released)return;released=true;clearTimeout(fallback);this.game.events.off('destroy',release);loading.close();};
      const fallback=setTimeout(release,3000);
      this.game.events.once('destroy',release);
      this.scene.start('title',{seed,onReady:release});
    })();
  }
}
