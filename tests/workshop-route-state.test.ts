import {afterEach,expect,it,vi} from 'vitest';
import {applyCommand,createRun,type Action,type R2RunState} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {workshopChoices,type WorkshopTab} from '../src/game/WorkshopModel';
import type {MakeCardsView} from '../src/game/MakeCardsDialog';
vi.mock('../src/game/CardArtSource',()=>({cardArtSource:()=>undefined}));
vi.mock('../src/game/CardArtZoomModal',()=>({openCardArtZoom:vi.fn()}));
import {mountWorkshopGoals} from '../src/game/WorkshopGoals';

/** Only the native element operations used by this component; no browser or game fixture. */
class Element {
 className='';textContent='';dataset:Record<string,string>={};style:Record<string,string>={};disabled=false;value='';onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;
 children:Element[]=[];attributes:Record<string,string>={};
 constructor(readonly tag:string){}
 classList={toggle:(name:string,on:boolean)=>{const names=new Set(this.className.split(' ').filter(Boolean));if(on)names.add(name);else names.delete(name);this.className=[...names].join(' ');}};
 append(...nodes:Element[]){this.children.push(...nodes);}
 replaceChildren(...nodes:Element[]){this.children=[...nodes];}
 insertBefore(node:Element,before:Element){const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,node);}
 setAttribute(name:string,value:string){this.attributes[name]=value;}
 querySelectorAll(selector:string):Element[]{return this.children.flatMap(n=>[...(selector[0]==='.'?n.className.split(' ').includes(selector.slice(1)):n.tag===selector)?[n]:[],...n.querySelectorAll(selector)]);}
 querySelector(selector:string){return this.querySelectorAll(selector)[0];}
 focus(){}
 click(){if(!this.disabled)this.onclick?.();}
}
afterEach(()=>vi.unstubAllGlobals());
function fixture(){const run=createRun({rulesVersion:'r2',runId:'workshop-routes',seed:'workshop-routes',characterId:'laohuan',r2Identity:newRunIdentity('laohuan','group'),openingRoute:'group'});run.gold=30;run.handLevels.pair=1;return run;}
function mount(run=fixture(),view:MakeCardsView={pane:'purchase',positions:{owned:0,purchase:0}}){
 vi.stubGlobal('document',{createElement:(tag:string)=>new Element(tag),createTextNode:(text:string)=>{const node=new Element('#text');node.textContent=text;return node;}});
 const host=new Element('section'),basic=vi.fn(),offer=vi.fn(),service=vi.fn(),gate={active:true};
 mountWorkshopGoals(host as unknown as HTMLElement,run,view,{ready:()=>true,active:()=>gate.active,purchaseReason:()=>undefined,basic,offer,services:[{id:'pair',title:'对子',summary:'升1级',price:3,choose:service}]});
 const nav=host.querySelector('.workshop-goal-nav')!,route=(id:WorkshopTab)=>nav.children.find(b=>b.dataset.workshopGoal===id)!;
 return {host,view,route,basic,offer,service,gate};
}
function switchable(ui:ReturnType<typeof mount>){for(const id of ['upgrade','modify','dyes'] as const){expect(ui.route(id).disabled).toBe(false);expect(ui.route(id).dataset.crossed).toBe('false');}}
function dye(run:R2RunState){return workshopChoices(run).find(r=>r.group==='dyes'&&!r.duplicate)!;}
function command(run:R2RunState,action:Action){return {runId:run.runId,commandId:run.runId+'/command/'+(run.commandSeq+1),expectedSeq:run.commandSeq,action};}

