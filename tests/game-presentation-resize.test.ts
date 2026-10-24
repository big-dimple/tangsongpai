import {expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
import {GameScene} from '../src/game/GameScene';

it('desktop resize during a score defers layout instead of fast-forwarding the presentation',()=>{
 const scene=Object.create(GameScene.prototype) as any;
 scene.waitingForStage=false;scene.presentation={generation:1};scene.layoutRefreshPending=false;
 scene.fastForward=vi.fn();scene.render=vi.fn();scene.renderStageReady=vi.fn();scene.controlsLive=true;
 scene.refreshViewAfterResize();
 expect(scene.layoutRefreshPending).toBe(true);
 expect(scene.fastForward).not.toHaveBeenCalled();
 expect(scene.render).not.toHaveBeenCalled();
});
