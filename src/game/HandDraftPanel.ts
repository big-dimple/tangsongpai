import type Phaser from 'phaser';
import type {ScorePreview} from '../domain/scoreR2';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {fitScoreLine} from './ScoreTextLayout';
import {heatText,readableFractionText} from './scoreText';
import {PAPER_CSS, PAPER_THEME} from './theme';

export function handForecastCopy(preview:Pick<ScorePreview,'scoreRange'|'breakdown'>,total:string,target:string){
  const low=BigInt(preview.scoreRange.minimum),high=BigInt(preview.scoreRange.maximum);
  const goal=BigInt(target),banked=BigInt(total),need=goal-banked;
  // Do the division before converting to screen coordinates. Save values can exceed Number's range.
  const position=(value:bigint)=>goal<=0n||value>=goal?1:Number(value*10000n/goal)/10000;
  const span=(a:bigint,b:bigint)=>a===b?heatText(String(a)):heatText(String(a))+'–'+heatText(String(b));
  const result=low>=need?'本手可过关':high>=need?'有机会过关':'还差 '+span(need-high,need-low);
  const {H,M}=preview.breakdown.minimum;
  return {range:span(low,high),result,factors:(low===high?'':'保底 ')+'筹码 '+readableFractionText(H)+' × 倍率 '+readableFractionText(M),
    projection:{banked:position(banked),minimum:position(banked+low),maximum:position(banked+high)}};
}

interface DraftReadout {
  name:string;
  roles:string;
  amount:string;
  forecast?:ReturnType<typeof handForecastCopy>;
  landingTop:number;
  ready:boolean;
  rescueLabel?:Phaser.GameObjects.Text;
}

/** The 44px undo target shares the draft header. The score animation owns the panel after commit. */
export class HandDraftPanel {
  private readonly clear:Phaser.GameObjects.Rectangle;
  private readonly amount:Phaser.GameObjects.Text;
  private readonly base:Phaser.GameObjects.Text;
  private readonly outcome:Phaser.GameObjects.Text;
  private readonly track:Phaser.GameObjects.Graphics;
  private readonly parts:Phaser.GameObjects.Container;
  constructor(private readonly view:SceneView,private readonly box:Box,bossControl:boolean,onClear:()=>void){
    const first=view.root.length,x=box.x+box.width-(bossControl?210:62);
    this.clear=view.button({x,y:box.y+1,width:54,height:44},'撤选','action/clear-hand',onClear,false);
    this.amount=view.text(0,0,'',24,'#963e2d').setFontStyle('bold').setName('selection/forecast');
    this.base=view.text(0,0,'',14,PAPER_CSS.mutedInk).setName('selection/base');
    this.outcome=view.text(0,0,'',14,PAPER_CSS.jade).setName('selection/projected-gap');
    this.track=view.add(view.root.scene.add.graphics().setName('selection/goal-projection'));
    const children=view.root.list.slice(first);
    this.parts=view.add(view.root.scene.add.container().setName('selection/draft-panel'));
    this.parts.add(children);
    this.hide();
  }
  hide():void{this.parts.setVisible(false);this.view.setEnabled(this.clear,false);}
  showExchange(title:Phaser.GameObjects.Text,hearts:number,selected:number,selectedHearts:number,ready:boolean,landingTop:number):void{
    const kept=hearts-selectedHearts;
    const amount=selectedHearts?`收回 ${selectedHearts} 张红桃`:selected?`待换 ${selected} 张 · 留住 ${kept} 张红桃`:`再来 ${5-kept} 张红桃就成花`;
    this.show(title,{name:'红桃同花',roles:`留手 ${kept} / 5`,amount,landingTop,ready:ready&&selected>0});
    const symbols=Array.from({length:5},(_,i)=>i<kept?'♥':'♡').join('  ');
    this.base.setText(symbols).setFontSize(16).setColor('#a94232');
    this.amount.setColor(selectedHearts?'#943b2b':PAPER_CSS.jade);
  }
  show(title:Phaser.GameObjects.Text,draft:DraftReadout):void{
    const {name,roles,amount,forecast,landingTop,ready,rescueLabel}=draft;
    this.base.setColor(PAPER_CSS.mutedInk);this.amount.setColor('#963e2d');
    const b=this.box,hit=this.clear.getData('buttonBounds') as Box;
    const pad=12,x=b.x+pad,width=b.width-2*pad;
    const titleWidth=Math.max(42,hit.x-x-4),wide=titleWidth>=180;
    // A short portrait landing area can borrow the lower half of the draft panel.
    // On desktop the played cards are beside it and consume none of its height.
    const height=this.view.layout.mode==='portrait'?Math.min(b.height,landingTop-b.y):b.height;
    const roomy=height>=90&&!!forecast;
    const line=(text:Phaser.GameObjects.Text,copy:string,y:number,w:number,h:number,size:number,numeric=false)=>{
      text.setText(copy).setVisible(true);
      fitScoreLine(text,{x,y:b.y+y,width:w,height:h},size,numeric);
      text.setOrigin(0,0).setX(x);
    };
    this.parts.setVisible(true);this.view.setEnabled(this.clear,ready);
    line(title,wide?name+' · '+roles:name,4,titleWidth,22,20);
    line(this.base,wide?(forecast?.factors??roles):roles,26,titleWidth,18,14);
    this.amount.setVisible(!rescueLabel);
    const amountY=roomy?46:44,amountHeight=roomy?Math.min(46,height-76):Math.max(16,Math.min(30,height-amountY));
    line(rescueLabel??this.amount,roomy||!forecast?amount:amount+' · '+forecast.result,amountY,width,amountHeight,roomy?32:18,true);
    this.outcome.setVisible(roomy);
    this.track.clear().setVisible(roomy);
    if(!roomy||!forecast)return;
    line(this.outcome,forecast.result,height-30,width,17,14,true);
    const y=b.y+height-10,{banked,minimum,maximum}=forecast.projection;
    this.track.fillStyle(0xd7cdba).fillRect(x,y,width,4);
    if(banked>0)this.track.fillStyle(PAPER_THEME.jade).fillRect(x,y,width*banked,4);
    if(minimum>banked)this.track.fillStyle(0xa44837).fillRect(x+width*banked,y,width*(minimum-banked),4);
    if(maximum>minimum){
      // Only the possible gain is dotted. It is never added to the banked HUD.
      for(let left=x+width*minimum;left<x+width*maximum;left+=5){
        this.track.fillStyle(0xa44837).fillRect(left,y,Math.min(2,x+width*maximum-left),4);
      }
    }
    this.track.lineStyle(1,0x665330).lineBetween(x+width,y-2,x+width,y+6);
  }
}
