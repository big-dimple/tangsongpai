import {expect,it,afterEach,vi} from 'vitest';
import {liueListeningSlot,drawLiueListeningEar,playLiueListeningStage} from '../src/game/LiueListeningStage';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';
afterEach(()=>vi.unstubAllGlobals());
it('uses upper table space while keeping occupied card faces clear, with the measured stage as fallback',()=>{
 const upper={x:12,y:68,width:366,height:96},fallback={x:12,y:414,width:366,height:100};
 expect(liueListeningSlot(upper,[],fallback).y).toBe(68);
 expect(liueListeningSlot(upper,[upper],fallback)).toEqual(fallback);
 const side=liueListeningSlot({x:250,y:16,width:960,height:210},[{x:600,y:16,width:150,height:160}],fallback);
 expect(side.y).toBe(16);expect(side.x+side.width<594||side.x>756).toBe(true);
});
it('owns vector ear and waves without input, and queue abort destroys every layer and pending prelude',async()=>{
 const f=nativeHeroRuntime(),abort=new AbortController(),slot={x:50,y:80,width:280,height:96};
 const g=f.scene.add.graphics();drawLiueListeningEar(g,180,128,84);expect(g.commandBuffer.length).toBeGreaterThan(0);g.destroy();
 const listeners=f.scene.events.listenerCount('update'),remove=vi.fn();Object.assign(f.scene,{tweens:{add:()=>({remove})}});
 const job=playLiueListeningStage(f.scene,f.root,{x:12,y:550,width:218,height:52},slot,'saved/handoff','spades-8',{generation:1,signal:abort.signal},()=>false,1,{windup:160,flight:145,impact:275,rest:45,strength:'role'});
 const stage=f.root.getByName('hero/liue-listening-stage') as any;expect(stage).toBeTruthy();expect(stage.input).toBeNull();expect(stage.getByName('hero/liue-listening-ear').scaleX).toBe(1);expect(stage.getByName('hero/liue-listening-ear').scaleY).toBe(1);
 abort.abort();expect(await job).toBeUndefined();expect(remove).toHaveBeenCalledOnce();expect(stage.active).toBe(false);expect(f.root.getByName('hero/liue-listening-stage')).toBeNull();expect(f.scene.events.listenerCount('update')).toBe(listeners);f.root.destroy();
});
it('parent teardown destroys the listening group once and resolves the pending prelude',async()=>{
 const f=nativeHeroRuntime(),abort=new AbortController(),remove=vi.fn();Object.assign(f.scene,{tweens:{add:()=>({remove})}});
 const job=playLiueListeningStage(f.scene,f.root,{x:12,y:550,width:218,height:52},{x:50,y:80,width:280,height:96},'saved/exit','spades-8',{generation:1,signal:abort.signal},()=>false,1,{windup:160,flight:145,impact:275,rest:45,strength:'role'});
 expect(()=>f.root.destroy()).not.toThrow();expect(await job).toBeUndefined();expect(remove).toHaveBeenCalledOnce();abort.abort();
});
