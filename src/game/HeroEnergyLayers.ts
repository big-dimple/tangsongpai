/*! ElectricBorder math adapted from React Bits (c)2026 David Haz, MIT+Commons Clause.
 * Source/complete notice: public/licenses/react-bits-electric-border.LICENSE.txt.
 * Only gradient noise, slope-corrected arc and glow equations are ported; no React/WebGL2 renderer. */
import type {AtmosphereStyle} from './HeroCardAttachmentAtmosphere';
import type {HeroSmokeProfile} from './HeroSmokeQuality';

const recipes={
 exile:{geometry:'paper-ember',speed:1.3},
 handoff:{geometry:'paper-transfer',speed:1.15},
 charge:{geometry:'paper-five-petal',speed:.65},
 burn:{geometry:'paper-flame',speed:1.4},
 wager:{geometry:'paper-lightning',speed:1.1},
 retain:{geometry:'paper-ink-leaf',speed:.9},
 'legacy-assist':{geometry:'none',speed:0}
} as const;
/** CSS-scale antialiasing follows actual framebuffer resolution, not screen DPR. */
export function heroEnergyLayers(key:AtmosphereStyle['key'],profile:HeroSmokeProfile,width:number,height:number,failed=false,prepared=false){
 const recipe=recipes[key],count=profile.name==='high'?3:profile.name==='medium'?2:1;
 return{geometry:recipe.geometry,uniform:{x:Math.max(width/profile.width,height/profile.height),y:count,z:recipe.speed,w:failed?0:prepared?.55:1}};
}

