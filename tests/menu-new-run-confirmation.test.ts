import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class {}}}));
const {session}=vi.hoisted(()=>({session:{run:undefined as {state:{phase:string}}|undefined}}));
vi.mock('../src/game/session',()=>({gameSession:()=>session}));
import {CharacterSelectScene} from '../src/game/CharacterSelectScene';
import {BUILD_FOCUS} from '../src/game/BuildJourney';
const confirm=(CharacterSelectScene.prototype as unknown as {confirmChoice():Promise<void>}).confirmChoice;
afterEach(()=>{session.run=undefined;});
function selection(){
 const dialog={},open=vi.fn((_title:string,_body:string,_actions:{label:string;primary?:boolean;run:()=>Promise<void>}[],_options:{closeLabel:string})=>dialog);
 return {choosing:false,selectedId:'amo',step:'route',selectedRoute:BUILD_FOCUS[0],dialog:{open,close:vi.fn()},choose:vi.fn().mockResolvedValue(true)};
}
it.each(['shop','await-input',undefined,'run-won','run-lost'])('explicit start continues directly without a second confirmation: old phase=%s',async phase=>{
 session.run=phase?{state:{phase}}:undefined;const scene=selection();await confirm.call(scene as unknown as CharacterSelectScene);
 expect(scene.dialog.open).not.toHaveBeenCalled();expect(scene.choose).toHaveBeenCalledOnce();
});
it('does not replace a failed start with a confirmation dialog or retry it',async()=>{
 session.run={state:{phase:'shop'}};const scene=selection();scene.choose.mockResolvedValue(false);await confirm.call(scene as unknown as CharacterSelectScene);
 expect(scene.choose).toHaveBeenCalledOnce();expect(scene.dialog.open).not.toHaveBeenCalled();
});
it('hero confirmation still advances to route selection before starting',async()=>{
 const scene={...selection(),step:'hero',notice:'old notice',render:vi.fn(),audio:{select:vi.fn()}};
 await confirm.call(scene as unknown as CharacterSelectScene);expect(scene.step).toBe('route');expect(scene.notice).toBe('');expect(scene.render).toHaveBeenCalledOnce();expect(scene.choose).not.toHaveBeenCalled();
});
it.each([false,true])('repeated confirmation while starting never calls choose again: presentation=%s',async confirming=>{
 const scene={...selection(),choosing:true,confirming,entryParticles:{skipConfirm:vi.fn()}};
 await confirm.call(scene as unknown as CharacterSelectScene);await confirm.call(scene as unknown as CharacterSelectScene);
 expect(scene.choose).not.toHaveBeenCalled();expect(scene.dialog.open).not.toHaveBeenCalled();expect(scene.entryParticles.skipConfirm).toHaveBeenCalledTimes(confirming?2:0);
});
