import Phaser from 'phaser';
import {loadArtTexture} from './game/ArtTextureLoading';
import {jokerArtPreviewUrl} from './game/jokerArt';

class Preview extends Phaser.Scene {
  constructor(){super('preview');}
  create():void {
    const url=jokerArtPreviewUrl('e11')!;
    const controller=new AbortController();
    this.events.once('shutdown',()=>controller.abort());
    this.load.image('e11-static',url);
    this.load.once('complete',()=>this.add.image(420,210,'e11-static').setDisplaySize(160,200));
    this.load.start();
    void loadArtTexture(this.game,'p08-joker-e11',url,controller.signal).then(()=>{
      this.add.image(180,210,'p08-joker-e11').setDisplaySize(160,200);
    }).catch(()=>this.add.text(105,200,'卡面加载失败',{color:'#b8473a'}));
    this.add.text(112,42,'牌桌动画',{color:'#26313a',fontSize:'20px'});
    this.add.text(352,42,'原静态卡面',{color:'#26313a',fontSize:'20px'});
  }
}
new Phaser.Game({type:Phaser.AUTO,parent:'preview',width:600,height:340,backgroundColor:'#e9deca',scene:[Preview],audio:{noAudio:true}});
