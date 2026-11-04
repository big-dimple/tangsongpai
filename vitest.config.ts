import {configDefaults,defineConfig,mergeConfig} from 'vitest/config';
import viteConfig from './vite.config';

// CLI asset fixtures use node:test through test:assets; game suites use Vitest.
export default mergeConfig(viteConfig,defineConfig({
  test:{
    include:configDefaults.include.map(pattern=>`tests/${pattern}`),
    // Shell deployment fixtures have a dedicated serial gate in test:deployment.
    exclude:[...configDefaults.exclude,'tests/autodeploy-ci-gate.test.mjs'],
    // Windows process startup is expensive; avoid oversubscribing CPU and hitting unchanged 5s test budgets.
    ...(process.platform==='win32'?{maxWorkers:4}:{}),
  },
}));
