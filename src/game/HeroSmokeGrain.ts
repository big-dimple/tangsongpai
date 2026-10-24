/*! Adapted from Spooky Smoke, MIT (c) 2026 Pulkit. See public/licenses/spooky-smoke.MIT.txt. */
// Source f3d7e12f34bf7d90130dce3ec3b26cf69c29794e:
// shaders/spooky-smoke-shader/src/components/ui/spooky-smoke-animation.tsx
// Only rnd/noise/fBm is translated. Two octaves, one cached32x64 bake; no React/WebGL/RAF wrapper.
const fract=(value:number)=>value-Math.floor(value),mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function randomCell(x:number,y:number):number {const a=fract(x*12.9898),b=fract(y*78.233),offset=a*(a+34.56)+b*(b+34.56);return fract((a+offset)*(b+offset));}
function valueNoise(x:number,y:number):number {const ix=Math.floor(x),iy=Math.floor(y),a=fract(x),b=fract(y),u=a*a*(3-2*a),v=b*b*(3-2*b);return mix(mix(randomCell(ix,iy),randomCell(ix+1,iy),u),mix(randomCell(ix,iy+1),randomCell(ix+1,iy+1),u),v);}
function twoOctaves(x:number,y:number):number {return(valueNoise(x,y)+.5*valueNoise(2*x+.4*y,-2.4*x+2.4*y))/1.5;}
/** Colored density alpha replaces the upstream opaque grey background; only the current cached wake uses it. */
export function heroSmokePixels(width:number,height:number,color:number):Uint8ClampedArray {
 const pixels=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,nx=(x-width*.54)/(width*.54),ny=(y-height*.52)/(height*.47),envelope=Math.max(0,1-nx*nx-ny*ny),density=twoOctaves(x*.13+1.7,y*.16+4.2);pixels[i]=color>>16&255;pixels[i+1]=color>>8&255;pixels[i+2]=color&255;pixels[i+3]=x<2||y<2||x>=width-2||y>=height-2?0:Math.round(110*envelope*density*density);}
 return pixels;
}
