import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {cancelDestinationPreparation,prepareDestination,type LoadingScreen} from '../src/game/LoadingScreen';
import {paperSceneStart} from '../src/game/PaperFlow';
import {prepareSceneResources,type PreparationProgress} from '../src/game/SceneResources';
const fixtures=vi.hoisted(()=>({assets:[{key:'opening-face',url:'/face.webp',pixels:1}]}));
vi.mock('../src/game/SceneResources',()=>({openingResources:()=>fixtures.assets,sceneResources:()=>fixtures.assets,prepareSceneResources:vi.fn()}));
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function setup(){
 const listeners=new Map<string,()=>void>();
 const game={textures:{exists:()=>false},registry:{get:vi.fn(),set:vi.fn()},events:{once:vi.fn((event:string,fn:()=>void)=>listeners.set(event,fn)),off:vi.fn((event:string,fn:()=>void)=>{if(listeners.get(event)===fn)listeners.delete(event);})}} as unknown as Phaser.Game;
 const view={controls:vi.fn(),recovery:vi.fn(),finish:vi.fn(async()=>{}),close:vi.fn()} as unknown as LoadingScreen;
 return {game,view,destroy:()=>listeners.get('destroy')?.(),listeners};
}
const progress=(loaded=0):PreparationProgress=>({total:1,loaded,failed:0,pending:1-loaded,states:fixtures.assets.map(a=>({...a,status:loaded?'loaded':'queued',attempts:1}))});
beforeEach(()=>{
 vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('matchMedia',()=>({matches:false}));
 // Navigation must not create a replacement loading dialog, even if no texture is cached.
 vi.stubGlobal('document',{querySelector:()=>null,createElement:vi.fn(()=>{throw Error('unexpected navigation loading dialog');})});
 vi.mocked(prepareSceneResources).mockReset();
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it('cold later destinations resolve immediately without optional-image recovery or another loading panel',async()=>{
 const {game}=setup();vi.mocked(prepareSceneResources).mockImplementation(()=>new Promise(()=>{}));
 for(const key of ['title','character-select','shop','game','intermission','shop','game'])expect(await prepareDestination(game,key)).toBe(true);
 expect(await prepareDestination(game,'title',true)).toBe(true);
 expect(prepareSceneResources).not.toHaveBeenCalled();expect(game.registry.set).not.toHaveBeenCalled();expect(document.createElement).not.toHaveBeenCalled();
});
it('rapid normal navigation enters only the latest destination while optional resources remain unavailable',async()=>{
 const {game}=setup(),start=vi.fn(),scene={game,scene:{isActive:()=>true,start}} as unknown as Phaser.Scene;
 vi.mocked(prepareSceneResources).mockImplementation(()=>new Promise(()=>{}));
 paperSceneStart(scene,'shop',{visit:1});paperSceneStart(scene,'game');await tick();
 expect(start).toHaveBeenCalledExactlyOnceWith('game');expect(prepareSceneResources).not.toHaveBeenCalled();expect(document.createElement).not.toHaveBeenCalled();
});
it('the existing Boot screen still waits for actual decoded opening assets and finishes once',async()=>{
 const {game,view,listeners}=setup();let decoded!:(p:PreparationProgress)=>void;
 vi.mocked(prepareSceneResources).mockImplementation(()=>new Promise(resolve=>decoded=resolve));
 const done=prepareDestination(game,'title',false,view),settled=vi.fn();void done.then(settled);await tick();
 expect(settled).not.toHaveBeenCalled();expect(view.finish).not.toHaveBeenCalled();expect(game.registry.set).toHaveBeenCalledWith('resourcePreparation',expect.objectContaining({pending:1,status:'loading'}));
 decoded(progress(1));expect(await done).toBe(true);expect(view.finish).toHaveBeenCalledOnce();expect(view.close).toHaveBeenCalledOnce();expect(listeners.size).toBe(0);
});
it('a failed opening asset keeps honest recovery progress instead of pretending that Boot is ready',async()=>{
 vi.useFakeTimers();const {game,view}=setup(),missing={...progress(),failed:1,pending:0,states:fixtures.assets.map(a=>({...a,status:'failed' as const,attempts:1,retryable:false}))};
 vi.mocked(prepareSceneResources).mockResolvedValue(missing);
 const done=prepareDestination(game,'title',false,view),settled=vi.fn();void done.then(settled);await tick();
 expect(view.recovery).toHaveBeenLastCalledWith(expect.objectContaining({loaded:0,failed:1,status:'waiting',retryInMs:30000}));
 await vi.advanceTimersByTimeAsync(29999);expect(prepareSceneResources).toHaveBeenCalledOnce();expect(settled).not.toHaveBeenCalled();
 cancelDestinationPreparation(game);expect(await done).toBe(false);expect(view.finish).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it.each(['title','game'])('later navigation to %s retires any prior Boot owner and releases its pending image lease',async key=>{
 const {game,view,listeners}=setup();let signal!:AbortSignal;
 vi.mocked(prepareSceneResources).mockImplementation((_game,_assets,_changed,s)=>{signal=s;return new Promise(resolve=>s.addEventListener('abort',()=>resolve(progress()),{once:true}));});
 const opening=prepareDestination(game,'title',false,view);expect(signal.aborted).toBe(false);
 expect(await prepareDestination(game,key)).toBe(true);expect(await opening).toBe(false);expect(signal.aborted).toBe(true);expect(view.finish).not.toHaveBeenCalled();expect(listeners.size).toBe(0);
});
it('game destruction cancels the initial owner and cannot finish or restart late recovery',async()=>{
 const {game,view,destroy,listeners}=setup();let signal!:AbortSignal;
 vi.mocked(prepareSceneResources).mockImplementation((_game,_assets,_changed,s)=>{signal=s;return new Promise(resolve=>s.addEventListener('abort',()=>resolve(progress()),{once:true}));});
 const done=prepareDestination(game,'title',false,view);destroy();expect(await done).toBe(false);expect(signal.aborted).toBe(true);expect(view.finish).not.toHaveBeenCalled();expect(listeners.size).toBe(0);
});
