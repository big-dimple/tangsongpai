import type Phaser from 'phaser';
import type {ScorePreview} from '../domain/scoreR2';
import type {Box} from './layout';
import type {SceneView} from './SceneView';
import {fitScoreLine} from './ScoreTextLayout';
import {heatText,readableFractionText} from './scoreText';
import {PAPER_CSS} from './theme';

export function handForecastCopy(preview:Pick<ScorePreview,'scoreRange'|'base'>,total:string,target:string){
  const low=BigInt(preview.scoreRange.minimum),high=BigInt(preview.scoreRange.maximum);
  const need=BigInt(target)-BigInt(total);
  const span=(a:bigint,b:bigint)=>a===b?heatText(String(a)):heatText(String(a))+'–'+heatText(String(b));
  const result=low>=need?'本手可过关':high>=need?'有机会过关':'还差 '+span(need-high,need-low);
  const {H,M}=preview.base;
  return {range:span(low,high),result,base:'牌型底分 '+readableFractionText(H)+' × '+readableFractionText(M)};
}

/** The 44px undo target shares the draft header. The score animation owns the panel after commit. */
export class HandDraftPanel {
  private readonly clear:Phaser.GameObjects.Rectangle;
  private readonly amount:Phaser.GameObjects.Text;
  private readonly base:Phaser.GameObjects.Text;
  private readonly parts:Phaser.GameObjects.Container;
  constructor(private readonly view:SceneView,private readonly box:Box,bossControl:boolean,onClear:()=>void){
    const first=view.root.length,x=box.x+box.width-(bossControl?210:62);
    this.clear=view.button({x,y:box.y+1,width:54,height:44},'撤选','action/clear-hand',onClear,false);
    this.amount=view.text(0,0,'',18,PAPER_CSS.jade).setName('selection/forecast');
    this.base=view.text(0,0,'',14,PAPER_CSS.mutedInk).setName('selection/base');
    const children=view.root.list.slice(first);
    this.parts=view.add(view.root.scene.add.container().setName('selection/draft-panel'));
    this.parts.add(children);
    this.hide();
  }
  hide():void{this.parts.setVisible(false);this.view.setEnabled(this.clear,false);}
  show(title:Phaser.GameObjects.Text,name:string,roles:string,forecast:string,base:string,landingTop:number,ready:boolean,rescueLabel?:Phaser.GameObjects.Text):void{
    const b=this.box,hit=this.clear.getData('buttonBounds') as Box;
    const titleWidth=Math.max(42,hit.x-b.x-12),wide=titleWidth>=180;
    this.parts.setVisible(true);this.view.setEnabled(this.clear,ready);
    title.setVisible(true).setText(wide?name+' · '+roles:name);
    fitScoreLine(title,{x:b.x+6,y:b.y+3,width:titleWidth,height:22},20);
    this.base.setVisible(true).setText(wide?base:roles);
    fitScoreLine(this.base,{x:b.x+6,y:b.y+26,width:titleWidth,height:17},14);
    const floor=Math.min(b.y+b.height,landingTop);
    this.amount.setVisible(!rescueLabel);
    const amount=rescueLabel??this.amount;amount.setVisible(true).setText(forecast);
    fitScoreLine(amount,{x:b.x+6,y:b.y+45,width:b.width-12,height:Math.max(15,Math.min(32,floor-b.y-45))},b.height<90?16:22);
  }
}
