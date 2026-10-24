import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import type Phaser from 'phaser';
import {heroEffectOrigin} from '../src/game/HeroEffectOrigin';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {layout,type Box} from '../src/game/layout';
const require=createRequire(import.meta.url),TransformMatrix=require('phaser/src/gameobjects/components/TransformMatrix.js') as new()=>Phaser.GameObjects.Components.TransformMatrix;
function anchor(box:Box,matrix=new TransformMatrix()){
 const object={active:true,visible:true,alpha:1,parentContainer:undefined as undefined|{active:boolean;visible:boolean;alpha:number},getBounds:()=>{const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>matrix.transformPoint(x,y)),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return{x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};}};return object as unknown as Phaser.GameObjects.Container;
}
it.each([320,390])('the actual %ipx responsive skill-right offset enters inventory; live avatar/skill centers do not',width=>{
 const viewport={width,height:844},l=layout(viewport,{top:0,right:0,bottom:0,left:0}),inventory=l.inventoryEntry!,oldX=l.heroAction.x+l.heroAction.width+16;expect(oldX).toBeGreaterThan(inventory.x);expect(oldX).toBeLessThan(inventory.x+inventory.width);
 const avatar=anchor({x:l.hud.x+12,y:l.hud.y+6,width:30,height:30}),skill=anchor(l.heroAction),origin=heroEffectOrigin(avatar,skill,viewport)!;expect(origin).toMatchObject({x:l.hud.x+27,kind:'avatar'});avatar.visible=false;const fallback=heroEffectOrigin(avatar,skill,viewport)!;expect(fallback).toEqual({x:l.heroAction.x+l.heroAction.width/2,y:l.heroAction.y+l.heroAction.height/2,kind:'skill'});expect(fallback.x).toBeLessThan(inventory.x);
});
it('uses live nested world bounds without framebuffer scaling, responds to relayout, and rejects hidden/offscreen anchors',()=>{
 const matrix=new TransformMatrix().applyITRS(20,50,.3,.75,.75),box={x:12,y:16,width:30,height:30},avatar=anchor(box,matrix),viewport={width:390,height:844},expected=matrix.transformPoint(27,31);expect(heroEffectOrigin(avatar,undefined,viewport)).toEqual({...expected,kind:'avatar'});matrix.applyITRS(60,90,0,1,1);expect(heroEffectOrigin(avatar,undefined,viewport)).toEqual({x:87,y:121,kind:'avatar'});
 Object.assign(avatar,{parentContainer:{active:true,visible:false,alpha:1}});expect(heroEffectOrigin(avatar,undefined,viewport)).toBeUndefined();Object.assign(avatar,{parentContainer:undefined,alpha:0});expect(heroEffectOrigin(avatar,undefined,viewport)).toBeUndefined();avatar.alpha=1;matrix.applyITRS(500,50,0,1,1);expect(heroEffectOrigin(avatar,undefined,viewport)).toBeUndefined();
});
it('all six use the explicit live avatar before a decorative portrait and convert it to the root once',()=>{
 const rootMatrix=new TransformMatrix().applyITRS(40,20,.1,.8,.8),manager=Object.create(HeroTargetAttachment.prototype) as any,point={x:95,y:100,kind:'avatar' as const};manager.options={source:()=>point};const root={getWorldTransformMatrix:()=>rootMatrix},portrait={x:10,y:10,width:100,height:400};expect(manager.source(root,portrait,[{x:250,y:600,width:60,height:100}])).toEqual({point:rootMatrix.applyInverse(point.x,point.y),kind:'avatar'});
});
