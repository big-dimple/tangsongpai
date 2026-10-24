import type Phaser from 'phaser';

/** The ordinary discard gesture, shared by manual discards and saved skill costs. */
export function discardMotion(container:Phaser.GameObjects.Container,index:number,bottom:number,reduced:boolean):Phaser.Types.Tweens.TweenBuilderConfig {
 return {targets:container,x:container.x-64-index*14,y:bottom+190,angle:-26,scaleX:.82,scaleY:.82,alpha:0,duration:reduced?20:210,delay:reduced?0:index*38,ease:'Cubic.easeIn'};
}
