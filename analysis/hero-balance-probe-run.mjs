import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom',logLevel:'error'});
try{const {heroBalanceProbe}=await server.ssrLoadModule('/analysis/hero-balance-probe.ts');process.stdout.write(JSON.stringify(heroBalanceProbe(),null,2)+'\n');}finally{await server.close();}
