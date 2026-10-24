import type {R2RunState} from '../domain/run';
import {bossRulesKey} from './BossPreparationPresentation';
import {shopBossPreparation} from './ShopBossPreparation';
import {intersects,type Box} from './layout';
import {createEntryParticleField,entryParticleVisible,type EntryParticleField,type EntryParticle} from './EntryDepthParticles';

export type BossAtmosphereMode='preparation'|'battle';
export const BOSS_ATMOSPHERE_BUDGET={mobile:12,desktop:24,low:6,mobileHz:20,desktopHz:30,edge:16,opacity:.28,ghostOpacity:.18} as const;
export const BOSS_GHOST_RESOURCE={aspect:2,recommendedWidth:2048,recommendedHeight:1024,format:'transparent PNG',fit:'contain'} as const;
/** Current saved visit/stage only. A previous Boss or stage-ready loading screen owns no battle layer. */
export function bossAtmosphereKey(run:R2RunState,mode:BossAtmosphereMode):string|undefined {
 if(mode==='preparation')return shopBossPreparation(run)?.key;
 if(!['await-input','pending-refill'].includes(run.phase)||!run.stage||run.stage.index!==run.stageIndex)return;
 return bossRulesKey(run);
}
export function bossParticleCount(width:number,cores=8,memory=8):number {return cores<=4||memory<=2?BOSS_ATMOSPHERE_BUDGET.low:width<700?BOSS_ATMOSPHERE_BUDGET.mobile:BOSS_ATMOSPHERE_BUDGET.desktop;}
/** Adapt the existing projection/brush, with four narrow charcoal bands instead of a new particle engine. */
export function createBossParticleField(width:number,height:number,count:number,random:()=>number=Math.random):EntryParticleField {
 const field=createEntryParticleField(width,height,width,undefined,undefined,random);field.particles.length=Math.min(field.particles.length,count);
 for(const [i,p]of field.particles.entries()){
  const side=i%4<2;p.cx=side?(i%4===0?5:width-5):width/2;p.cy=side?height/2:i%4===2?5:height-5;
  p.span=side?5:width*1.4;p.height=side?height*.72:6;p.y=(random()-.5)*p.height*2;p.radius=random()*p.span;
  p.size=6+random()*4;p.opacity=.16+random()*.12;p.angularSpeed=.0006+random()*.0004;p.drift=side?.16:.06;p.front=false;p.bright=false;p.color=[0x354048,0x57434b,0x6d4545][i%3];
 }
 return field;
}
export function bossParticleVisible(p:EntryParticle,field:EntryParticleField,protectedBoxes:readonly Box[]):boolean {
 const r=p.size*p.projectedScale*1.3,b=BOSS_ATMOSPHERE_BUDGET.edge;
 return entryParticleVisible(p,field,protectedBoxes)&&(p.screenX+r<=b||p.screenX-r>=field.width-b||p.screenY+r<=b||p.screenY-r>=field.height-b);
}
/** Do not steal a status/control area to make room for an image. The real PNG may supply an approved free area later. */
export function bossGhostArea(width:number,height:number,protectedBoxes:readonly Box[],preferred?:Box):Box|undefined {
 const safe=(b:Box)=>b.width>=64&&b.height>=32&&b.x>=4&&b.y>=4&&b.x+b.width<=width-4&&b.y+b.height<=Math.min(height*.34,240)&&!protectedBoxes.some(p=>intersects(b,p));
 if(preferred)return safe(preferred)?preferred:undefined;
 for(const w of [216,168,112,96,80])for(const y of [8,56,68,112,168])for(const center of [.5,.4,.72,.28]){const b={x:Math.round(width*center-w/2),y,width:w,height:w/2};if(safe(b))return b;}
}
