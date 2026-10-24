# Liu E listening-wave candidate

Base: main `0d97665a0233e6c8cff5f68badbca1b5ee21e78e`. Product and regression repair: `a28a77cb`. Recut branch: `dev/liu-e-ear-ripples-20261020`; no Su Shi product delta relative to main.

The clarified request is modest waves moving toward the small ear from above and below, without the former “交” marker. Three thin arcs on each side contract over 1440ms, inside the same certified visible-paper patch and its exclusion bounds. The existing attachment clock drives them; reduced motion keeps a static frame. Exact target/body ownership, cancel, retarget, menu, real release and destruction cleanup remain in the attachment lifecycle. No domain, save, score, audio, assets or Su Shi implementation changed.

## Regression diagnosis

PR #189's failed pull-request run [39343368978, domain job 118370029861](https://github.com/big-dimple/tangsongpai/actions/runs/39343368978/job/118370029861) reports `tests/hero-live-smoke.test.ts:84:335`: phase-count assertion `expected 5 to be greater than 5`. The same old test reproduced locally as `expected 4 to be greater than 5` (`regression-before.log`), with the Liu E phone case failing intermittently despite isolated passes.

The shader resource double measures host uniform cloning/JIT/GC as if it were real GPU submission cost. Adaptive quality then changes shader cadence/fallback during a deterministic phase assertion. The fixture now supplies a stable synthetic cost clock. The separate quality tests still exercise explicit slow frame and submission-cost downgrades, recovery, render confidence and hard budgets. The original phase-count, 3-second duration, all-target, real-event, save and resource assertions are unchanged. Five consecutive full-file runs passed all 23 tests.

The old ripple patch also used the cadence accumulator after its modulo reset, expanded radii outward, and did not include wave ink in the certified bounds. The candidate uses the attachment state clock, inward contraction and bounded point geometry above/below the ear.

## Verification

- Typecheck and production build: PASS, 401 modules; existing bundle-size warning retained.
- Focused attachment/ear/visible-paper/lifecycle/domain tests: 7 files, 93 tests PASS.
- Compiled standard smoke: Chromium 151 desktop 1280×720 and mobile 390×740/DPR3 PASS (`smoke.json`).
- Focused actual GameScene check: 1366×768 full, 390×844 full and 390×740 reduced PASS (`browser.json`). Native continuation, selection/skill choice, target switch, cancel, menu and real PlayHand; final score 328 and complete state match the canonical command. Preview/idle leaves state, journal and IndexedDB slots unchanged. Ear Graphics remain children of `card/body`; full phase advances, reduced phase stays zero, and “交” is absent.
- Production-plan check: PASS.
- Complete test suite: 406 files / 4946 tests PASS. The first domain wrapper correctly returned FAIL because the implementation commit was recorded while it ran (`domain-first-run.log`, child exit 0); this is retained as a workflow failure, not a product failure. The frozen rerun at `afc9d9c79f23a5c8131922444f7a02677acc6f93` passed all 4946 tests and content verification with identical before/after source, index and HEAD (`domain-frozen.json`).

The focused browser initially attempted an obsolete “进度与存档/导入本局” menu path (`browser-harness-before.json`); no product defect was inferred. Its explicit checkpoint setup now uses validated `IndexedDbSave.commit`, followed by ordinary reload/continue. It does not claim native import coverage.

Browser reports retain their actual starting HEAD and dirty state: implementation was under test before the product commit was recorded. `source-hashes.json` pins the delivered code. Local PNGs are in `/tmp/liue-ear-ripples/`; the phone sample was inspected as an engineering artifact. This is software evidence only: visual acceptance, physical device/GPU and hearing remain unaccepted. No merge or main push was performed.
