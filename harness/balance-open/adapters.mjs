import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
export const CONDITIONS=['O','A','B'];
// These exact-source, fail-closed replacements exist only in an opt-in Node bundle.
// Vite, application imports and default new games cannot load this adapter.
export const replacements={
  A:{'src/domain/r2Chapter.ts':[[
    'const targetHeat=((numerator+denominator-1n)/denominator).toString();',
    'const targetHeat=chapter===1&&difficulty===0?String(400*[1,2,3][index%3]):((numerator+denominator-1n)/denominator).toString();'
  ]]},
  B:{
    'src/domain/scoreR2.ts':[[
      "if(transferred)emit('onCardScore',{sourceType:'character',sourceDefinitionId:'erxiang',sourceInstanceId:`${input.runId}/character`},'add-multiplier',points,()=>{M=M.add(points);},{kind:'always'},card,0,undefined,{reasonKey:'erxiang.handoff'});",
      "if(transferred){const halfPoints=points.multiply(new Rational(1n,2n));emit('onCardScore',{sourceType:'character',sourceDefinitionId:'erxiang',sourceInstanceId:`${input.runId}/character`},'add-multiplier',halfPoints,()=>{M=M.add(halfPoints);},{kind:'always'},card,0,undefined,{reasonKey:'erxiang.handoff'});}"
    ]],
    'src/application/checkpoint.ts':[[
      'const value=new Rational(BigInt(saved.points));',
      'const value=new Rational(BigInt(saved.points),2n);'
    ]]
  }
};
export async function compile(condition,outfile){
  assert.ok(CONDITIONS.includes(condition));const applied=[];
  await build({entryPoints:['harness/balance-open/worker.ts'],outfile,bundle:true,platform:'node',format:'esm',target:'node22',logLevel:'silent',plugins:[{
    name:'isolated-balance-'+condition,setup(b){b.onLoad({filter:/\.(ts|json)$/},async args=>{
      const relative=path.relative(process.cwd(),args.path).split(path.sep).join('/');
      const edits=replacements[condition]?.[relative];if(!edits)return;
      let contents=await readFile(args.path,'utf8');
      for(const [from,to] of edits){assert.equal(contents.split(from).length-1,1,'source drift: '+relative);contents=contents.replace(from,to);}
      applied.push(relative);return {contents,loader:'ts'};
    });}
  }]});
  assert.deepEqual(applied.sort(),Object.keys(replacements[condition]??{}).sort());return applied;
}
