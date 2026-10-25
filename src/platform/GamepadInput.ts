export type PadDirection='left'|'right'|'up'|'down';
export type PadAction=PadDirection|'confirm'|'back'|'play'|'discard'|'previous'|'next'|'sort-rank'|'sort-suit'|'detail'|'menu';
export interface PadSnapshot {
  index:number;id:string;connected:boolean;mapping:string;
  buttons:readonly {pressed:boolean;value:number}[];axes:readonly number[];
}
const buttons:readonly [number,PadAction][]=[
  [9,'menu'],[1,'back'],[0,'confirm'],[2,'play'],[3,'discard'],
  [4,'previous'],[5,'next'],[6,'sort-rank'],[7,'sort-suit'],[8,'detail'],
];
const down=(pad:PadSnapshot,index:number)=>!!pad.buttons[index]?.pressed||(pad.buttons[index]?.value??0)>.55;
export function controllerButtonLabels(id:string){
  if(/dualsense|dualshock|playstation|sony|054c/i.test(id))return {confirm:'×',back:'○',play:'□',discard:'△',shoulders:'L1/R1',triggers:'L2/R2',detail:'Share/Create',menu:'Options'};
  if(/nintendo|pro controller|joy-con|057e/i.test(id))return {confirm:'B',back:'A',play:'Y',discard:'X',shoulders:'L/R',triggers:'ZL/ZR',detail:'−',menu:'+'};
  return {confirm:'A',back:'B',play:'X',discard:'Y',shoulders:'LB/RB',triggers:'LT/RT',detail:'View',menu:'≡'};
}

/** Standard browser mapping. Only navigation repeats; reconnect/focus requires neutral controls. */
export class GamepadInput {
  private identity='';
  private held=new Set<PadAction>();
  private armed=false;
  private direction?:PadDirection;
  private repeatAt=0;
  get ready():boolean {return this.armed;}
  reset():void {this.identity='';this.held.clear();this.armed=false;this.direction=undefined;this.repeatAt=0;}
  sample(pad:PadSnapshot|undefined,now:number):PadAction|undefined {
    if(!pad?.connected||pad.mapping!=='standard'){this.reset();return;}
    const identity=pad.index+'/'+pad.id;
    if(identity!==this.identity){this.reset();this.identity=identity;}
    const held=new Set<PadAction>(buttons.filter(([index])=>down(pad,index)).map(([,action])=>action));
    // Hysteresis keeps a resting or slightly noisy stick from moving the focus.
    const x=Number.isFinite(pad.axes[0])?pad.axes[0]:0,y=Number.isFinite(pad.axes[1])?pad.axes[1]:0;
    const analog:PadDirection=Math.abs(x)>=Math.abs(y)?x<0?'left':'right':y<0?'up':'down';
    const threshold=this.direction===analog ? .35 : .55;
    let direction:PadDirection|undefined=down(pad,14)?'left':down(pad,15)?'right':down(pad,12)?'up':down(pad,13)?'down':
      Math.max(Math.abs(x),Math.abs(y))>=threshold?(Math.abs(x)>=Math.abs(y)?x<0?'left':'right':y<0?'up':'down'):undefined;
    if(down(pad,14)&&down(pad,15)||down(pad,12)&&down(pad,13))direction=undefined;
    if(direction)held.add(direction);
    if(!this.armed){this.armed=held.size===0&&pad.axes.slice(0,4).every(value=>Number.isFinite(value)&&Math.abs(value)<.35);this.held=held;this.direction=direction;return;}
    const action=buttons.map(([,value])=>value).find(value=>held.has(value)&&!this.held.has(value));
    let navigation:PadDirection|undefined;
    if(direction!==this.direction){if(direction)navigation=direction;this.repeatAt=now+350;}
    else if(direction&&now>=this.repeatAt){navigation=direction;this.repeatAt=now+110;}
    this.held=held;this.direction=direction;
    // Simultaneous buttons cannot select and submit a hand in a single poll.
    return action??navigation;
  }
}
