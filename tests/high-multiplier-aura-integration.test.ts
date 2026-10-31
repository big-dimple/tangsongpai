import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
vi.mock('../src/game/HighMultiplierAura',()=>({mountHighMultiplierAura:vi.fn(()=>vi.fn())}));
import {GameScene} from '../src/game/GameScene';
import {mountHighMultiplierAura} from '../src/game/HighMultiplierAura';

afterEach(()=>vi.clearAllMocks());
it('mounts only the selected saved event once and invalidates its owner on a new presentation',()=>{
 const root={active:true},scene=Object.create(GameScene.prototype) as any,presentation={replay:false,auraPlayed:false,auraEventId:'saved/impact'},controller=new AbortController();
 Object.assign(scene,{presentation,view:{root,layout:{scoreBoard:{x:0,y:0,width:200,height:90}}},scene:{isActive:()=>true}});Object.defineProperty(scene,'reducedMotion',{value:false});
 const context={generation:1,signal:controller.signal};scene.showHighMultiplierAura({eventId:'other'},context);expect(mountHighMultiplierAura).not.toHaveBeenCalled();expect(presentation.auraPlayed).toBe(false);
 scene.showHighMultiplierAura({eventId:'saved/impact'},context);scene.showHighMultiplierAura({eventId:'saved/impact'},context);expect(mountHighMultiplierAura).toHaveBeenCalledOnce();expect(presentation.auraPlayed).toBe(true);
 const options=vi.mocked(mountHighMultiplierAura).mock.calls[0][1];expect(options.eventId).toBe('saved/impact');expect(options.signal).toBe(controller.signal);expect(options.isCurrent?.()).toBe(true);scene.presentation={...presentation};expect(options.isCurrent?.()).toBe(false);
});
it('does not mount for replay, an aborted event, or an inactive view',()=>{
 const root={active:true},scene=Object.create(GameScene.prototype) as any,presentation={replay:true,auraPlayed:false,auraEventId:'saved/impact'},controller=new AbortController();
 Object.assign(scene,{presentation,view:{root},scene:{isActive:()=>true}});const event={eventId:'saved/impact'},context={generation:1,signal:controller.signal};
 scene.showHighMultiplierAura(event,context);presentation.replay=false;controller.abort();scene.showHighMultiplierAura(event,context);root.active=false;scene.showHighMultiplierAura(event,{generation:2,signal:new AbortController().signal});expect(mountHighMultiplierAura).not.toHaveBeenCalled();expect(presentation.auraPlayed).toBe(false);
});
