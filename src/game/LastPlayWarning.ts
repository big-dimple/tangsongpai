import type {R2RunState} from '../domain/r2Run';
import type {Box} from './layout';

/** Read committed stage facts only; this presentation never changes a command. */
export function lastPlayWarning(run:Pick<R2RunState,'runId'|'phase'|'stage'>,playing:boolean):{key:string;message:string}|undefined {
 const stage=run.stage;
 if(playing||!['await-input','pending-refill'].includes(run.phase)||!stage||stage.handsLeft!==1||stage.clearId!==null||stage.skipResult!==null)return;
 return {key:run.runId+'/'+stage.index,message:'仅剩最后1次出牌'};
}
/** B09 is the only Boss that reduces the initial number of plays. */
export function reducedPlayEntry(run:Pick<R2RunState,'phase'|'stage'>):string|undefined {
 const stage=run.stage;
 if(run.phase!=='await-input'||!stage||stage.playIndex!==0||stage.boss?.definitionId!=='B09')return;
 return '快板 · 本场'+stage.initialHands+'次出牌（−1）';
}

/** A restored one is already visible; a real increase rearms the next fall to one. */
export class LastPlayWarningTracker {
 private key='';
 private remaining:number|undefined;
 seed(run:Pick<R2RunState,'runId'|'phase'|'stage'>):void {
  this.key=run.stage?run.runId+'/'+run.stage.index:'';this.remaining=run.stage?.handsLeft;
 }
 observe(run:Pick<R2RunState,'runId'|'phase'|'stage'>,playing:boolean):{warning:ReturnType<typeof lastPlayWarning>;highlight:boolean} {
  if(playing)return {warning:undefined,highlight:false};
  const stage=run.stage,key=stage?run.runId+'/'+stage.index:'';
  if(!stage||!['await-input','pending-refill'].includes(run.phase)){this.key='';this.remaining=undefined;return {warning:undefined,highlight:false};}
  if(key!==this.key){this.key=key;this.remaining=stage.handsLeft;return {warning:lastPlayWarning(run,false),highlight:false};}
  const warning=lastPlayWarning(run,false),highlight=run.phase==='await-input'&&!!warning&&this.remaining!==undefined&&this.remaining>1;
  this.remaining=stage.handsLeft;return {warning,highlight};
 }
}

const overlaps=(a:Box,b:Box)=>a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height;
/** Never use an occupied or clipped rectangle for a transient presentation. */
export function lastPlayCuePlacement(width:number,height:number,score:Box,played:Box,obstacles:readonly Box[],mobile:boolean):Box|undefined {
 const w=Math.min(mobile?width*.85:360,mobile?width*.85:score.width),h=44;
 if(w<(mobile?200:280))return;
 const candidates=[{x:score.x,y:score.y+score.height+2,width:w,height:h},{x:score.x,y:score.y-h-6,width:w,height:h},{x:played.x,y:played.y+played.height+6,width:w,height:h}];
 return candidates.find(c=>c.x>=0&&c.y>=0&&c.x+c.width<=width&&c.y+c.height<=height&&!obstacles.some(b=>overlaps(c,b)));
}

/** A stage announcement may use the empty played area, but never an input hit. */
export function bossRuleCuePlacement(width:number,height:number,score:Box,played:Box,obstacles:readonly Box[],mobile:boolean,cueHeight:number):Box|undefined {
 const w=Math.min(mobile?width*.85:360,mobile?width*.85:played.width),h=cueHeight;
 if(w<(mobile?200:280)||h<44||h>128)return;
 const candidates=[{x:score.x,y:score.y+score.height+2,width:w,height:h},{x:played.x+(played.width-w)/2,y:played.y+8,width:w,height:h},{x:played.x,y:played.y+played.height+6,width:w,height:h}];
 return candidates.find(c=>c.x>=0&&c.y>=0&&c.x+c.width<=width&&c.y+c.height<=height&&!obstacles.some(b=>overlaps(c,b)));
}
