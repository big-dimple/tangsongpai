import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {nativeHeroRuntime} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());

function descendants(list:Phaser.GameObjects.GameObject[],out:Phaser.GameObjects.GameObject[]=[]){
 for(const object of list){out.push(object);const children=(object as Phaser.GameObjects.Container).list;if(children)descendants(children,out);}
 return out;
}

it('group releases attach to each real card without a synthetic union target or gap label',()=>{
 const f=nativeHeroRuntime({width:390,height:844,density:2,renderer:2}),cards=new Map([
  ['active/a',f.card('active/a',{x:92,y:430,width:72,height:100})],
  ['active/b',f.card('active/b',{x:298,y:430,width:72,height:100})],
 ]),abort=new AbortController(),context={generation:3,signal:abort.signal};
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:72,height:100}:undefined;},source:()=>({x:40,y:70}),motion:()=> 'full',blocked:()=>false});
 try{
  layer.preview({key:'saved/group',targetId:'active/a',targetIds:[...cards.keys()],kind:'group',label:'本手待放',resolvedLabel:'已释放',releaseReason:'azao.multiply-multiplier'});
  f.step(16);
  const all=descendants(f.root.list),edges=all.filter(object=>object.name==='hero/target-edge'),tags=all.filter(object=>object.name==='hero/target-tag');
  expect(edges.map(object=>object.getData('targetId')).sort()).toEqual([...cards.keys()].sort());
  expect(edges.every(object=>!String(object.getData('targetId')).startsWith('group/'))).toBe(true);
  expect(tags).toHaveLength(1);
  expect(tags[0].getData('targetId')).toBe('active/a');
  expect([...cards.values()].every(card=>card.list.some(object=>object.name==='hero/target-edge'))).toBe(true);
  layer.commit('saved/group',context);layer.release({eventId:'saved/group',reasonKey:'azao.multiply-multiplier'},context);
  for(let time=32;time<600;time+=16)f.step(time);
  expect(descendants(f.root.list).filter(object=>object.name==='hero/target-edge')).toHaveLength(0);
 }finally{abort.abort();layer.destroy();f.root.destroy();f.step(650);}
});
