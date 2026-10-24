import {afterEach,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Scene:class{}}}));
vi.mock('../src/game/BossAtmosphere',()=>({syncBossAtmosphere:vi.fn()}));
import {syncBossAtmosphere} from '../src/game/BossAtmosphere';
import {ShopScene} from '../src/game/ShopScene';
import {layout} from '../src/game/layout';
import {shopLayout} from '../src/game/ShopLayout';
import {shopBossPreparation} from '../src/game/ShopBossPreparation';
import {workshopLayoutFixture,workshopBossTransition} from '../harness/fixtures/workshop-layout';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it.each([[320,568,0],[390,740,34],[1180,757,0],[1180,757,34],[1280,768,0],[1366,768,0],[1920,1080,0]])('Boss decoration preserves the ordinary functional regions at %sx%s safe-bottom %s', (width,height,bottom)=>{
 const l=layout({width,height},{top:0,right:0,bottom,left:0}),app={x:0,y:0,width,height};
 vi.stubGlobal('document',{documentElement:{},querySelector:()=>null,getElementById:()=>({getBoundingClientRect:()=>app})});
 vi.stubGlobal('getComputedStyle',()=>({getPropertyValue:(key:string)=>key==='--safe-bottom'?String(bottom):'0'}));
 const scene=Object.create(ShopScene.prototype) as any;scene.view={layout:l};Object.defineProperty(scene,'ready',{get:()=>false});scene.shelfKind='jokers';scene.jokerCopy=()=>undefined;
 const boss=workshopBossTransition().before;expect(shopBossPreparation(boss)).toBeTruthy();
 for(const owned of [0,1,5]){
  const jokers=workshopLayoutFixture(owned).state.jokers;scene.run={...workshopLayoutFixture().state,jokers};const ordinary=scene.geometry();
  scene.run={...boss,jokers};const preparation=scene.geometry();
  const expected=shopLayout(width,height,l.hud.y,bottom,3,false,false,0,0,owned);
  if(width===1180&&height===757&&bottom===0)expect(ordinary.pc).toBeTruthy();
  expect(preparation).toEqual(expected);expect(preparation).toEqual(ordinary);
  scene.syncBossPreparation();expect(vi.mocked(syncBossAtmosphere).mock.lastCall?.[4].ghostArea).toBeUndefined();
 }
});
