#!/usr/bin/env bash
# Cron polls main every minute; CI and the Pages upload use an isolated checkout.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export SMOKE_BROWSERS=chromium,firefox,webkit
export VITEST_MAX_WORKERS=1
export NODE_OPTIONS="--max-old-space-size=1536"
export GIT_TERMINAL_PROMPT=0

PROJECT_DIR="/var/www/tangsongpai"
STATE_DIR="/var/lib/tangsongpai-deploy"
LOG_FILE="/var/log/tangsongpai-autodeploy.log"
LOCK_FILE="/tmp/tangsongpai-autodeploy.lock"

retry_delay() {
    case "$1" in 1) echo 600;; 2) echo 1200;; 3) echo 2400;; *) echo 3600;; esac
}
if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != --force ]; }; then
    echo 'Usage: tangsongpai-autodeploy.sh [--force]' >&2
    exit 2
fi
exec 9>"$LOCK_FILE"
flock -n 9 || exit 0
mkdir -p "$STATE_DIR"
exec >>"$LOG_FILE" 2>&1
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
TEMP_DIR=""
REMOTE_HASH=""
cleanup() {
    local result=$?
    trap - EXIT
    if [ -n "$TEMP_DIR" ]; then
        if [ -d "$TEMP_DIR/source/shots" ]; then
            rm -rf -- "$STATE_DIR/reports/latest"
            mkdir -p "$STATE_DIR/reports/latest"
            printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/reports/latest/revision"
            for item in ci gamepad smoke-result.json smoke-failure.png smoke-failure-dom.html; do
                if [ -e "$TEMP_DIR/source/shots/$item" ]; then
                    cp -a "$TEMP_DIR/source/shots/$item" "$STATE_DIR/reports/latest/" || log "Could not retain $item."
                fi
            done
        fi
        git -C "$PROJECT_DIR" worktree remove --force "$TEMP_DIR/source" 2>/dev/null || true
        rm -rf -- "$TEMP_DIR"
    fi
    if [ "$result" -ne 0 ]; then
        if [ -n "$REMOTE_HASH" ]; then
            failed_hash="" failed_at="" failed_count=""
            if [ -f "$STATE_DIR/failed-revision" ]; then
                read -r failed_hash failed_at failed_count <"$STATE_DIR/failed-revision" || true
            fi
            if [ "$failed_hash" = "$REMOTE_HASH" ] && [[ "$failed_at" =~ ^[0-9]+$ ]]; then
                if ! [[ "$failed_count" =~ ^[1-4]$ ]]; then failed_count=1; fi
                if [ "$failed_count" -lt 4 ]; then failed_count=$((failed_count + 1)); fi
            else
                failed_count=1
            fi
            printf '%s %s %s\n' "$REMOTE_HASH" "$(date +%s)" "$failed_count" >"$STATE_DIR/failed-revision.tmp"
            mv "$STATE_DIR/failed-revision.tmp" "$STATE_DIR/failed-revision"
            log "ERROR: Deployment failed; successful revision unchanged. Retry after $(( $(retry_delay "$failed_count") / 60 )) minutes or use --force."
        else
            log 'ERROR: Deployment failed before reading main; the next poll will retry.'
        fi
    fi
    exit "$result"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
timeout --kill-after=30s 2m git fetch origin main --quiet
REMOTE_HASH=$(git rev-parse origin/main)
DEPLOYED_HASH=$(cat "$STATE_DIR/deployed-revision" 2>/dev/null || true)
if [ "$REMOTE_HASH" = "$DEPLOYED_HASH" ] && [ "${1:-}" != --force ]; then
    rm -f "$STATE_DIR/observed-revision"
    exit 0
fi
verify_public() {
    curl -fsS --max-time 10 -H 'Cache-Control: no-cache' \
        "https://pai.hp666.cc/build-info.json?revision=$REMOTE_HASH" >"$STATE_DIR/served-build-info.json" 2>/dev/null || return 1
    python3 - "$STATE_DIR/served-build-info.json" "$REMOTE_HASH" <<'PY'
import json, sys
from pathlib import Path
info = json.loads(Path(sys.argv[1]).read_text())
if info.get('revision') != sys.argv[2] or info.get('sourceStatus') != 'clean' or info.get('modified') is not False:
    raise SystemExit('Public domain has not served the expected clean revision')
print('Verified public domain revision:', info['revision'])
PY
}
record_success() {
    printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/deployed-revision.tmp"
    mv "$STATE_DIR/deployed-revision.tmp" "$STATE_DIR/deployed-revision"
    rm -f "$STATE_DIR/pending-revision" "$STATE_DIR/failed-revision" "$STATE_DIR/observed-revision"
    log "Successfully deployed $REMOTE_HASH to Cloudflare Pages."
}
# Only an upload that passed this machine's CI may be finalized on a later poll.
if [ "${1:-}" != --force ] && [ "$(cat "$STATE_DIR/pending-revision" 2>/dev/null || true)" = "$REMOTE_HASH" ] && verify_public >/dev/null 2>&1; then
    record_success
    exit 0
fi
if [ "${1:-}" != --force ] && [ -f "$STATE_DIR/failed-revision" ]; then
    failed_hash="" failed_at="" failed_count=""
    read -r failed_hash failed_at failed_count <"$STATE_DIR/failed-revision" || true
    if ! [[ "$failed_count" =~ ^[1-4]$ ]]; then failed_count=1; fi
    if [ "$failed_hash" = "$REMOTE_HASH" ] && [[ "$failed_at" =~ ^[0-9]+$ ]] && [ $(( $(date +%s) - failed_at )) -lt "$(retry_delay "$failed_count")" ]; then
        exit 0
    fi
fi

# Coalesce bursts of pushes: wait for five quiet minutes, but never wait more
# than ten minutes from the first observation of an undeployed version.
if [ "${1:-}" != --force ]; then
    now=$(date +%s)
    observed_hash="" first_seen="" last_change=""
    if [ -f "$STATE_DIR/observed-revision" ]; then
        read -r observed_hash first_seen last_change <"$STATE_DIR/observed-revision" || true
    fi
    if ! [[ "$first_seen" =~ ^[0-9]+$ && "$last_change" =~ ^[0-9]+$ ]] || [ "$first_seen" -gt "$now" ] || [ "$last_change" -gt "$now" ]; then
        observed_hash="" first_seen=$now last_change=$now
    fi
    if [ "$observed_hash" != "$REMOTE_HASH" ]; then
        observed_hash=$REMOTE_HASH
        last_change=$now
        printf '%s %s %s\n' "$observed_hash" "$first_seen" "$last_change" >"$STATE_DIR/observed-revision.tmp"
        mv "$STATE_DIR/observed-revision.tmp" "$STATE_DIR/observed-revision"
        log "Observed $REMOTE_HASH; waiting up to 5 quiet minutes (10 minutes maximum)."
    fi
    if [ $((now - last_change)) -lt 300 ] && [ $((now - first_seen)) -lt 600 ]; then
        exit 0
    fi
fi

log "Checking $REMOTE_HASH locally (last deployed: ${DEPLOYED_HASH:-unknown})."
# Let interactive work take priority while the server builds and tests.
renice 10 -p "$$" >/dev/null 2>&1 || true
ionice -c 2 -n 7 -p "$$" >/dev/null 2>&1 || true
TEMP_DIR=$(mktemp -d /tmp/tangsongpai-deploy.XXXXXX)
timeout --kill-after=30s 3m git worktree add --detach "$TEMP_DIR/source" "$REMOTE_HASH"
cd "$TEMP_DIR/source"
timeout --kill-after=30s 10m npm ci --prefer-offline --no-audit --no-fund
timeout --kill-after=30s 20m npx playwright install chromium firefox webkit
# Keep a verified domain result for this exact revision and runtime. A browser
# failure must not make the machine repeat thousands of already-passed tests.
CACHE_KEY=$( { node --version; npm --version; uname -srm; sha256sum "$0"; } | sha256sum | cut -d' ' -f1 )
domain_cached=0
if [ "${1:-}" != --force ] && [ -f "$STATE_DIR/domain-ci.json" ] && python3 - "$STATE_DIR/domain-ci.json" "$REMOTE_HASH" "$CACHE_KEY" <<'PY'
import json, sys, time
from pathlib import Path
try:
    cache = json.loads(Path(sys.argv[1]).read_text())
    report = cache['report']
    steps = report['steps']
    valid = (cache['revision'] == sys.argv[2] and cache['runtime'] == sys.argv[3]
        and 0 <= time.time() - cache['completedAt'] <= 86400
        and report['scope'] == 'domain' and report['testedCommit'] == sys.argv[2]
        and report['status'] == 'PASS' and report['exitCode'] == 0
        and report['before'] == report['after']
        and [step['name'] for step in steps] == ['test', 'verify:content']
        and all(step['status'] == 'PASS' and step['childExitCode'] == 0 for step in steps))
except (OSError, ValueError, KeyError, TypeError):
    valid = False
raise SystemExit(0 if valid else 1)
PY
then
    domain_cached=1
    log "Reusing passed domain checks for $REMOTE_HASH."
    mkdir -p shots/ci
    python3 - "$STATE_DIR/domain-ci.json" <<'PY'
import json, sys
from pathlib import Path
cache = json.loads(Path(sys.argv[1]).read_text())
Path('shots/ci/domain.json').write_text(json.dumps(cache['report'], indent=2) + '\n')
PY
fi
if [ "$domain_cached" = 0 ]; then
    timeout --kill-after=30s 30m npm run verify:ci -- --scope=domain
    python3 - "$STATE_DIR/domain-ci.json" "$REMOTE_HASH" "$CACHE_KEY" <<'PY'
import json, os, sys, time
from pathlib import Path
report = json.loads(Path('shots/ci/domain.json').read_text())
steps = report['steps']
if not (report['scope'] == 'domain' and report['testedCommit'] == sys.argv[2]
        and report['status'] == 'PASS' and report['exitCode'] == 0
        and report['before'] == report['after']
        and [step['name'] for step in steps] == ['test', 'verify:content']
        and all(step['status'] == 'PASS' and step['childExitCode'] == 0 for step in steps)):
    raise SystemExit('Domain CI report does not prove a clean successful run')
path = Path(sys.argv[1])
temp = path.with_suffix('.tmp')
temp.write_text(json.dumps({'revision': sys.argv[2], 'runtime': sys.argv[3], 'completedAt': time.time(), 'report': report}) + '\n')
os.replace(temp, path)
PY
fi
timeout --kill-after=30s 30m npm run verify:ci -- --scope=browser

# Preserve the prior CI's change-sensitive controller check.
run_controller=0
if [ -z "$DEPLOYED_HASH" ] || ! git cat-file -e "$DEPLOYED_HASH^{commit}" 2>/dev/null; then
    run_controller=1
else
    changed_files=$(git diff --name-only "$DEPLOYED_HASH" "$REMOTE_HASH")
    if grep -Eq '^(src/(game/(GamepadNavigation|ControllerFocus|ControllerScene|SceneView|WholeActionSurface|GameScene|ShopScene|CharacterSelectScene|RunMenu|IntermissionScroll|DetailDialog|BuildJourneyDialog|ConsumableDialog)|platform/GamepadInput)|src/main\.ts|harness/(gamepad|ui|stage-entry)\.mjs|tests/(gamepad|controller|whole-action)|\.github/workflows/ci\.yml)' <<<"$changed_files"; then
        run_controller=1
    fi
fi
if [ "$run_controller" = 1 ]; then
    timeout --kill-after=30s 15m npm run test:gamepad:browser
fi
python3 - dist/build-info.json "$REMOTE_HASH" <<'PY'
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
info = json.loads(path.read_text())
if info.get('revision') != sys.argv[2] or info.get('sourceStatus') != 'clean' or info.get('modified') is not False:
    raise SystemExit('Build metadata does not match expected clean revision: ' + str(info))
if not (path.parent / 'index.html').is_file():
    raise SystemExit('dist has no index.html')
print('Verified clean build revision:', info['revision'])
PY
if [ -n "$(git status --porcelain)" ]; then
    log 'CI changed the checkout; refusing to publish.'
    exit 1
fi
# Finish this checked version even if more commits arrive during CI. A rewritten
# main must still contain it; otherwise it is no longer a valid release target.
timeout --kill-after=30s 2m git -C "$PROJECT_DIR" fetch origin main --quiet
if ! git -C "$PROJECT_DIR" merge-base --is-ancestor "$REMOTE_HASH" origin/main; then
    log 'main no longer contains the checked revision; skip upload and observe the new history.'
    rm -f "$STATE_DIR/observed-revision"
    exit 0
fi
timeout --kill-after=30s 15m /usr/local/bin/deploy-to-cloudflare-pages.py "$TEMP_DIR/source/dist" dachoupai
# A cache-registration failure must not hide a successful upload.
timeout --kill-after=30s 3m /usr/local/bin/tangsongpai-cache-cloudflare.py "$TEMP_DIR/source/dist" || log 'Asset cache registration failed; a later deployment may re-upload files.'
printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/pending-revision.tmp"
mv "$STATE_DIR/pending-revision.tmp" "$STATE_DIR/pending-revision"
for attempt in 1 2 3 4 5 6; do
    if verify_public; then record_success; exit 0; fi
    [ "$attempt" -eq 6 ] || sleep 5
done
log 'Public domain propagation pending; subsequent polls will check it.'
exit 1