it('defaults to upgrade, keeps one selected route on repeat clicks and switches without quoting or mutating the run',()=>{
 const run=fixture(),before=structuredClone(run),ui=mount(run);switchable(ui);
 expect(ui.view.workshopTab).toBe('upgrade');expect(ui.route('upgrade').attributes['aria-pressed']).toBe('true');expect(ui.host.querySelector('.workshop-service')).toBeTruthy();
 for(const id of ['upgrade','dyes','dyes','modify','upgrade','dyes'] as const){ui.route(id).click();expect(ui.view.workshopTab).toBe(id);expect(ui.route(id).attributes['aria-pressed']).toBe('true');expect(ui.host.querySelectorAll('button').filter(b=>b.attributes['aria-pressed']==='true')).toHaveLength(1);expect(ui.host.querySelector('.workshop-route-root')!.textContent).toBe('本店共享 1 次');expect(ui.host.querySelectorAll('.workshop-route-purpose')).toHaveLength(3);switchable(ui);}
 const restored=mount(run,ui.view);expect(restored.view.workshopTab).toBe('dyes');expect(restored.route('dyes').attributes['aria-pressed']).toBe('true');
 expect(ui.basic).not.toHaveBeenCalled();expect(ui.offer).not.toHaveBeenCalled();expect(ui.service).not.toHaveBeenCalled();expect(run).toEqual(before);
 ui.gate.active=false;ui.route('modify').click();expect(ui.view.workshopTab).toBe('dyes');
});
it('a canceled target/quote leaves all routes reachable, clears the old preview intent on switching and spends nothing',()=>{
 const run=fixture(),before=structuredClone(run),ui=mount(run);ui.route('dyes').click();
 const row=ui.host.querySelectorAll('.workshop-operation').find(n=>n.dataset.makeId===dye(run).id)!;row.querySelector('button')!.click();
 expect(ui.basic).toHaveBeenCalledOnce();expect(ui.view.intent?.definitionId).toBe(dye(run).id);
 // Opening the adapter is a quote; canceling it never dispatches a domain command.
 ui.route('modify').click();expect(ui.view.intent).toBeUndefined();switchable(ui);ui.route('upgrade').click();switchable(ui);expect(run).toEqual(before);
});
it('insufficient balance disables operations without locking route browsing or consuming the shared opportunity',()=>{
 const run=fixture();run.gold=0;const before=structuredClone(run),ui=mount(run);ui.route('dyes').click();
 const row=ui.host.querySelectorAll('.workshop-operation').find(n=>n.dataset.makeId===dye(run).id)!;expect(row.querySelector('button')!.disabled).toBe(true);row.querySelector('button')!.click();expect(ui.basic).not.toHaveBeenCalled();
 expect(applyCommand(run,command(run,{type:'BuyBasicTool',definitionId:dye(run).id,shopSeq:run.shop!.basicChoice!.shopSeq}))).toMatchObject({ok:false,code:'not-enough-gold'});
 ui.route('modify').click();switchable(ui);ui.route('upgrade').click();switchable(ui);expect(run).toEqual(before);
});
it('keeps each dye title and from/to preview in red or dark suit ink, with a visible named preview beside native options',()=>{
 const ui=mount();ui.route('dyes').click();const symbols=()=>ui.host.querySelectorAll('.workshop-operation').flatMap(row=>row.querySelector('strong')!.querySelectorAll('.suit-symbol'));
 expect(new Set(symbols().map(n=>n.dataset.suit))).toEqual(new Set(['hearts','diamonds','spades','clubs']));
 const check=(nodes:Element[])=>{for(const n of nodes)expect(n.className).toContain(n.dataset.suit==='hearts'||n.dataset.suit==='diamonds'?'suit-symbol--red':'suit-symbol--black');};check(symbols());
 const select=ui.host.querySelector('select')!;expect(select.children.find(n=>n.value==='hearts')!.style.color).toBe('#9F3228');expect(select.children.find(n=>n.value==='spades')!.style.color).toBe('#26313A');
 select.value='hearts';select.onchange!();const preview=ui.host.querySelector('.workshop-suit-preview')!;check(preview.querySelectorAll('.suit-symbol'));expect(preview.querySelector('.suit-symbol')!.dataset.suit).toBe('hearts');expect(preview.children.map(n=>n.textContent).join('')).toContain('红桃');check(symbols());
 const toSpades=ui.host.querySelectorAll('.workshop-operation').find(row=>row.dataset.makeId==='T06')!;expect(toSpades.querySelectorAll('.suit-symbol').map(n=>n.dataset.suit)).toEqual(['hearts','spades']);
});
it.each(['BuyBasicTool','PracticeHand'] as const)('locks routes only after successful %s, and replay charges/records exactly once',type=>{
 const run=fixture(),action:Action=type==='BuyBasicTool'?{type,definitionId:dye(run).id,shopSeq:run.shop!.basicChoice!.shopSeq}:{type,handType:'pair',expectedLevel:1,shopSeq:run.shop!.basicChoice!.shopSeq},c=command(run,action),result=applyCommand(run,c);expect(result.ok).toBe(true);if(!result.ok)return;
 const after=result.state,ui=mount(after);for(const id of ['upgrade','modify','dyes'] as const){expect(ui.route(id).disabled).toBe(true);expect(ui.route(id).dataset.crossed).toBe('true');ui.route(id).click();}expect(ui.view.workshopTab).toBe('upgrade');
 expect(after.shop!.basicChoice!.purchase).toBeTruthy();expect(after.shop!.purchases).toBe(run.shop!.purchases+1);expect(after.commandSeq).toBe(run.commandSeq+1);expect(run.gold-after.gold).toBe(after.shop!.basicChoice!.purchase!.paidPrice);
 const saved=structuredClone(after),replayed=applyCommand(after,c);expect(replayed).toMatchObject({ok:true,duplicate:true,state:saved});expect(after).toEqual(saved);
});

