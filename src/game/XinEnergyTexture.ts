import type Phaser from 'phaser';

export const XIN_ENERGY_TEXTURE={width:64,height:32,core:'hero-xin-core64x32-v2',wake:'hero-xin-wake64x32-v2'} as const;
/** Two reusable, precolored native bitmaps keep the same ink/core contrast in Canvas and WebGL. */
export function xinEnergyTexture(scene:Phaser.Scene,core:boolean):string|undefined {
 const key=core?XIN_ENERGY_TEXTURE.core:XIN_ENERGY_TEXTURE.wake;if(scene.textures.exists(key))return key;
 const bitmap=scene.textures.createCanvas(key,XIN_ENERGY_TEXTURE.width,XIN_ENERGY_TEXTURE.height);if(!bitmap)return;
 const c=bitmap.getContext();c.save();
 const path=()=>{c.beginPath();c.moveTo(3,22);c.bezierCurveTo(19,11,39,5,59,14);c.bezierCurveTo(48,25,27,20,3,22);c.closePath();};
 // A dark, tapered body gives the bright center a readable silhouette on the paper table.
 c.shadowColor=core?'rgba(83,222,177,.8)':'rgba(43,150,108,.65)';c.shadowBlur=core?5:4;
 const body=c.createLinearGradient(3,16,60,16);body.addColorStop(0,'rgba(20,74,57,0)');body.addColorStop(.3,'rgba(15,66,49,.8)');body.addColorStop(.7,core?'#45bd91':'#225b4c');body.addColorStop(1,core?'#e7ffd2':'#60bc8d');c.fillStyle=body;path();c.fill();c.shadowBlur=0;
 const light=c.createLinearGradient(7,16,59,16);light.addColorStop(0,'rgba(138,237,181,0)');light.addColorStop(.5,core?'#9ae9ab':'#3d9871');light.addColorStop(1,core?'#f6ffe8':'#b1e3a6');c.strokeStyle=light;c.lineWidth=core?3.5:2;c.lineCap='round';c.beginPath();c.moveTo(10,20);c.bezierCurveTo(29,14,44,10,56,14);c.stroke();
 c.restore();bitmap.refresh();return key;
}
