import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
vi.mock('../src/game/CandidateCardPreview',()=>({renderToolCard:vi.fn()}));
vi.mock('../src/game/HeroDecisionEyes',()=>({mountHeroDecisionEyes:vi.fn()}));
import {showHeroDiscardChoice} from '../src/game/HeroDiscardChoice';
import {showTouyeDiscardChoice} from '../src/game/TouyeDiscardChoice';
import type {DetailDialog} from '../src/game/DetailDialog';
import {laohuanDiscardFixture} from './fixtures/laohuan-discard-handoff';
import {touyeFixture} from './fixtures/touye-new-core';

/** Only ownership, controls and selection; this is not a browser or pixel-layout simulation. */
class Node {
 children:Node[]=[];parentElement?:Node;className='';textContent='';type='';disabled=false;dataset:Record<string,string>={};attributes:Record<string,string>={};onclick?:()=>void;
 classList={add:(name:string)=>{this.className+=' '+name;}};
 constructor(readonly tagName='div'){}
 append(...nodes:Node[]){for(const node of nodes){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(n=>n!==node);node.parentElement=this;this.children.push(node);}}
 get firstElementChild(){return this.children[0]??null;}
 prepend(node:Node){if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(n=>n!==node);node.parentElement=this;this.children.unshift(node);}
 setAttribute(key:string,value:string){this.attributes[key]=value;}
 getAttribute(key:string){return this.attributes[key];}
 querySelectorAll(selector:string):Node[]{return this.children.flatMap(child=>[...(selector[0]==='.'?child.className.split(' ').includes(selector.slice(1)):child.tagName===selector)?[child]:[],...child.querySelectorAll(selector)]);}
 querySelector(selector:string):Node|null{return this.querySelectorAll(selector)[0]??null;}
 click(){if(!this.disabled)this.onclick?.();}
}
function setup(){
 const modal=new Node('dialog'),content=new Node(),scroll=new Node(),intro=new Node(),rules=new Node(),actions=new Node(),close=new Node('button');content.className='dialog-content';scroll.className='dialog-scroll';intro.className='dialog-intro';rules.className='dialog-copy';actions.className='dialog-actions';close.className='dialog-close';scroll.append(intro,rules);content.append(scroll);actions.append(close);modal.append(new Node('header'),content,actions);let active=true;
 const owner={open:vi.fn((_title:string,_body:string,_actions?:unknown,_options?:unknown)=>modal as unknown as HTMLDialogElement),active:()=>active,close:vi.fn(()=>active=false)};
 vi.stubGlobal('document',{createElement:(tag:string)=>new Node(tag)});return{modal,content,scroll,rules,actions,owner:owner as unknown as DetailDialog,open:owner.open,close:owner.close};
}
afterEach(()=>vi.unstubAllGlobals());
const xinCopy={title:'辛弃疾 · 另选弃牌',body:'确认换牌后从实际候选中留下指定张数。',summaryBody:'原出牌选择保留；从空选择开始，另选1–5张。',effectBody:'确认才花1次弃牌；多看最多2张，牌不足时全留。',nextLabel:'下一步 · 确认弃牌'};
it.each(['秦琼','辛弃疾'])('%s always exposes a disabled next action beside return outside both card and rule scrolling',hero=>{
 const f=setup(),next=vi.fn();if(hero==='秦琼')showTouyeDiscardChoice(f.owner,touyeFixture().state,()=>true,next);else showHeroDiscardChoice(f.owner,laohuanDiscardFixture(),()=>true,next,xinCopy);
 const proceed=f.modal.querySelector('.touye-discard-next')!,hint=f.modal.querySelector('.touye-discard-count')!,grid=f.modal.querySelector('.touye-discard-grid')!;expect(proceed.parentElement).toBe(f.actions);expect(hint.parentElement).toBe(f.actions);expect(f.actions.parentElement).toBe(f.modal);expect(f.scroll.querySelector('.touye-discard-next')).toBeNull();expect(proceed.disabled).toBe(true);expect(proceed.textContent).toContain('下一步');expect(hint.textContent).toBe('先选1–5张要弃的牌');expect(grid.parentElement).toBe(f.scroll);expect(f.scroll.children.at(-1)).toBe(f.rules);expect(f.open.mock.calls[0][3]).toMatchObject({collapseRules:true,rulesLabel:'收益与完整规则'});expect(next).not.toHaveBeenCalled();
});
it('keeps Qin cost, no-redraw, next-hand lock and failure risk in the visible compact intro',()=>{
 const f=setup(),run=touyeFixture().state,before=JSON.stringify(run);showTouyeDiscardChoice(f.owner,run,()=>true,vi.fn());const [title,body,,copy]=f.open.mock.calls[0] as unknown as [string,string,unknown,{effectBody:string;summaryBody:string}];expect(title).toBe('秦琼 · 另选弃牌');expect(copy.summaryBody).toContain('原出牌选择保留');expect(copy.effectBody).toContain('次弃牌');expect(copy.effectBody).toContain('不能重抽');expect(copy.effectBody).toContain('0.85');expect(copy.effectBody).toContain('不能再弃牌');expect(body).toContain('×2');expect(JSON.stringify(run)).toBe(before);
});
it('enables next after one valid card, caps selection at five, and hands off stable real IDs once without consuming',()=>{
 const f=setup(),run=laohuanDiscardFixture(),before=JSON.stringify(run),next=vi.fn();showHeroDiscardChoice(f.owner,run,()=>true,next,xinCopy);const grid=f.modal.querySelector('.touye-discard-grid')!,proceed=f.modal.querySelector('.touye-discard-next')!;
 grid.children[0].click();expect(proceed.disabled).toBe(false);expect(f.modal.querySelector('.touye-discard-count')!.textContent).toBe('已选 1/5 · 可下一步');for(let i=1;i<5;i++)grid.children[i].click();expect(grid.children[5].disabled).toBe(true);expect(next).not.toHaveBeenCalled();expect(grid.children[0].getAttribute('aria-pressed')).toBe('true');grid.children[0].click();expect(grid.children[5].disabled).toBe(false);grid.children[5].click();proceed.click();proceed.click();expect(next).toHaveBeenCalledExactlyOnceWith(run.handOrder.slice(1,6));expect(f.close).toHaveBeenCalledOnce();expect(JSON.stringify(run)).toBe(before);
});
it('stale or closed drafts cannot advance or persist intent',()=>{
 const f=setup(),run=laohuanDiscardFixture(),next=vi.fn();let valid=true;showHeroDiscardChoice(f.owner,run,()=>valid,next,xinCopy);f.modal.querySelector('.touye-discard-grid')!.children[0].click();valid=false;const proceed=f.modal.querySelector('.touye-discard-next')!;proceed.click();expect(proceed.disabled).toBe(true);expect(f.modal.querySelector('.touye-discard-count')!.textContent).toContain('已过期');expect(next).not.toHaveBeenCalled();expect(f.close).not.toHaveBeenCalled();
});
it('retains legacy footer columns and short-screen rules underneath the scoped compact workspace',()=>{
 const css=readFileSync(new URL('../src/game/TouyeDiscardChoice.css',import.meta.url),'utf8');expect(css).toMatch(/\.detail-dialog\.hero-discard-choice\[open\][\s\S]*?grid-template-rows:auto minmax\(0,1fr\) auto/);expect(css).toContain('100dvh - var(--safe-top) - var(--safe-bottom) - 24px');expect(css).toContain('100vw - var(--safe-left) - var(--safe-right) - 24px');expect(css).toMatch(/\.touye-discard-grid \{[^}]*min-height:0;overflow:auto/);expect(css).toMatch(/\.hero-discard-choice > \.dialog-actions \{[^}]*display:grid/);expect(css).toMatch(/\.hero-discard-choice \.dialog-copy \{[^}]*max-height:min\(120px,24dvh\)[^}]*overflow:auto/);expect(css).toContain('@media(max-width:560px)');expect(css).toContain('@media(max-height:520px)');
});
