import {it,expect,vi} from 'vitest';
vi.mock('phaser',()=>({default:{}}));
vi.mock('../src/game/HeroClimaxStage',()=>({mountHeroClimax:vi.fn()}));
vi.mock('../src/game/portraits',()=>({heroEyesKey:()=> 'xin-existing-eyes'}));
import type Phaser from 'phaser';
import {applyCommand,type CommandResult,type R2RunState} from '../src/domain/run';
import {savedXinRefillLock,xinLockScan,mountXinRefillLock} from '../src/game/XinRefillLock';
import {mountHeroClimax} from '../src/game/HeroClimaxStage';
import {laohuanDiscardFixture,XIN_DISCARD} from './fixtures/laohuan-discard-handoff';
import {R2_S04_FINISH_VERSION,R2_S04_FINISH_HASH} from '../src/domain/r2GroupUpgrade';
const before=laohuanDiscardFixture();
const execute=(state:R2RunState,trick=true)=>applyCommand(state,{runId:state.runId,commandId:'xin-lock/'+state.commandSeq,expectedSeq:state.commandSeq,action:{type:'DiscardHand',selectedIds:XIN_DISCARD,laohuanTrick:trick}});
it('accepts only the actual saved activation and carries no candidates, deck order, rank or suit into the eye cue',()=>{
 const snapshot=JSON.stringify(before),result=execute(before);expect(result.ok).toBe(true);if(!result.ok)return;expect(result.state.phase).toBe('pending-refill');const saved=JSON.stringify(result),cue=savedXinRefillLock(before,result);expect(cue).toEqual({eventId:result.receipt.commandId+'/xin-refill-lock',sourceInstanceId:before.runId+'/character'});expect(Object.keys(cue!)).toEqual(['eventId','sourceInstanceId']);expect(JSON.stringify(before)).toBe(snapshot);expect(JSON.stringify(result)).toBe(saved);
});
it('cancel/failure, legacy ordinary discard, duplicate or stale receipt cannot produce activation eyes',()=>{
 const legacy=laohuanDiscardFixture(0,{contentVersion:R2_S04_FINISH_VERSION,contentHash:R2_S04_FINISH_HASH}),ordinary=execute(legacy,false);expect(ordinary.ok).toBe(true);expect(savedXinRefillLock(legacy,ordinary)).toBeUndefined();expect(savedXinRefillLock(before,{ok:false,code:'save-failed',state:before} as CommandResult<R2RunState>)).toBeUndefined();const result=execute(before);if(!result.ok)throw Error(result.code);expect(savedXinRefillLock(before,{...result,duplicate:true})).toBeUndefined();expect(savedXinRefillLock(before,{...result,receipt:{...result.receipt,seq:result.receipt.seq+1}})).toBeUndefined();expect(savedXinRefillLock(result.state,result)).toBeUndefined();
});
it('deck shortage locks before the existing automatic all-kept reveal, without inventing candidates',()=>{
 const short=structuredClone(before);short.playedPile.push(...short.drawPile.splice(0,short.drawPile.length-2));const result=execute(short);expect(result.ok).toBe(true);if(!result.ok)return;expect(result.state.phase).toBe('await-input');expect(result.state.pendingRefill).toBeNull();expect(savedXinRefillLock(short,result)).toBeDefined();expect(result.state.handOrder.slice(-2)).toEqual([...short.drawPile].reverse());
});
it('accepts a real second normal-discard receipt and a later shortage receipt with the history flag already true',()=>{
 const first=execute(before,false);if(!first.ok)throw Error(first.code);const p=first.state.pendingRefill!,choice=applyCommand(first.state,{runId:before.runId,commandId:'repeat/choose',expectedSeq:first.state.commandSeq,action:{type:'ChooseRefill',selectedIds:p.candidateIds.slice(0,p.required)}});if(!choice.ok)throw Error(choice.code);expect(choice.state.stage!.laohuanTrickUsed).toBe(true);const second=applyCommand(choice.state,{runId:before.runId,commandId:'repeat/second',expectedSeq:choice.state.commandSeq,action:{type:'DiscardHand',selectedIds:choice.state.handOrder.slice(0,1)}});expect(second.ok).toBe(true);expect(savedXinRefillLock(choice.state,second)?.eventId).toBe('repeat/second/xin-refill-lock');const short=structuredClone(choice.state);short.playedPile.push(...short.drawPile.splice(0,short.drawPile.length-2));const all=applyCommand(short,{runId:before.runId,commandId:'repeat/short',expectedSeq:short.commandSeq,action:{type:'DiscardHand',selectedIds:short.handOrder.slice(0,3)}});if(!all.ok)throw Error(all.code);expect(all.state.pendingRefill).toBeNull();expect(savedXinRefillLock(short,all)?.eventId).toBe('repeat/short/xin-refill-lock');
});
it('scan geometry remains in the eye strip for PC and narrow placement, including overshoot progress',()=>{
 for(const box of [{x:12,y:300,width:208,height:78},{x:8,y:92,width:124,height:46},{x:0,y:0,width:4,height:3}])for(const progress of [-1,0,.5,1,2])for(const point of xinLockScan(box,progress)){expect(point.x).toBeGreaterThanOrEqual(box.x);expect(point.x).toBeLessThanOrEqual(box.x+box.width);expect(point.y).toBeGreaterThanOrEqual(box.y);expect(point.y).toBeLessThanOrEqual(box.y+box.height);}
});
it('reduced motion creates only the existing static eye, and reduce/destroy remove the one normal scan tween',async()=>{
 const box={x:12,y:300,width:208,height:78};let destroyed:()=>void=()=>undefined;
 const group={setName(){return this;},setData(){return this;},getData:()=>box,add:vi.fn(),once:(_event:string,callback:()=>void)=>{destroyed=callback;}},stage={group,reduce:vi.fn(),release:vi.fn(async()=>undefined),dispose:vi.fn(()=>destroyed()),strike:vi.fn()};
 vi.mocked(mountHeroClimax).mockReturnValue(stage as unknown as ReturnType<typeof mountHeroClimax>);
 const ink={setName(){return this;},clear:vi.fn(function(){return ink;}),lineStyle(){return this;},lineBetween:vi.fn(function(){return ink;})},remove=vi.fn(),configs:any[]=[],scene={textures:{exists:()=>true},add:{graphics:()=>ink},tweens:{add:(config:unknown)=>{configs.push(config);return{remove};}}},cue=savedXinRefillLock(before,execute(before))!;
 const still=mountXinRefillLock(scene as unknown as Phaser.Scene,{} as Phaser.GameObjects.Container,box,cue,true,box)!;expect(configs).toHaveLength(0);still.dispose();expect(stage.dispose).toHaveBeenCalledOnce();
 const normal=mountXinRefillLock(scene as unknown as Phaser.Scene,{} as Phaser.GameObjects.Container,box,cue,false,box)!;expect(configs).toHaveLength(1);configs[0].targets.t=.5;configs[0].onUpdate();expect(ink.lineBetween).toHaveBeenCalledWith(116,303,116,375);normal.reduce();expect(remove).toHaveBeenCalledOnce();expect(stage.reduce).toHaveBeenCalledOnce();configs[0].onUpdate();expect(ink.lineBetween).toHaveBeenCalledOnce();await normal.release();normal.dispose();normal.dispose();expect(stage.dispose).toHaveBeenCalledTimes(2);expect(remove).toHaveBeenCalledOnce();
});
it('missing dedicated eye or free local eye slot does not substitute another hero/image or block the owner reveal',()=>{
 const cue=savedXinRefillLock(before,execute(before))!,scene={textures:{exists:()=>false}} as unknown as Phaser.Scene,box={x:0,y:0,width:200,height:80};vi.mocked(mountHeroClimax).mockClear();expect(mountXinRefillLock(scene,{} as Phaser.GameObjects.Container,box,cue,false,box)).toBeUndefined();expect(mountXinRefillLock(scene,{} as Phaser.GameObjects.Container,box,cue,false,undefined)).toBeUndefined();expect(mountHeroClimax).not.toHaveBeenCalled();
});
