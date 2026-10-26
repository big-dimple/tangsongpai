import {expect,it} from 'vitest';
import {createRun} from '../src/domain/run';
import {newRunIdentity} from '../src/game/RunLaunch';
import {workshopChoices,workshopIntent,workshopStraightAdvice} from '../src/game/WorkshopModel';
import {shopLayout,shopPortraitHeader,shopSharedContent} from '../src/game/ShopLayout';
import {intersects} from '../src/game/layout';
import {workshopLayoutFixture} from '../harness/fixtures/workshop-layout';
const fixture=()=>createRun({rulesVersion:'r2',runId:'workshop-goals',seed:'workshop-goals',characterId:'laohuan',r2Identity:newRunIdentity('laohuan','group'),openingRoute:'group'});
it('controlled browser samples pass the unchanged strict checkpoint validator',()=>{for(const n of [0,5])for(const duplicate of [false,true])expect(workshopLayoutFixture(n,duplicate).state.jokers).toHaveLength(n);});
it('expanded real four-card stock remains valid for the native paging supplement',()=>{expect(workshopLayoutFixture(5,false,true).state.shop!.offers).toHaveLength(4);});
it('projects supported shifts, true A/2 limits and real suits without mutating or selecting cards',()=>{
 const run=fixture(),before=structuredClone(run);
 expect(workshopIntent(run,'T08',{rank:8})).toMatchObject({intent:{filter:{rank:8},label:'8 → 9'},count:4});
 expect(workshopIntent(run,'T08',{rank:13}).intent.label).toBe('K → A');
 expect(workshopIntent(run,'T08',{rank:14}).count).toBe(0);
 expect(workshopIntent(run,'T09',{rank:2}).reason).toBeTruthy();
 expect(workshopIntent(run,'T03',{suit:'hearts'}).count).toBe(0);
 expect(workshopIntent(run,'T03',{suit:'spades'}).count).toBe(13);
 expect(run).toEqual(before);
});
it('retains actual duplicate-offer price and unavailable shared quota from the domain projection',()=>{
 const run=fixture();run.gold=40;run.shop!.toolOffers[0].definitionId='T08';run.shop!.toolOffers[0].price=7;
 const duplicate=workshopChoices(run).find(r=>r.id==='T08')!;expect(duplicate.price).toBe(7);expect(duplicate.duplicate?.offerId).toBe(run.shop!.toolOffers[0].offerId);
 run.shop!.basicChoice!.purchase={definitionId:'T11',commandId:'used',paidPrice:2,seq:run.commandSeq};
 expect(workshopChoices(run).filter(r=>!r.duplicate).every(r=>!!r.reason)).toBe(true);
});
it('uses one selected-category region and keeps the unique large entry separate at empty and full ownership',()=>{
 for(const [w,h] of [[1000,768],[1366,900],[1912,954]])for(const n of [0,5]){const p=shopLayout(w,h,8,0,3,false,false,0,0,n),pc=p.pc!;expect(pc).toBeTruthy();for(const b of [pc.toolOffers,pc.workshop,pc.itemOffers])expect(b).toEqual(pc.shared);for(const b of pc.jokerOffers){expect(intersects(b,p.play)).toBe(false);expect(b.y).toBe(pc.shared.y);}expect(shopSharedContent(p,n)).toEqual(pc.shared);expect(p.play.width).toBeGreaterThanOrEqual(220);expect(pc.ownedRail).toEqual(shopLayout(w,h,8,0,3,false,false,0,0,n?0:5).pc!.ownedRail);expect(pc.ownedRail.height).toBeGreaterThan(p.slots[0].height);}
});
it('reserves four mobile categories with independent compact inventory and refresh, and a single shared workspace instead of empty decoration',()=>{
 for(const [w,h] of [[320,568],[360,640],[390,740],[430,932]]){
  const p=shopLayout(w,h,12,0,3),header=shopPortraitHeader(p),controls=[header.purse,header.inventory,header.reroll];
  for(const [i,b] of controls.entries()){expect(b.x).toBeGreaterThanOrEqual(0);for(const next of controls.slice(i+1))expect(intersects(b,next)).toBe(false);expect(intersects(b,p.tabs)).toBe(false);}
  for(const n of [0,5]){const region=shopSharedContent(p,n)!;expect(region.y).toBeGreaterThanOrEqual(p.tabs.y+p.tabs.height);expect(intersects(region,p.build)).toBe(false);expect(intersects(region,p.play)).toBe(false);if(n&&!p.inventoryCollapsed)for(const slot of p.slots)expect(intersects(region,slot)).toBe(false);}
 }
});

it('straight advice adapter uses current paid stock and shared-quota availability, excluding destroyed cards',()=>{
 const run=fixture();run.gold=40;run.destroyedIds=run.deckInstances.filter(c=>c.rank===8).slice(0,3).map(c=>c.id);run.shop!.toolOffers[0].definitionId='T08';run.shop!.toolOffers[0].price=7;const before=JSON.stringify(run),advice=workshopStraightAdvice(run,()=>undefined);expect(advice.kind).toBe('gap');if(advice.kind!=='gap')throw Error('no gap');const stock=advice.goals.flatMap(g=>g.options).filter(o=>o.definitionId==='T08');expect(stock.length).toBeGreaterThan(0);expect(stock.every(o=>o.paidPrice===7&&o.quotaCost===0)).toBe(true);expect(JSON.stringify(run)).toBe(before);
 run.shop!.basicChoice!.purchase={definitionId:'T11',commandId:'used',paidPrice:2,seq:run.commandSeq};const blocked=workshopStraightAdvice(run,()=> '现货不可购');expect(blocked.kind).toBe('none');
});
