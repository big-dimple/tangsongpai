import {defineConfig} from 'vitest/config';

// Deployment shell fixtures run separately from the game suites: local iteration
// stays fast while verify:ci and release candidates retain every deployment case.
export default defineConfig({
  test:{include:['tests/autodeploy-ci-gate.test.mjs'],maxWorkers:1},
});
