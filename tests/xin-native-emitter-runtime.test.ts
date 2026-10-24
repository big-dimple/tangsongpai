import {afterEach,expect,it,vi} from 'vitest';
import type Phaser from 'phaser';
import {HeroSkillParticles} from '../src/game/HeroSkillParticles';
import {heroAtmosphereStyle} from '../src/game/HeroCardAttachmentAtmosphere';
import {HeroTargetAttachment} from '../src/game/HeroTargetAttachment';
import {layout} from '../src/game/layout';
import {nativeHeroRuntime,nativeLiving as living,nativeNontransparent as nontransparent,nativeMaterials} from './fixtures/native-hero-runtime';

afterEach(()=>vi.unstubAllGlobals());
function runtime(){
 const f=nativeHeroRuntime(),box={x:574,y:505.6,width:92,height:128.8},card=f.card('hearts-5',box),owner=new HeroSkillParticles(f.scene),style=heroAtmosphereStyle({key:'saved',targetId:'hearts-5',releaseReason:'laohuan.refill'});return{...f,card,owner,style,box};
}
it('real Phaser emitters and death zones keep Xin particles alive and nontransparent beyond the reveal',()=>{
 const f=runtime();f.owner.sync('saved/choose',[{id:'hearts-5',container:f.card,width:92,height:128.8}],f.style,f.root,[f.box],true,true,{phase:'retained',igniteIds:['hearts-5']});
 try{let alive=0,visible=0;for(let time=0;time<3200;time+=16){f.step(time);for(const emitter of f.emitters){alive+=emitter.getAliveParticleCount();visible+=living(emitter).filter(nontransparent).length;}}expect(alive).toBeGreaterThan(100);expect(visible).toBeGreaterThan(100);}finally{f.owner.clear();f.root.destroy();f.step(3200);expect(f.scene.sys.updateList.getActive().length).toBe(0);}
});
it.each(['candidate','selected','retained'] as const)('actual Phaser containers keep visible %s material inside each real card and outside print for3.2s',phase=>{
 const f=runtime();f.card.destroy();const candidate=phase!=='retained',l=layout({width:1280,height:720},{top:0,right:0,bottom:0,left:0},'desktop',{count:candidate?3:8}),cards=new Map<string,Phaser.GameObjects.Container>(),ids=candidate?['spades-2','hearts-5','clubs-10']:Array.from({length:8},(_,i)=>i===4?'hearts-5':'ordinary/'+i);
 for(const [i,id]of ids.entries()){const b=l.cards[i].visual,c=new f.Container(f.scene,b.x+b.width/2,b.y+b.height/2).setData('cardFace',true).setData('cardId',id).setData('width',b.width).setData('height',b.height);const face=new f.Zone(f.scene,0,0,b.width-2,b.height-2);face.type='Image';face.texture={key:'paper'};c.add(face);const rank=f.text(-b.width/2+5,-b.height/2+5,'5\n♥').setSize(18,35),corner=f.text(b.width/2-5,b.height/2-5,'5\n♥').setSize(18,35).setAngle(180);c.add([rank,corner]);cards.set(id,c);f.root.add(c);}
 if(phase==='selected')cards.get('hearts-5')!.y-=16;
 const layer=new HeroTargetAttachment(f.scene,{root:()=>f.root,target:id=>{const container=cards.get(id);return container?{container,width:Number(container.getData('width')),height:Number(container.getData('height'))}:undefined;},source:()=>({x:60,y:100}),motion:()=> 'full',blocked:()=>false}),targets=candidate?ids:['hearts-5'];layer.preview({key:'saved/'+phase,targetId:targets[0],targetIds:targets,sourceTargetIds:targets,selectedIds:phase==='selected'?['hearts-5']:[],kind:'candidate',label:candidate?'候选':'已留',releaseReason:'laohuan.refill',confirmed:true,suppressSource:candidate,ignite:true});
 try{
  const windows=[0,0,0],frames=new Set<string>();
  for(let time=0;time<3200;time+=16){
   f.step(time);const materials=nativeMaterials(f.root);expect(new Set(materials.map(g=>g.getData('targetCardId')))).toEqual(new Set(targets));
   for(const g of materials){const id=String(g.getData('targetCardId')),card=cards.get(id)!,patch=g.getData('materialPatch'),world=g.getWorldTransformMatrix(),local=card.getWorldTransformMatrix(),corners=[[patch.x,patch.y],[patch.x+patch.width,patch.y+patch.height]].map(([x,y])=>{const p=world.transformPoint(x,y);return local.applyInverse(p.x,p.y);});
    expect(corners[0].x).toBeGreaterThan(-Number(card.getData('width'))/2);expect(corners[1].x).toBeLessThan(Number(card.getData('width'))/2);expect(corners[0].y).toBeGreaterThan(-Number(card.getData('height'))/2);expect(corners[1].y).toBeLessThan(Number(card.getData('height'))/2);
    const lo=world.transformPoint(patch.x,patch.y),hi=world.transformPoint(patch.x+patch.width,patch.y+patch.height);for(const print of card.list.filter(o=>o.type==='Text')){const b=(print as Phaser.GameObjects.Text).getBounds();expect(lo.x<b.x+b.width&&hi.x>b.x&&lo.y<b.y+b.height&&hi.y>b.y).toBe(false);}
    expect(g.commandBuffer.length).toBeGreaterThan(50);if(id==='hearts-5'){windows[Math.min(2,Math.floor(time/1000))]++;if(time>3000)frames.add(JSON.stringify(g.commandBuffer));}
   }
  }
  expect(windows.every(n=>n>10),JSON.stringify(windows)).toBe(true);expect(frames.size).toBeGreaterThan(3);expect(f.emitters).toHaveLength(0);
  for(const [id,card]of cards)if(!targets.includes(id))expect(nativeMaterials(card)).toHaveLength(0);
 }finally{layer.destroy();f.root.destroy();f.step(3200);expect(f.scene.sys.updateList.getActive().length).toBe(0);}
});
