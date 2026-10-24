export interface HeroSmokeProfile {name:string;width:number;height:number;hz:number;octaves:number;padding:number}
export const HERO_SMOKE_TIERS=[
 {name:'low',width:64,height:96,hz:20,octaves:2,padding:30},
 {name:'medium',width:96,height:128,hz:30,octaves:2,padding:40},
 {name:'high',width:160,height:192,hz:60,octaves:3,padding:52}
] as const;
/** Scene-frame feedback and measured GL submission cost, not a UA/device-name classification or GPU-time claim. */
export class HeroSmokeQuality {
 private level=0;private good=0;private bad=0;private cooldown=0;private average=16.7;private stress=0;private rest=0;private renders=0;
 constructor(private readonly highCapable:boolean){}
 get tier(){return HERO_SMOKE_TIERS[this.level];}
 get index(){return this.level;}
 get fallback(){return this.rest>0;}
 noteRender():void {this.renders++;}
 sample(frameMs:number,submissionMs:number,rendering=true):boolean {
  if(!Number.isFinite(frameMs)||frameMs<=0||frameMs>150){this.good=0;return false;}
  if(!rendering){this.good=0;this.cooldown=Math.max(0,this.cooldown-frameMs);this.rest=Math.max(0,this.rest-frameMs);return false;}
  this.average=this.average*.9+frameMs*.1;this.cooldown=Math.max(0,this.cooldown-frameMs);this.rest=Math.max(0,this.rest-frameMs);const prior=this.level;
  const slow=frameMs>28||submissionMs>3||this.average>23;this.bad=slow?this.bad+1:Math.max(0,this.bad-1);
  this.stress=slow?this.stress+frameMs:Math.max(0,this.stress-frameMs*2);if(this.level===0&&this.stress>1200){this.rest=5000;this.stress=0;}
  if(this.bad>=3){this.level=Math.max(0,this.level-1);this.bad=0;this.good=0;this.cooldown=4000;}
  else if(!slow&&this.average<19&&submissionMs<1.8&&!this.cooldown&&!this.rest){this.good+=frameMs;if(this.good>=(this.level===0?900:1800)){this.level=Math.min(this.highCapable&&this.renders>=10?2:1,this.level+1);this.good=0;}}
  else this.good=0;
  return prior!==this.level;
 }
}
