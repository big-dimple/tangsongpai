import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const source=process.argv[2];
if(!source)throw Error('Usage: node tools/build-pc-hero-art.mjs <user PNG directory>');
const out='public/assets/tangsong-pc-heroes';
await fs.mkdir(out,{recursive:true});
const heroes=[['amo','苏轼','su1.png'],['touye','秦琼','qin2.png'],['laohuan','辛弃疾','xin3.png'],['erxiang','刘娥','liu4.png'],['azao','文成公主','wen5.png'],['xiemu','花蕊夫人','hua6.png']];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const assets=[];
for(const [id,person,file] of heroes){
 const input=await fs.readFile(path.join(source,file)),metadata=await sharp(input).metadata();
 if(!metadata.hasAlpha)throw Error(`${file}: alpha channel required`);
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let transparent=0,partial=0,left=info.width,top=info.height,right=-1,bottom=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*info.channels+3];if(a===0)transparent++;else {if(a<255)partial++;if(a>=16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}}}
 const output=await sharp(input).resize({height:1120,withoutEnlargement:true}).webp({quality:84,alphaQuality:100,effort:6}).toBuffer();
 const result=await sharp(output).metadata(),filename=`${id}.pc.webp`;
 await fs.writeFile(path.join(out,filename),output);
 assets.push({id,person,purpose:'pc',key:`pc-hero-${id}`,path:`assets/tangsong-pc-heroes/${filename}`,width:result.width,height:result.height,bytes:output.length,sha256:hash(output),format:'webp',sourceFile:file,sourceSHA256:hash(input),sourceBytes:input.length,sourceWidth:metadata.width,sourceHeight:metadata.height,transparentPixels:transparent,partialAlphaPixels:partial,sourceAlpha16Bounds:{x:left,y:top,width:right-left+1,height:bottom-top+1},quality:84,alphaQuality:100});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({schemaVersion:1,sourceDirectory:'User supplied Desktop/lihui/table, 2026-10-25; originals retained outside runtime publication',scope:'Full-frame transparent hero art for PC tables and desktop/phone results. No crop, no generative edits, no replacement of portrait/selection. Source hashes preserve provenance.',assets},null,2)+'\n');
console.log(assets.map(a=>({id:a.id,file:a.sourceFile,bytes:a.bytes,width:a.width,height:a.height,transparentPct:(100*a.transparentPixels/(a.sourceWidth*a.sourceHeight)).toFixed(2),bounds:a.sourceAlpha16Bounds})));
