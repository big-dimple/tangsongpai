import {DetailDialog} from './DetailDialog';
import type {Action,R2RunState} from '../domain/run';
import {pokerEncounterView,pokerEncounterVisualEvent,type PokerEncounterView,type PokerEncounterVisualEvent} from './PokerEncounterView';
import {rankLabel,SUIT_SYMBOL,type PlayingCard} from '../cards/types';
import type {ShopServiceEntry} from './ShopServiceDialog';
import {
  enhanceQiyuCardGrid,
  mountQiyuCeremonyStage,
  mountQiyuConfirmAltar,
  mountQiyuHeroBanner,
} from './QiyuAnimationPresentation';
import './PokerEncounterDialog.css';

const label=(c:Readonly<PlayingCard>)=>SUIT_SYMBOL[c.suit]+rankLabel(c.rank);
interface Hooks {read:()=>R2RunState;ready:()=>boolean;reducedMotion?:()=>boolean;send:(action:Action,expectedSeq:number)=>Promise<boolean>}
export function pokerEncounterServices(run:R2RunState,choose:()=>void):ShopServiceEntry[]{const v=pokerEncounterView(run);return v?[{id:'poker-encounter',title:'奇遇 · 纸上流彩',summary:v.status==='purchased'?'多彩已赋予 · 查看结果':v.status==='skipped'?'本店已跳过':'选一张普通扑克 · 计分时倍率×1.5',price:18,choose}]:[];}
/** Phase 1b authoritative transaction + Phase 2 Tang-Song storyboard, altar, ceremony & audio/haptic feedback. */
export function showPokerEncounter(dialog:DetailDialog,h:Hooks,options:{committed?:boolean;restored?:boolean;returning?:boolean}={}):void {
 const run=h.read(),v=pokerEncounterView(run);if(!v)return;
 const emit=(type:PokerEncounterVisualEvent['type'],details:{targetId?:string;reducedMotion?:boolean}={})=>document.dispatchEvent(new CustomEvent('tangsongpai:poker-encounter-view',{detail:pokerEncounterVisualEvent(type,v,details)}));
 const reduced=h.reducedMotion?.()??window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let stageCleanup:(()=>void)|undefined;
 const releaseStage=()=>{try{stageCleanup?.();}catch{/* Visual cleanup never blocks dialog. */}stageCleanup=undefined;};
 const open=(title:string,body:string,actions:Parameters<DetailDialog['open']>[2],opts:Parameters<DetailDialog['open']>[3]={})=>{
  const userClose=opts.onClose;
  const d=dialog.open(title,body,actions,{...opts,onClose:()=>{releaseStage();userClose?.();}});
  d.classList.add('poker-encounter');
  d.dataset.motion=reduced?'static':'animated';
  return d;
 };
 if(v.status==='purchased'){
  const r=v.receipt!,card=v.targets.find(c=>c.id===r.targetId),name=card?label(card):'所选扑克';
  const d=open('纸上流彩 · 已赋予',`${name} 已赋予多彩版次。\n打出且参与计分时，倍率×1.5；留在手里不生效。原有增强保留。\n实付18金 · 金币 ${r.goldBefore} → ${r.goldAfter}\n本店培养／改牌机会已用。`,[],{closeLabel:'返回商店',summaryBody:'结果已经保存 · 不会再次扣款或赠送'});
  d.classList.add('poker-encounter-purchased');
  try{stageCleanup=mountQiyuCeremonyStage(d,v,run.characterId,{committed:!!options.committed,reducedMotion:reduced});}catch{/* Static receipt remains visible. */}
  if(options.committed){emit('PurchaseCommitted',{targetId:r.targetId});emit('GrantPresented',{targetId:r.targetId});}else emit('Restored',{targetId:r.targetId});
  return;
 }
 if(v.status==='skipped'){
  const d=open('纸上流彩 · 本店已跳过','没有扣款或赋予。下一次奇遇按后续真实通关推进，不会在本店刷新补发。',[],{closeLabel:'返回商店'});
  d.classList.add('poker-encounter-skipped');
  try{stageCleanup=mountQiyuHeroBanner(d,run.characterId,'skipped',{reducedMotion:reduced,gold:v.gold,price:v.price});}catch{/* Static skipped dialog remains visible. */}
  emit('Restored');return;
 }
 emit(options.restored?'Restored':'EncounterEntered');emit('ReducedMotion',{reducedMotion:reduced});
 const seq=run.commandSeq;
 const skip=async()=>{if(!h.ready())return;const ok=await h.send({type:'SkipPokerEncounter',opportunityId:v.id,shopSeq:v.shopSeq},seq);if(ok){emit('Skipped');emit('Exited');dialog.close();}};
 const choose=(target:Readonly<PlayingCard>)=>{
  emit('SelectionChanged',{targetId:target.id});let saving=false;
  const d=open(label(target)+' · 确认赋予多彩','这张扑克以后打出且参与计分时，倍率×1.5。\n留在手里不生效；重复计分时每遍读取。原增强保留，原玻璃破损规则不变。\n固定总价18金，无额外5金，不使用优惠券。\n占本店培养／基础改牌机会；离店后本次机会失效。',[{label:'确认赋予 · 18金',primary:true,disabled:!!v.unavailable||!h.ready(),run:async()=>{
   if(saving||!dialog.active(d)||!h.ready()||v.unavailable)return;saving=true;const close=d.querySelector<HTMLButtonElement>('.dialog-close')!;close.disabled=true;
   try{if(await h.send({type:'BuyPokerPolychrome',opportunityId:v.id,shopSeq:v.shopSeq,targetId:target.id},seq))showPokerEncounter(dialog,h,{committed:true});}
   finally{saving=false;if(dialog.active(d))close.disabled=false;}
  }}],{closeLabel:'返回选牌',summaryBody:`实付18金 · 金币 ${v.gold} → ${v.gold-18}`+(v.unavailable?'\n'+v.unavailable:''),collapseRules:false});
  d.classList.add('poker-encounter-confirm');
  try{stageCleanup=mountQiyuConfirmAltar(d,target,run.characterId,v.gold,v.unavailable,reduced);}catch{/* Static confirmation remains visible. */}
  d.querySelector<HTMLButtonElement>('.dialog-close')!.onclick=()=>{if(!saving)showPokerEncounter(dialog,h,{returning:true});};
  d.addEventListener('cancel',e=>{if(saving){e.preventDefault();e.stopImmediatePropagation();}else{e.preventDefault();showPokerEncounter(dialog,h,{returning:true});}},{capture:true});
 };
 const d=open('奇遇 · 纸上流彩','首次和之后均在真实通关7–9关后出现，跳关与刷新不计数。\n普通版扑克才能赋予多彩，原有增强保留。不会进入道具箱。\n本店与培养／基础改牌共用一次；可以先返回商店筹钱，离店或跳过会失去本次机会。',[{label:'跳过本次奇遇',disabled:!h.ready(),run:skip}],{closeLabel:'返回商店',summaryBody:`一次一张 · 打出且计分时倍率×1.5；留在手里不生效。\n当前 ${v.gold} 金 · 总价18金`+(v.unavailable?'\n'+v.unavailable:''),choices:v.targets.map(c=>({label:label(c),detail:(c.edition??'none')==='none'?(c.enhancement?'普通版 · 保留已有增强':'普通版扑克'):'已有版次 · 不能再次赋予',disabled:(c.edition??'none')!=='none',run:()=>choose(c)}))});
 try{
  const c1=mountQiyuHeroBanner(d,run.characterId,'selection',{freshEntry:!options.restored&&!options.returning,reducedMotion:reduced,gold:v.gold,price:v.price,unavailable:v.unavailable});
  const c2=enhanceQiyuCardGrid(d,v.targets,reduced);
  stageCleanup=()=>{c2();c1();};
 }catch{/* Static selection remains visible. */}
 // 底部返回按钮误触会白白失去本次奇遇：先弹确认，明确告知后果，并引导下滑查看选牌。
 const close=d.querySelector<HTMLButtonElement>('.dialog-close')!;
 close.onclick=()=>{
  const stay=()=>showPokerEncounter(dialog,h,{returning:true});
  const c=open('返回商店 · 将失去本次奇遇','返回商店后本次奇遇机会立即失效，之后按真实通关重新推进，不会补发。\n下滑可查看全部可选扑克与规则说明，选好再离开也不迟。',[
   {label:'留在奇遇 · 继续查看',primary:true,run:stay},
   {label:'失去机会 · 返回商店',run:()=>{emit('Exited');dialog.close();}},
  ],{closeLabel:'返回奇遇选牌',summaryBody:'仅在确认后才会离开；误触不会直接退出奇遇。'});
  c.classList.add('poker-encounter-exit-confirm');
  c.querySelector<HTMLButtonElement>('.dialog-close')!.onclick=stay;
  c.addEventListener('cancel',e=>{e.preventDefault();stay();},{capture:true});
 };
 d.addEventListener('cancel',()=>emit('Exited'));
}
