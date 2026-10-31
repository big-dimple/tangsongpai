import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
vi.mock('../src/game/HighMultiplierAura',()=>({HIGH_MULTIPLIER_FADE_MS:450,mountHighMultiplierAura:vi.fn(()=>vi.fn())}));
vi.mock('../src/game/session',()=>({gameSession:()=>({speed:1})}));
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
it('starts one fire layer only after visible ink, and disposes the same layer with the visual',()=>{
 const root={active:true},stop=vi.fn(),fadeOut=vi.fn(),play=vi.fn(()=>({stop,fadeOut})),scene=Object.create(GameScene.prototype) as any,presentation={replay:false,auraPlayed:false,auraEnding:false,auraEventId:'saved/impact'},controller=new AbortController();
 Object.assign(scene,{presentation,audio:{playHighMultiplierFire:play},view:{root,layout:{scoreBoard:{x:0,y:0,width:200,height:90}}},scene:{isActive:()=>true}});Object.defineProperty(scene,'reducedMotion',{value:false});
 scene.showHighMultiplierAura({eventId:'saved/impact'},{generation:1,signal:controller.signal});
 const options=vi.mocked(mountHighMultiplierAura).mock.calls[0][1];expect(play).not.toHaveBeenCalled();
 options.onVisibleOnce?.();expect(play).toHaveBeenCalledOnce();expect(play).toHaveBeenCalledWith({signal:controller.signal,speed:1,reducedMotion:false,replay:false});
 presentation.auraEnding=true;expect(options.ending?.()).toBe(true);options.onEnding?.(450);expect(fadeOut).toHaveBeenCalledWith(450);
 options.onDispose?.();expect(stop).toHaveBeenCalledOnce();
});
it('does not start a stale, aborted or reduced-motion fire when visibility is delayed',()=>{
 for(const kind of ['stale','aborted','reduced'] as const){
  vi.mocked(mountHighMultiplierAura).mockClear();const root={active:true},play=vi.fn(),scene=Object.create(GameScene.prototype) as any,presentation={replay:false,auraPlayed:false,auraEventId:'saved/impact'},controller=new AbortController();let reduced=false;
  Object.assign(scene,{presentation,audio:{playHighMultiplierFire:play},view:{root,layout:{scoreBoard:{x:0,y:0,width:200,height:90}}},scene:{isActive:()=>true}});Object.defineProperty(scene,'reducedMotion',{get:()=>reduced});
  scene.showHighMultiplierAura({eventId:'saved/impact'},{generation:1,signal:controller.signal});const options=vi.mocked(mountHighMultiplierAura).mock.calls[0][1];
  if(kind==='stale')scene.presentation={...presentation};if(kind==='aborted')controller.abort();if(kind==='reduced')reduced=true;
  options.onVisibleOnce?.();options.onDispose?.();expect(play).not.toHaveBeenCalled();
 }
});
