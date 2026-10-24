import type {R2RunState} from '../domain/run';
import type {R2Offer} from '../domain/r2Shop';
import {RANKS,SUITS,rankLabel,SUIT_SYMBOL,type Rank,type Suit} from '../cards/types';
import type {ShopServiceEntry} from './ShopServiceDialog';
import {WORKSHOP_GOALS,workshopChoices,workshopIntent,workshopStraightAdvice,type WorkshopIntent} from './WorkshopModel';
import type {MakeCardsView} from './MakeCardsDialog';
import {cardArtSource} from './CardArtSource';
import {openCardArtZoom} from './CardArtZoomModal';
import {isR2CoreBuild} from '../domain/r2GroupUpgrade';
import {setSuitText,SUIT_TEXT_INK,SUIT_TEXT_NAMES} from './SuitSymbols';
import './WorkshopGoals.css';

interface WorkshopActions {ready:()=>boolean;purchaseReason:(offer:R2Offer)=>string|undefined;basic:(id:string,intent?:WorkshopIntent)=>void;offer:(id:string,intent?:WorkshopIntent)=>void;services:readonly ShopServiceEntry[];active:()=>boolean}
/** Goal selection and optional directory filters only. Existing adapters own every quote and command. */
export function mountWorkshopGoals(host:HTMLElement,run:R2RunState,view:MakeCardsView,actions:WorkshopActions):()=>void {
  const choices=workshopChoices(run),nav=document.createElement('nav'),workspace=document.createElement('section');nav.className='workshop-goal-nav';nav.setAttribute('aria-label','自选做牌目标');workspace.className='workshop-goal-workspace';
  const root=document.createElement('div');root.className='workshop-route-root';root.textContent=run.shop?.basicChoice?.purchase?'本店机会已用':'本店共享 1 次';host.append(root);
  let opened:HTMLDialogElement|undefined;
  const live=()=>actions.active()&&actions.ready();
  const art=(row:typeof choices[number])=>{
    const image=document.createElement('img');image.src=row.info.artUrl;image.alt=row.info.name;image.width=72;image.height=90;image.decoding='async';image.loading='lazy';
    return image;
  };
  const zoom=(row:typeof choices[number])=>{
    if(!cardArtSource(row.id))return;
    const b=document.createElement('button');b.type='button';b.className='workshop-art-zoom';b.textContent='看原图';b.title='看原图';b.setAttribute('aria-label','放大鉴赏'+row.info.name);b.setAttribute('aria-haspopup','dialog');b.onclick=()=>{b.focus({preventScroll:true});opened=openCardArtZoom(row.id,row.info.name);};return b;
  };
  const render=()=>{
    opened?.close();workspace.replaceChildren();
    const used=!!run.shop?.basicChoice?.purchase,goal=WORKSHOP_GOALS.find(g=>g.id===view.workshopTab);host.classList.toggle('has-workshop-goal',!!goal);
    nav.dataset.selected=goal?.id??'';nav.dataset.used=String(used);
    for(const b of nav.querySelectorAll<HTMLButtonElement>('button')){const selected=b.dataset.workshopGoal===goal?.id,unsupported=b.dataset.workshopGoal==='upgrade'?!isR2CoreBuild(run):b.dataset.workshopGoal==='dyes'?!choices.some(c=>c.group==='dyes'):false,blocked=used||unsupported;b.setAttribute('aria-pressed',String(selected));b.disabled=blocked;b.dataset.crossed=String(used);b.querySelector('.workshop-route-state')!.textContent=used?'已用 ×':unsupported?'此局未开放':selected?'当前路线':'选择';}
    const choose=(id:string,intent:WorkshopIntent|undefined,next:()=>void)=>{if(!live())return;view.focusId=id;view.intent=intent;next();};
    const renderOther=(entries:typeof choices,title:string)=>{if(!entries.length)return;const more=document.createElement('section'),label=document.createElement('h3');more.className='workshop-other';more.setAttribute('aria-label',title);label.textContent=title;more.append(label);
      for(const row of entries){const line=document.createElement('div'),text=document.createElement('span'),price=document.createElement('span'),b=document.createElement('button');line.className='workshop-other-row';line.dataset.makeId=row.id;text.textContent=row.info.name+' · '+row.purpose;const reason=row.duplicate?(row.duplicate.consumed?'随机现货已售':actions.purchaseReason(row.duplicate)):row.reason;price.className='workshop-row-price';price.textContent=reason??`实付 ${row.price} 金 ›`;b.type='button';b.className='workshop-operation-main';b.append(art(row),text,price);b.disabled=!!reason||!live();b.onclick=()=>choose(row.id,undefined,()=>row.duplicate?actions.offer(row.duplicate!.offerId):actions.basic(row.id));line.append(b);const z=zoom(row);if(z){line.className+=' has-art-zoom';line.append(z);}more.append(line);}workspace.append(more);};
    const other=choices.filter(row=>row.group==='other');
    if(!goal){const hint=document.createElement('p');hint.className='workshop-route-hint';hint.textContent=used?'下一店恢复共享机会。':'选一路，查看目标与实付费用。';workspace.append(hint);}
    if(goal){
    if(!used){const back=document.createElement('button');back.type='button';back.className='workshop-route-back';back.textContent='‹ 返回选择路线';back.onclick=()=>{view.workshopTab=undefined;view.intent=undefined;render();};workspace.append(back);}
    const title=document.createElement('h3'),description=document.createElement('p');title.textContent=goal.title;description.textContent=goal.description;description.className='workshop-goal-description';workspace.append(title,description);
    const list=document.createElement('div');list.className='workshop-operations';workspace.append(list);
    if(goal.id==='upgrade'){
      for(const service of actions.services){
        const row=document.createElement('article'),copy=document.createElement('span'),name=document.createElement('strong'),summary=document.createElement('span'),price=document.createElement('span'),b=document.createElement('button');row.className='workshop-service';row.dataset.serviceId=service.id;name.textContent=service.title;summary.textContent=service.summary;summary.className='workshop-row-summary';copy.append(name,summary);price.className='workshop-row-price';price.textContent=service.unavailable??`实付 ${service.price} 金 ›`;b.type='button';b.className='workshop-service-main';b.append(copy,price);b.disabled=!!service.unavailable||!live();b.onclick=()=>choose(service.id,undefined,service.choose);row.append(b);list.append(row);
      }
      if(!actions.services.length){const empty=document.createElement('p');empty.className='workshop-empty';empty.textContent=run.shop?.basicChoice?.purchase?'本店共享机会已用，下一店恢复。':'目前没有可升级的已发现牌型；未发现或已达上限的牌型不能升级。';list.append(empty);}
    }else{
      const control=document.createElement('label'),select=document.createElement('select'),all=document.createElement('option');control.className='workshop-goal-filter';control.textContent=goal.id==='modify'?'想调整哪个点数？':'从哪种花色里挑？';all.value='';all.textContent=goal.id==='modify'?'不限点数 · 直接选牌':'不限原花色 · 直接选牌';select.append(all);
      if(goal.id==='modify')for(const rank of RANKS){const count=run.deckInstances.filter(c=>!run.destroyedIds.includes(c.id)&&c.rank===rank).length;if(!count)continue;const option=document.createElement('option');option.value=String(rank);option.textContent=rankLabel(rank)+' · '+count+'张';select.append(option);}
      else for(const suit of SUITS){const option=document.createElement('option');option.value=suit;option.textContent=SUIT_SYMBOL[suit]+' '+SUIT_TEXT_NAMES[suit];option.style.color=suit==='hearts'||suit==='diamonds'?SUIT_TEXT_INK.red:SUIT_TEXT_INK.black;select.append(option);}
      select.setAttribute('aria-label',goal.id==='modify'?'自选原点数':'自选原花色');select.value=goal.id==='modify'?view.rankGoal??'':view.suitGoal??'';select.onchange=()=>{if(goal.id==='modify')view.rankGoal=select.value;else view.suitGoal=select.value;render();workspace.querySelector<HTMLSelectElement>('select')?.focus({preventScroll:true});};control.append(select);workspace.insertBefore(control,list);
      if(goal.id==='modify'){
        const advice=workshopStraightAdvice(run,actions.purchaseReason);
        if(advice.kind==='gap'){
          const panel=document.createElement('details'),heading=document.createElement('summary');panel.className='workshop-straight-advice';heading.textContent='顺子补点参考 · 只看当前牌组';panel.append(heading);
          for(const goal of advice.goals.slice(0,2)){
            const option=goal.options[0],line=document.createElement('p'),before=goal.countsBefore.map(r=>rankLabel(r.rank)+':'+r.count).join(' · '),after=option.countsAfter.map(r=>rankLabel(r.rank)+':'+r.count).join(' · ');
            line.textContent=goal.label+'：缺口 '+goal.deficientRanks.map(rankLabel).join('/')+'；'+option.reason+'。\n张数 '+before+' → '+after+'。\n'+option.costText+'；仍需自己选工具、目标并确认。';panel.append(line);
          }
          const caveat=document.createElement('p');caveat.textContent=advice.goals[0].caveat;panel.append(caveat);workspace.insertBefore(panel,list);
        }
      }
      if(goal.id==='dyes'){const preview=document.createElement('span');preview.className='workshop-suit-preview suit-select-preview';preview.setAttribute('aria-live','polite');const suit=SUITS.find(s=>s===view.suitGoal);setSuitText(preview,suit?'原花色：'+SUIT_SYMBOL[suit]+' '+SUIT_TEXT_NAMES[suit]:'原花色不限');control.append(preview);}
      for(const row of choices.filter(row=>row.group===goal.id)){
        const filter=goal.id==='modify'&&view.rankGoal?{rank:Number(view.rankGoal) as Rank}:goal.id==='dyes'&&view.suitGoal?{suit:view.suitGoal as Suit}:{};
        const projected=workshopIntent(run,row.id,filter),reason=projected.reason??(row.duplicate?(row.duplicate.consumed?'同名随机现货已售。':actions.purchaseReason(row.duplicate)):row.reason);
        const article=document.createElement('article'),copy=document.createElement('span'),name=document.createElement('strong'),summary=document.createElement('span'),source=document.createElement('small'),price=document.createElement('span'),b=document.createElement('button');article.className='workshop-operation';article.dataset.makeId=row.id;setSuitText(name,projected.intent.label);summary.className='workshop-row-summary';summary.textContent=(row.tool.target.kind==='cards'?`自己选 ${row.tool.target.minimum}–${row.tool.target.maximum} 张 · `:'')+(row.group==='modify'?'花色不变':'点数不变');source.textContent=reason??`可改变 ${projected.count} 张`+(row.duplicate?' · 同名随机现货，按现货价购买':' · 自选共享次数');copy.append(name,summary,source);price.className='workshop-row-price';price.textContent=reason?'暂不可选':`实付 ${row.price} 金 ›`;b.type='button';b.className='workshop-operation-main';b.append(art(row),copy,price);b.disabled=!!reason||!live();b.onclick=()=>choose(row.id,projected.intent,()=>row.duplicate?actions.offer(row.duplicate!.offerId,projected.intent):actions.basic(row.id,projected.intent));article.append(b);const z=zoom(row);if(z){article.className+=' has-art-zoom';article.append(z);}list.append(article);
      }
    }
    }
    // 大字号 leads only its original group, after the selected route's controls.
    renderOther([...other.filter(row=>row.id==='T11'),...other.filter(row=>row.id!=='T11')],'其他改牌工具');
  };
  for(const goal of WORKSHOP_GOALS){const b=document.createElement('button'),title=document.createElement('strong'),purpose=document.createElement('span'),state=document.createElement('span');b.type='button';title.textContent=goal.id==='upgrade'?'升级牌型':goal.id==='modify'?'改牌':'染色';purpose.className='workshop-route-purpose';purpose.textContent=goal.id==='upgrade'?'强化牌型':goal.title;state.className='workshop-route-state';b.append(title,purpose,state);b.dataset.workshopGoal=goal.id;b.onclick=()=>{if(!actions.active()||b.disabled)return;view.workshopTab=view.workshopTab===goal.id?undefined:goal.id;view.intent=undefined;render();};nav.append(b);}
  host.append(nav,workspace);render();return()=>{opened?.close();};
}
