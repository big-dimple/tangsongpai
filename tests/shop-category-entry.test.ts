import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
import {ShopScene} from '../src/game/ShopScene';
import {workshopLayoutFixture} from '../harness/fixtures/workshop-layout';
afterEach(()=>vi.clearAllMocks());
it.each([[false,320],[false,390],[true,1180]])('four entries remain peers and opening used DIY stays read-only (pc=%s width=%s)',(pc,width)=>{
 for(const used of [false,true]){
  const run=workshopLayoutFixture().state;if(used)run.shop!.basicChoice!.purchase={} as any;const before=structuredClone(run),rows:any[]=[],scene=Object.create(ShopScene.prototype) as any;
  Object.assign(scene,{run,busy:false,workshopSelected:false,shelfKind:'jokers',geometry:()=>({pc,portrait:!pc}),shelfOffers:(kind='jokers')=>kind==='tools'?run.shop!.toolOffers:kind==='items'?run.shop!.itemOffers:run.shop!.offers,openWorkshop:vi.fn(),render:vi.fn(),add:{graphics:()=>({lineStyle(){return this;},lineBetween(){return this;}})}});Object.defineProperty(scene,'pageSize',{value:3});Object.defineProperty(scene,'audio',{value:{select:vi.fn()}});
  scene.shopButton=(box:any,text:string,id:string,click:()=>void,enabled:boolean)=>{const label:any={setFontSize(v:number){this.size=v;return this;},setAlign(){return this;},setFontStyle(v:string){this.weight=v;return this;},setColor(){return this;}},art={list:[{clear(){return this;},fillStyle(){return this;},fillRoundedRect(){return this;}},{clear(){}}],add(){}};rows.push({box,text,id,click,enabled,label});return {getData:(key:string)=>key==='label'?label:art};};
  scene.drawShelfTabs({x:12,y:120,width:width-24,height:44});const entries=rows.filter(r=>r.id!=='action/shelf-page');expect(entries).toHaveLength(4);expect(new Set(entries.map(r=>r.box.y)).size).toBe(1);expect(new Set(entries.map(r=>r.box.height))).toEqual(new Set([44]));expect(new Set(entries.map(r=>r.box.width)).size).toBe(1);expect(new Set(entries.map(r=>r.label.size)).size).toBe(1);
  const choice=entries.find(r=>r.id==='action/shelf-workshop')!;expect(choice.text).toBe(pc?'自选做牌 · '+(used?'0':'1'):'自选做牌\n'+(used?'0':'1'));expect(choice.label.weight).toBe('normal');expect(choice.enabled).toBe(true);choice.click();expect(scene.openWorkshop).toHaveBeenCalledOnce();expect(run).toEqual(before);
  if(pc){
   scene.shelfOffers=(kind='jokers')=>kind==='jokers'?[...run.shop!.offers,...run.shop!.offers]:kind==='tools'?run.shop!.toolOffers:run.shop!.itemOffers;
   const categories=()=>rows.filter(r=>r.id!=='action/shelf-page').map(r=>r.box);rows.length=0;scene.drawShelfTabs({x:12,y:120,width:width-24,height:44});const stock=categories();
   scene.workshopSelected=true;rows.length=0;scene.drawShelfTabs({x:12,y:120,width:width-24,height:44});expect(categories()).toEqual(stock);
  }
 }
});

it('short PC DIY opens the shared category workspace without changing the saved run',()=>{
 const run=workshopLayoutFixture().state,before=structuredClone(run),scene=Object.create(ShopScene.prototype) as any,close=vi.fn(),render=vi.fn();
 Object.assign(scene,{run,busy:false,workshopSelected:false,geometry:()=>({pc:null,portrait:false,desktopHeader:{}}),dialog:{close},render});
 scene.inspectMakeCards();expect(scene.workshopSelected).toBe(true);expect(close).toHaveBeenCalledOnce();expect(render).toHaveBeenCalledOnce();expect(run).toEqual(before);
});
