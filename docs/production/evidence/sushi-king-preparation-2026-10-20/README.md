# Su Shi K preparation candidate

Base: main `0d97665a0233e6c8cff5f68badbca1b5ee21e78e`. Product: `d72accd0198199bbfd171f3051ccb8b0ad6300b0`. Independent branch `dev/sushi-king-preparation-20261020`; no Liu E #191 increment.

Only actual pending-discard kings receive the preparation mark and the small “本手 ×3” source badge. The legal skill choice still comes from `amoExileChoice`; main-hand kings are excluded. All pending kings are represented without adding a unique king-selection field or rule. Draft text reads the current identity's factor (including existing ×4 identities); saved text reads the actual `amo.exile` event value. This describes the hand's benefit, not a persistent per-card stat.

Preparation uses a small vector mark in the existing certified visible-paper patch plus a text badge, without a smoke shader, particle emitter or new clock. Badges avoid text, controls and each other, stay close to their real K, and follow the same card-body proxy. Whole-card bitmap bounds include blank paper; badges may use that blank area above overlapping cards, while the interior preparation mark retains `heroVisiblePatch` protection. Rank/suit Text and non-card controls remain protected. The GameScene adapter now passes the actual rank, which the existing K-specific presentation previously did not receive.

Saved activation still owns **all** actual discarded IDs. Existing smoke/cut/hit presentation after commitment is retained; no smoke was added. `preservation.json` confirms exact function text for fade timing, local slash, visual state, smoke/silhouette/flame/hit drawing, cut, arrival and source-body synchronization. Domain/application/audio, `SushiDiscardExit.ts` and Liu E's `HandoffEar.ts` are byte-unchanged from main. No score, save or multiple-K selection change.

## Checks and limits

- Final source: TypeScript/Vite build PASS, 401 modules; existing chunk-size warning remains (`build.txt`).
- Final related regression: 13 files /114 tests PASS (`tests.txt`). Includes actual saved factor, multiple pending kings, rejection of non-K preparation, retarget/cancel, hidden/resume, body destruction, real cut/abort and prior score/persistence contracts.
- Final Chromium151 native checks PASS: 1366×768 full, 390×844 full, 390×740 reduced (`phone.json`, `desktop-reduced.json`). Native continuation/card/skill/menu/play input; validated controlled checkpoint setup through `IndexedDbSave.commit`. One deliberately controlled real card-body destruction is explicit. Full preview state/journal/IndexedDB comparison stays unchanged; actual final command/state/checkpoint equals the domain oracle. Final integer score 306, factor3.
- Same code hashes remained unchanged through the final checks (`source-hashes.sha256`). Browser reports retain the actual pre-commit main HEAD plus dirty state; the product commit records those tested bytes.
- Standard compiled Chromium desktop/mobile smoke also passed before the final badge-placement refinement. Final placement is covered by the final native checks above; this does not relabel the earlier smoke as a rerun of the final bytes.

Initial failures are retained: `initial-harness-failure.json` expected a draft to survive changed selection, contrary to existing explicit re-arming behavior; only the harness expectation was corrected. `phone-label-before.json` records a real hidden-label failure when a raised main K's full-card bitmap occupied the conservative label bounds. The final policy protects actual text/controls and keeps the label close to its source. `interrupted-hmr.json` records an in-development file edit reloading the browser to title; the final harness disables HMR and final source stays frozen. An initial test fixture type inference error (`rank` inferred as only8|13) was widened to number before the final typecheck.

`desktop-multi.png`, `phone-multi.png`, and `phone-single.png` are actual final-source captures inspected as engineering artifacts. They are not user aesthetic acceptance. No physical device/GPU, hearing, natural acquisition or broad balance acceptance is claimed. No main merge/push, deployment or CI waiting was performed.
