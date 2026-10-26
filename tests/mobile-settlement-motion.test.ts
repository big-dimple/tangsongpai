import {expect,it,vi} from 'vitest';
import {mountSettlementMotion} from '../src/game/SettlementPresentation';

it('keeps a mobile hero on its left edge through entry and cleanup while the score animates',()=>{
 let update:(()=>void)|undefined;
 const scene:any={events:{on:(_name:string,fn:()=>void)=>{update=fn;},once:vi.fn(),off:vi.fn()}},score:any={active:true,scaleX:1,scaleY:1,alpha:1,getData:(key:string)=>key==='mobilePoster',setScale:vi.fn().mockReturnThis(),setAlpha:vi.fn().mockReturnThis()},hero:any={active:true,x:74,alpha:1,setX:vi.fn().mockReturnThis(),setAlpha:vi.fn().mockReturnThis()};
 const clock=vi.spyOn(performance,'now').mockReturnValue(1000);
 try{
 const motion=mountSettlementMotion(scene,{} as any,{x:12,y:64,width:366,height:220},score,hero,0,false);
 for(const elapsed of [0,100,220,420,900]){clock.mockReturnValue(1000+elapsed);update?.();expect(hero.x).toBe(74);}
 motion.dispose();expect(hero.setX).not.toHaveBeenCalled();expect(score.setScale).toHaveBeenCalled();
 }finally{clock.mockRestore();}
});