export const HERO_ENERGY_LAYERS_GLSL=`
// ElectricBorder ring: quintic gradient interpolation and analytical along-path derivative.
// Float gradients replace its WebGL2 uint hash; period64 keeps mediump inputs bounded.
vec2 electricGradient(vec2 cell,float seed){return vec2(rnd(cell+vec2(seed*.17,seed)),rnd(cell.yx+vec2(seed,seed*.31)))*2.0-1.0;}
vec2 electricRing(vec2 p,float seed){
 p=mod(p,64.0);vec2 i=floor(p),f=p-i;
 vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
 float du=30.0*f.x*f.x*(f.x*(f.x-2.0)+1.0);
 vec2 ga=electricGradient(i,seed),gb=electricGradient(mod(i+vec2(1,0),64.0),seed);
 vec2 gc=electricGradient(mod(i+vec2(0,1),64.0),seed),gd=electricGradient(mod(i+1.0,64.0),seed);
 float va=dot(ga,f),vb=dot(gb,f-vec2(1,0)),vc=dot(gc,f-vec2(0,1)),vd=dot(gd,f-1.0);
 float k=va-vb-vc+vd;
 float value=va+u.x*(vb-va)+u.y*(vc-va)+u.x*u.y*k;
 float gx=ga.x+u.x*(gb.x-ga.x)+u.y*(gc.x-ga.x)+u.x*u.y*(ga.x-gb.x-gc.x+gd.x);
 return vec2(value,gx+du*(vb-va+u.y*k));
}
vec2 electricGlowShape(float line,float spread,float w){
 float x=abs(line),y=abs(spread);
 return vec2(exp(-x*x/(w*w*.5))+exp(-y/(w*2.2))*.6,exp(-y/(w*4.5))*.5);
}
vec3 electricArc(vec2 p,vec2 a,vec2 b,float bend,float seed,float t,float w,float chaos,float chase);
// A small surface material on certified visible paper, never an exterior frame.
vec4 heroSurfaceMaterial(vec2 q,float clock){
 if(uLayers.w<.001)return vec4(0.0);
 float mode=uAppearance.x,t=clock*uLayers.z,grain=fbm(q*3.0+vec2(t*.3,-t*.7));
 float sway=.16*sin(q.y*5.0-t*2.0)+.1*(grain-.5),lane=q.x-sway;
 if(mode<.5||abs(mode-3.0)<.5)lane=q.x-sway-(grain-.5)*.2;
 if(abs(mode-2.0)<.5){float a=atan(q.y,q.x);lane=length(q)-(.18+.06*cos(a*5.0-t));}
 if(abs(mode-4.0)<.5)lane=q.x-.15*sin(q.y*19.0+t*6.0)*(.4+grain);
 if(mode>4.5)lane=length(q)-(.14+.07*sin(atan(q.y,q.x)*3.0-t*2.0));
 vec2 light=electricGlowShape(lane,lane,.035+.018*grain);
 if(abs(mode-1.0)<.5||abs(mode-4.0)<.5){vec2 p=q*uExtent;float w=max(.5,uLayers.x*.45),chaos=mode>3.5?.8:.12;
  vec3 arc=electricArc(p,vec2(-uExtent.x*.12,uExtent.y*.34),vec2(uExtent.x*.1,-uExtent.y*.34),uExtent.x*.1,11.0,t,w,chaos,fract(t*.65));light+=arc.xy*.65;
  if(mode>3.5)light+=electricArc(p,vec2(0.0,uExtent.y*.08),uExtent*vec2(.32,-.34),1.0,33.0,t,w,.7,-1.0).xy*.5;
 }
 float lead=.3+.7*pow(.5+.5*sin((q.y-t*.65)*6.28318),2.0);
 float fade=(1.0-smoothstep(.23,.5,abs(q.x)))*(1.0-smoothstep(.28,.5,abs(q.y)));
 float cloud=(mode<.5||abs(mode-3.0)<.5)?smoothstep(.25,.8,grain)*exp(-q.x*q.x/.06)*.35:0.0;
 float alpha=(1.0-exp(-(light.x*.55+light.y*.4+cloud)*lead*(1.0+uParams.z*1.2)))*fade*(uAppearance.z>1.5?.86:.68);
 vec3 color=mix(mix(uInk,uGlow,.7+.3*grain),uSpark,clamp(light.x*.65,0.0,1.0));return vec4(color*alpha,alpha)*uAppearance.y;
}
// ElectricBorder addArc: tangent/normal projection, tapered bend, multi-scale jag,
// slope-corrected distance and separate core/haze/hot channels. One bounded strand per call.
vec3 electricArc(vec2 p,vec2 a,vec2 b,float bend,float seed,float t,float w,float chaos,float chase){
 vec2 ab=b-a;float scale=max(max(abs(ab.x),abs(ab.y)),1.0),len=max(scale*length(ab/scale),1.0);vec2 dir=ab/len,rel=p-a;
 float along=dot(rel,dir),side=dot(rel,vec2(-dir.y,dir.x));
 float margin=abs(bend)+(chaos+.6)*(2.0+len*.08)+w*12.0+10.0;
 if(along< -margin||along>len+margin||abs(side)>margin)return vec3(0.0);
 float u=clamp(along/len,0.0,1.0),taper=sin(3.14159265*u);
 float settle=smoothstep(0.0,.15,u)*(1.0-smoothstep(.85,1.0,u));
 float bendSlope=3.14159265/len*cos(3.14159265*u)*settle;
 float beyond=max(-along,0.0)+max(along-len,0.0),jag=0.0,jagSlope=0.0;
 float wave=max(len*.3,14.0),weight=(.6+chaos)*(1.5+len*.05);
 for(int o=0;o<3;o++){if(float(o)<uLayers.y){
  vec2 n=electricRing(vec2(along/wave+seed*3.0,t*(1.4+float(o)*1.1)),seed+float(o));
  jag+=n.x*weight*chaos;jagSlope+=n.y*weight/wave*chaos;wave*=.42;weight*=.4;
 }}
 float offset=(bend+jag)*taper,offsetSlope=(bend+jag)*bendSlope+jagSlope*taper*settle;
 float across=(side-offset)/sqrt(1.0+offsetSlope*offsetSlope);
 float gap=length(vec2(beyond,across));vec2 g=electricGlowShape(gap,gap,w);
 float flow=1.0;if(chase>=0.0){float delta=abs(u-chase);delta=min(delta,1.0-delta);flow=.16+.84*exp(-delta*delta/.025);}
 return vec3(g.x,g.y,exp(-gap*gap/(w*w*.16)))*flow;
}
`;
