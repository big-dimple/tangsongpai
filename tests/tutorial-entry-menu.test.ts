import {beforeEach,expect,it,vi} from 'vitest';
import type {SavedRun} from '../src/application/SavedRun';

const {session,resume,dismiss,prepare,mayResume}=vi.hoisted(()=>({
 session:{run:undefined as SavedRun|undefined,pendingRun:undefined as SavedRun|undefined,working:false,reportNotice:vi.fn()},
 resume:vi.fn(),dismiss:vi.fn(),prepare:vi.fn(),mayResume:vi.fn(),
}));
vi.mock('../src/game/session',()=>({gameSession:()=>session}));
vi.mock('../src/game/GuidedTutorial',()=>({resumeGuidedTutorialOpening:resume,startGuidedTutorial:vi.fn()}));
vi.mock('../src/game/NoviceGuide',()=>({dismissNoviceGuide:dismiss,mayResumeNoviceOpening:mayResume,noviceGuideDisabled:()=>false,restoreNoviceGuide:vi.fn(),NOVICE_GUIDE_KEY:'novice'}));
vi.mock('../src/game/LoadingScreen',()=>({prepareDestination:prepare}));
import {prepareSavedTutorial,routeSavedRun,skipTutorialToNormal} from '../src/game/RunMenu';

const guidedId='run/r2/tutorial/core-v1/erxiang/guided/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const saved=(mode='tutorial',phase='await-input',runId=guidedId)=>({
 state:{mode,phase,runId,stageIndex:0,stage:phase==='await-input'?{index:0}:null,commandSeq:phase==='shop'?1:phase==='stage-ready'?2:3,characterId:'erxiang',seed:'r2/tutorial/core-v1'},
 journal:[],status:'idle',flush:vi.fn().mockResolvedValue(true),
}) as unknown as SavedRun;
const game=()=>({scene:{stop:vi.fn(),start:vi.fn()},registry:{set:vi.fn()}});
beforeEach(()=>{session.run=undefined;session.pendingRun=undefined;session.working=false;vi.clearAllMocks();prepare.mockResolvedValue(true);resume.mockResolvedValue(true);mayResume.mockReturnValue(true);});

it('skips a saved tutorial to ordinary character selection and keeps the checkpoint',async()=>{
 const run=saved(),g=game();session.run=run;expect(await skipTutorialToNormal(g as never)).toBe(true);
 expect(run.flush).toHaveBeenCalledOnce();expect(dismiss).toHaveBeenCalledWith(run.state,'run',run.journal);
 expect(session.run).toBe(run);expect(g.scene.start).toHaveBeenCalledWith('character-select');
});
it('completion reaches ordinary selection without marking the tutorial skipped',async()=>{
 const run=saved(),g=game();session.run=run;expect(await skipTutorialToNormal(g as never,'complete')).toBe(true);
 expect(dismiss).not.toHaveBeenCalled();expect(session.run).toBe(run);expect(g.scene.start).toHaveBeenCalledWith('character-select');
});
it('does not skip a regular game or leave while a save is pending or failed',async()=>{
 const g=game(),run=saved();session.run=saved('standard');expect(await skipTutorialToNormal(g as never)).toBe(false);
 session.run=run;session.pendingRun=run;expect(await skipTutorialToNormal(g as never)).toBe(false);session.pendingRun=undefined;
 vi.mocked(run.flush).mockResolvedValueOnce(false);expect(await skipTutorialToNormal(g as never)).toBe(false);
 expect(dismiss).not.toHaveBeenCalled();expect(g.scene.start).not.toHaveBeenCalled();expect(session.reportNotice).toHaveBeenCalledWith(expect.stringContaining('重试保存'));
});
it('resumes only a uniquely identified guided opening, never an ordinary or legacy save',async()=>{
 for(const phase of ['shop','stage-ready']){const run=saved('tutorial',phase);expect(await prepareSavedTutorial(run)).toBe(true);expect(resume).toHaveBeenLastCalledWith(run);}
 resume.mockClear();expect(await prepareSavedTutorial(saved('standard','shop'))).toBe(true);
 expect(await prepareSavedTutorial(saved('tutorial','shop','old-run'))).toBe(true);
 const underway=saved('tutorial','await-input');(underway.state as {commandSeq:number}).commandSeq=4;
 expect(await prepareSavedTutorial(underway)).toBe(true);expect(resume).not.toHaveBeenCalled();
 expect(await prepareSavedTutorial(saved('tutorial','await-input'))).toBe(true);expect(resume).toHaveBeenCalledOnce();
});
it('routes an imported guided checkpoint in its saved phase without advancing it',async()=>{
 const run=saved('tutorial','shop'),g=game();session.run=run;mayResume.mockReturnValue(false);
 expect(await routeSavedRun(g as never)).toBe(true);expect(resume).not.toHaveBeenCalled();expect(prepare).toHaveBeenCalledWith(g,'shop');
});
it('honours durable import suppression even if a stale local permission remains',async()=>{
 const run=saved('tutorial','stage-ready'),g=game();Object.defineProperty(run,'guidedOpeningSuppressed',{value:true});session.run=run;
 expect(await routeSavedRun(g as never)).toBe(true);expect(resume).not.toHaveBeenCalled();expect(prepare).toHaveBeenCalledWith(g,'game');
});
it('waits for the interrupted commands before routing and keeps the scene on save failure',async()=>{
 const run=saved('tutorial','stage-ready'),g=game();session.run=run;resume.mockResolvedValueOnce(false);
 expect(await routeSavedRun(g as never)).toBe(false);expect(g.scene.stop).not.toHaveBeenCalled();expect(g.registry.set).not.toHaveBeenCalled();
 resume.mockImplementationOnce(async()=>{(run.state as {phase:string}).phase='await-input';return true;});
 expect(await routeSavedRun(g as never)).toBe(true);expect(g.registry.set).toHaveBeenCalledWith('runController',run);expect(prepare).toHaveBeenCalledWith(g,'game');
});
