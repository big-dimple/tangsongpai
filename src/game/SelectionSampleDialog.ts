import type {DetailDialog} from './DetailDialog';
import type {OpeningPlaySample} from './OpeningPlaySample';

/** Short viewports use the existing scrollable modal, without shrinking cards or costs. */
export function showSelectionSample(dialog:DetailDialog,title:string,sample:OpeningPlaySample,showAfter=false){
 const d=dialog.open(title,'',[],{closeLabel:'回到选角'});d.classList.add('selection-sample');
 const style=document.createElement('style');style.textContent=`
.selection-sample .dialog-content{display:block}.selection-sample .sample-note{font-size:14px;color:#c8bdb2;line-height:1.5}
.selection-sample .sample-label{font-size:16px;color:#f6efe0;line-height:1.5;margin:12px 0}
.selection-sample .sample-cards{display:flex;gap:3px;justify-content:center;margin:12px 0}
.selection-sample .sample-card{box-sizing:border-box;flex:1;max-width:48px;min-width:0;height:66px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:5px 0;background:#fcf6e8;border:1px solid #b8a37c;border-radius:4px;font-size:18px;font-weight:bold}
.selection-sample .sample-card[data-marked=true]{border:2px solid #d8b46c;box-shadow:0 0 8px rgba(216,180,108,.4)}.selection-sample .sample-result{font-size:16px;font-weight:bold;color:#f2cf84;line-height:1.5}
.selection-sample .sample-cost{font-size:14px;color:#ff9e8e;line-height:1.6}
.selection-sample .sample-toggle{min-height:44px;padding:8px 16px;border:1px solid rgba(216,180,108,.5);background:#231c27;color:#ffeec7;font:14px/1.4 var(--ui-font);border-radius:6px;cursor:pointer}
`;
 d.append(style);const root=document.createElement('section'),note=document.createElement('p'),label=document.createElement('p'),cards=document.createElement('div'),toggle=document.createElement('button'),result=document.createElement('p'),cost=document.createElement('p');
 note.className='sample-note';note.textContent=sample.tag+' · 规则示例，不是本局手牌或预计得分。';label.className='sample-label';label.setAttribute('aria-live','polite');cards.className='sample-cards';cards.setAttribute('aria-label','示例牌');toggle.type='button';toggle.className='sample-toggle';result.className='sample-result';result.textContent=sample.result;cost.className='sample-cost';cost.textContent='代价 · '+sample.cost;
 let after=showAfter;const paint=()=>{const row=after?sample.after:sample.before;label.textContent=row.label;cards.replaceChildren();for(const [i,value] of row.cards.entries()){const card=document.createElement('span'),rank=document.createElement('span'),suit=document.createElement('span');card.className='sample-card';card.dataset.marked=String(row.marked.includes(i));card.style.color=/[♥♦]/.test(value)?'#b8473a':'#26313a';rank.textContent=value.slice(0,-1);suit.textContent=value.slice(-1);card.append(rank,suit);cards.append(card);}toggle.textContent=after?'看原牌':'看变化';toggle.setAttribute('aria-pressed',String(after));};toggle.onclick=()=>{after=!after;paint();};paint();root.append(note,label,cards,toggle,result,cost);d.querySelector('.dialog-copy')!.append(root);return d;
}
