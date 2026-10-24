import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';

/** Read the product launch policy without a browser or a second set of identity constants. */
export async function currentNewRunIdentity(characterId,openingRoute){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 const result=await build({root,configFile:false,publicDir:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:path.join(root,'src/game/RunLaunch.ts'),formats:['es']},rollupOptions:{output:{inlineDynamicImports:true}}}});
 const output=Array.isArray(result)?result[0]:result,entry=output.output.find(item=>item.type==='chunk'&&item.isEntry);
 if(!entry||entry.imports.length)throw Error('smoke-launch-policy-bundle');
 const {newRunIdentity}=await import('data:text/javascript;base64,'+Buffer.from(entry.code).toString('base64'));
 return newRunIdentity(characterId,openingRoute);
}
