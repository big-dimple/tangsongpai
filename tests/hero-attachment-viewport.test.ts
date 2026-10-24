import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import type Phaser from 'phaser';
import {HeroTargetAttachment,type AttachmentCard} from '../src/game/HeroTargetAttachment';
afterEach(()=>vi.unstubAllGlobals());
it.each([1,2,3])('uses CSS width for the 390px phone effect cadence at DPR %i',density=>{
 const events=new EventEmitter(),target=vi.fn(()=>undefined);vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const scene={events,game:{},scale:{width:390*density,height:844*density,zoom:1/density}},attachment=new HeroTargetAttachment(scene as unknown as Phaser.Scene,{root:()=>({active:true}) as Phaser.GameObjects.Container,target,source:()=>undefined,motion:()=> 'full',blocked:()=>false});
 attachment.preview({key:'real-target',targetId:'actual/6h'});target.mockClear();events.emit('update',0,34);expect(target).not.toHaveBeenCalled();events.emit('update',0,16);expect(target).toHaveBeenCalledOnce();attachment.destroy();expect(events.listenerCount('update')).toBe(0);
});
it('does not build a target layer for a card outside CSS space but inside the DPR2 framebuffer',()=>{
 const events=new EventEmitter(),graphics=vi.fn(()=>{throw Error('offscreen draw');});vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn()});vi.stubGlobal('document',{hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()});
 const scene={events,game:{},scale:{width:780,height:1688,zoom:.5},add:{graphics}},card={container:{active:true,visible:true,getBounds:()=>({x:450,y:100,right:510,bottom:200})},width:60,height:100},attachment=new HeroTargetAttachment(scene as unknown as Phaser.Scene,{root:()=>({active:true}) as Phaser.GameObjects.Container,target:()=>card as unknown as AttachmentCard,source:()=>undefined,motion:()=> 'full',blocked:()=>false});
 attachment.preview({key:'offscreen-instance',targetId:'actual/offscreen'});expect(graphics).not.toHaveBeenCalled();attachment.destroy();
});
