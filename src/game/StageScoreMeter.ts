import type Phaser from 'phaser';
import type {SceneView} from './SceneView';
import {heatText} from './scoreText';

export function stageScoreBands(total:string,target:string,last?:string) {
  const score=BigInt(total),goal=BigInt(target),hand=last===undefined?0n:BigInt(last);
  const scale=score>goal?score:goal;
  const part=(n:bigint)=>scale>0n?Number(n*10000n/scale)/10000:0;
  const prior=hand<=score?score-hand:score;
  return {prior:part(prior),filled:part(score),goal:part(goal),before:prior.toString(),gap:(goal>score?goal-score:0n).toString()};
}

/** Jade is previous hands, cinnabar the recorded last hand, and the tick the stage target. */
export function drawScoreLedger(scene:Phaser.Scene,view:SceneView,x:number,y:number,width:number,total:string,target:string,last?:string):number {
  const bands=stageScoreBands(total,target,last),track=view.add(scene.add.graphics().setName('result/score-meter'));
  track.fillStyle(0x130f16).fillRect(x,y,width,7);
  if(bands.prior>0)track.fillStyle(0xd8b46c).fillRect(x,y,width*bands.prior,7);
  if(bands.filled>bands.prior)track.fillStyle(0xdc5e4b).fillRect(x+width*bands.prior,y,width*(bands.filled-bands.prior),7);
  const mark=Math.max(x+1,Math.min(x+width-1,x+width*bands.goal));
  track.lineStyle(2,0xf5deb0).lineBetween(mark,y-3,mark,y+10);
  const label=last!==undefined?'此前 '+heatText(bands.before)+'　末手 +'+heatText(last):'累计 '+heatText(total);
  const copy=view.text(x,y+12,label,14,'#c8bdb2',width).setName('result/stage-credit').setData('before',bands.before).setData('last',last);
  return copy.y+copy.height;
}