it('straight advice in the existing modify panel is read-only and never preselects or buys a tool',()=>{
 const run=fixture();run.destroyedIds=run.deckInstances.filter(c=>c.rank===8).slice(0,3).map(c=>c.id);const before=JSON.stringify(run),host=new Element('section'),view:MakeCardsView={pane:'purchase',positions:{owned:0,purchase:0},workshopTab:'modify'},basic=vi.fn(),offer=vi.fn();
 vi.stubGlobal('document',{createElement:(tag:string)=>new Element(tag),createTextNode:(text:string)=>Object.assign(new Element('#text'),{textContent:text})});
 mountWorkshopGoals(host as unknown as HTMLElement,run,view,{ready:()=>true,active:()=>true,purchaseReason:()=>undefined,basic,offer,services:[]});
 const panel=host.querySelector('.workshop-straight-advice');expect(panel).toBeTruthy();const text=(n:Element):string=>n.textContent+' '+n.children.map(text).join(' ');expect(text(panel!)).toContain('张数');expect(text(panel!)).toContain('实付');expect(text(panel!)).toContain('仍需自己选工具');expect(panel!.querySelectorAll('button')).toHaveLength(0);expect(view.rankGoal).toBeUndefined();expect(view.focusId).toBeUndefined();expect(basic).not.toHaveBeenCalled();expect(offer).not.toHaveBeenCalled();expect(JSON.stringify(run)).toBe(before);
});

it('keeps 大字号 first only inside the expanded other-tools group after the route controls',()=>{
 const run=fixture(),before=structuredClone(run),ui=mount(run),expected=workshopChoices(run).filter(row=>row.group==='other').map(row=>row.id);
 for(const route of [undefined,'modify','dyes','upgrade'] as const){if(route)ui.route(route).click();const rows=ui.host.querySelectorAll('.workshop-other-row'),groups=ui.host.querySelectorAll('.workshop-other'),workspace=ui.host.querySelector('.workshop-goal-workspace')!;expect(groups).toHaveLength(1);expect(groups[0].querySelector('h3')!.textContent).toBe('其他改牌工具');expect(workspace.children.at(-1)).toBe(groups[0]);expect(ui.host.children.indexOf(ui.host.querySelector('.workshop-goal-nav')!)).toBeLessThan(ui.host.children.indexOf(workspace));expect(rows.map(row=>row.dataset.makeId).sort()).toEqual([...expected].sort());expect(rows[0].dataset.makeId).toBe('T11');expect(ui.host.querySelectorAll('details').some(n=>n.className==='workshop-other')).toBe(false);expect(rows[0].querySelector('span')!.textContent).toContain('大字号');}
 expect(run).toEqual(before);expect(ui.basic).not.toHaveBeenCalled();expect(ui.offer).not.toHaveBeenCalled();
});
