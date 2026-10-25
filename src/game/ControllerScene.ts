import type Phaser from 'phaser';
import type {PadAction} from '../platform/GamepadInput';
import type {FocusTarget} from './ControllerFocus';

export interface ControllerTarget extends FocusTarget {
  activate:()=>void;detail?:()=>void;focus?:()=>void;blur?:()=>void;primary?:boolean;
}
export interface ControllerScene {
  targets:()=>ControllerTarget[];
  action?:(action:PadAction,targetId:string|undefined)=>boolean|string;
  scroll?:(delta:number)=>void;
  busy?:()=>boolean;
}
const scenes=new WeakMap<Phaser.Scene,ControllerScene>();
export function registerControllerScene(scene:Phaser.Scene,provider:ControllerScene):()=>void {
  scenes.set(scene,provider);return ()=>{if(scenes.get(scene)===provider)scenes.delete(scene);};
}
export const controllerScene=(scene:Phaser.Scene):ControllerScene|undefined=>scenes.get(scene);
