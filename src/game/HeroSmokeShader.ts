/*! Spooky Smoke rnd/noise/fBm adapted from MIT (c) 2026 Pulkit; public/licenses/spooky-smoke.MIT.txt. */
import {HERO_ENERGY_LAYERS_GLSL} from './HeroEnergyLayers';
// Fixed source f3d7e12f34bf7d90130dce3ec3b26cf69c29794e, original React/renderer/opaque compositing excluded.
export const HERO_SMOKE_KEY='hero-live-smoke-v4';
// Phaser's native BaseShader vertex convention. The sole framebuffer is independent of screen DPR.
export const HERO_SMOKE_VERTEX=`
precision mediump float;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform vec2 uResolution;
attribute vec2 inPosition;
varying mediump vec2 outTexCoord;
void main(){gl_Position=uProjectionMatrix*uViewMatrix*vec4(inPosition,1.0,1.0);outTexCoord=vec2(inPosition.x/uResolution.x,1.0-inPosition.y/uResolution.y);}
`;
export const HERO_SMOKE_FRAGMENT=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying mediump vec2 outTexCoord;
uniform vec2 uExtent;
uniform vec3 uInk;
uniform vec3 uGlow;
uniform vec3 uSpark;
uniform vec4 uParams; // clock, clockwise phase, arrival envelope, tier
uniform vec4 uAppearance; // hero mode, fade/failed attenuation, prepared surface, reserved
uniform vec4 uLayers; // CSS pixel footprint, bounded detail, recipe speed, successful/pending layer enabled
uniform float uOctaves;
float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);return mix(mix(rnd(i),rnd(i+vec2(1,0)),u.x),mix(rnd(i+vec2(0,1)),rnd(i+1.0),u.x),u.y);}
float fbm(vec2 p){float value=0.0,amp=1.0,total=0.0;for(int i=0;i<3;i++){if(float(i)<uOctaves){value+=amp*noise(p);total+=amp;p=mat2(1.0,-1.2,.2,1.2)*p*2.0;amp*=.5;}}return value/max(total,.001);}
${HERO_ENERGY_LAYERS_GLSL}
void main(){gl_FragColor=heroSurfaceMaterial(vec2(outTexCoord.x-.5,.5-outTexCoord.y),uParams.x);}
`;
