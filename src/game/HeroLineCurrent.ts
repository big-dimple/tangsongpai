import type Phaser from 'phaser';
import {clearInkRuns,type InkBox,type InkPoint} from './AssistInkGeometry';
import {drawHeroFuse,type FuseRoute} from './HeroFuse';

export interface SourceElectricCue {burstSegments:number;fallbackSegments:number}
export interface SourceElectricDecision {route?:FuseRoute;lastAttempt?:number}

/** Stage currents follow one visible guide with one advancing ignition front. */
export function drawHeroLineCurrent(g:Phaser.GameObjects.Graphics,curve:(t:number)=>InkPoint,start:number,end:number,phase:number,boxes:readonly InkBox[],_color:number,alpha:number,_variation=0,_fallbackBoard?:InkBox,_cue?:SourceElectricCue,_decision?:SourceElectricDecision){
 if(end<=start||alpha<=0)return {segments:0,heads:[]};
 const points=Array.from({length:41},(_,i)=>curve(start+(end-start)*i/40));
 // Never resume beyond an occluder: every spark remains connected to its guide.
 const path=clearInkRuns(points,boxes,3.6)[0];if(!path||path.length<2)return {segments:0,heads:[]};
 const route:FuseRoute={points:path,source:path[0],target:path[path.length-1],bounds:{x:0,y:0,width:0,height:0}};
 const result=drawHeroFuse(g,route,phase,boxes,alpha);return {segments:result.segments,heads:result.heads};
}
