import type Phaser from 'phaser';
import type {CommandResult,R2RunState} from '../domain/run';
import {usesLaohuanRefill,laohuanRefillRepeats} from '../domain/r2LaohuanRefill';
import {r2RunModeConfig} from '../content/r2Modes';
import type {HeroClimaxView} from './HeroClimax';
import {mountHeroClimax} from './HeroClimaxStage';
import type {JokerKeyHighlight} from './JokerKeyHighlight';
import type {Box} from './layout';
import {heroEyesKey} from './portraits';

export interface XinRefillLockCue {readonly eventId:string;readonly sourceInstanceId:string}
/** A real saved activation, before candidate presentation. Deliberately contains no hidden card data. */
export function savedXinRefillLock(before:R2RunState,result:CommandResult<R2RunState>,activationRequested=false):XinRefillLockCue|undefined {
 if(!result.ok||result.duplicate||!usesLaohuanRefill(before)||before.phase!=='await-input')return;
 const after=result.state,discarded=result.events.find(event=>event.type==='cards-discarded');
 if(after.runId!==before.runId||!usesLaohuanRefill(after)||after.commandSeq!==before.commandSeq+1||result.receipt.seq!==after.commandSeq||!discarded?.cardIds.length||discarded.cardIds.some(id=>!before.handOrder.includes(id)||!after.discardPile.includes(id)))return;
 if(after.phase==='pending-refill'?after.pendingRefill?.discardCommandId!==result.receipt.commandId:after.phase!=='await-input'||after.pendingRefill!==null)return;
 // A pending receipt proves activation. Automatic all-kept outcomes need the caller's saved
 // command intent (or the legacy flag transition); presentation never owns a use limit.
 const automatic=laohuanRefillRepeats(before)&&r2RunModeConfig(before).characterAbilityEnabled;
 if(after.phase!=='pending-refill'&&!automatic&&!activationRequested&&!(before.stage?.laohuanTrickUsed===false&&after.stage?.laohuanTrickUsed===true))return;
 return Object.freeze({eventId:result.receipt.commandId+'/xin-refill-lock',sourceInstanceId:after.runId+'/character'});
}
/** A scan confined to the existing eye strip; never crosses a card, caption or candidate. */
export function xinLockScan(box:Box,progress:number):readonly [{x:number;y:number},{x:number;y:number}] {
 const inset=Math.min(3,box.width/2,box.height/2),x=box.x+inset+Math.max(0,Math.min(1,progress))*(box.width-2*inset);
 return [{x,y:box.y+inset},{x,y:box.y+box.height-inset}];
}
/** Reuses the dedicated Xin eye asset. Caller owns saved activation, queue order, wait and abort. */
export function mountXinRefillLock(scene:Phaser.Scene,root:Phaser.GameObjects.Container,viewport:Box,cue:XinRefillLockCue,reduced:boolean,eyes:Box|undefined):HeroClimaxView|undefined {
 if(!eyes||!scene.textures.exists(heroEyesKey('laohuan')))return;
 const key:JokerKeyHighlight={eventId:cue.eventId,kind:'starter',heroId:'laohuan',cause:'换牌技能已保存',landing:'锁定 · 即将揭示候选',fact:{eventId:cue.eventId,sourceInstanceId:cue.sourceInstanceId,definitionId:'',title:'辛弃疾 · 锁定',effect:'随后揭示实际候选',condition:'真实弃牌换牌保存成功',destination:'候选选择',next:'揭示后自主选择留下'}};
 const stage=mountHeroClimax(scene,root,viewport,key,{label:'锁定',before:'',after:'',note:'随后揭示实际候选'},reduced,{eyes});if(!stage)return;
 stage.group.setName('hero/xin-refill-lock').setData('decisionPhase','saved-before-candidate-reveal');
 const box=stage.group.getData('bounds') as Box,sweep=scene.add.graphics().setName('hero/xin-lock-scan');stage.group.add(sweep);
 let tween:Phaser.Tweens.Tween|undefined,disposed=false,still=reduced;
 if(!still){const cursor={t:0};tween=scene.tweens.add({targets:cursor,t:1,duration:180,ease:'Sine.easeInOut',onUpdate:()=>{if(disposed||still)return;const [a,b]=xinLockScan(box,cursor.t);sweep.clear().lineStyle(1.5,0xd4ebdf,.36).lineBetween(a.x,a.y,b.x,b.y);},onComplete:()=>sweep.clear()});}
 const stop=()=>{tween?.remove();tween=undefined;sweep.clear();};
 stage.group.once('destroy',stop);
 return {...stage,reduce:()=>{still=true;stop();stage.reduce();},release:()=>{stop();return stage.release();},dispose:()=>{if(disposed)return;disposed=true;stop();stage.dispose();}};
}
