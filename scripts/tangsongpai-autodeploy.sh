#!/usr/bin/env bash
# Cron polls main every minute; CI and the Pages upload use an isolated checkout.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export SMOKE_BROWSERS=chromium,firefox,webkit
export VITEST_MAX_WORKERS=1
export NODE_OPTIONS="--max-old-space-size=1536"

PROJECT_DIR="/var/www/tangsongpai"
STATE_DIR="/var/lib/tangsongpai-deploy"
LOG_FILE="/var/log/tangsongpai-autodeploy.log"
LOCK_FILE="/tmp/tangsongpai-autodeploy.lock"

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
            printf '%s %s\n' "$REMOTE_HASH" "$(date +%s)" >"$STATE_DIR/failed-revision"
        fi
        log 'ERROR: Deployment failed; successful revision unchanged. Retry after 10 minutes or use --force.'
    fi
    exit "$result"
}
trap cleanup EXIT

cd "$PROJECT_DIR"
git fetch origin main --quiet
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
    read -r failed_hash failed_at <"$STATE_DIR/failed-revision" || true
    if [ "${failed_hash:-}" = "$REMOTE_HASH" ] && [[ "${failed_at:-}" =~ ^[0-9]+$ ]] && [ $(( $(date +%s) - failed_at )) -lt 600 ]; then
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
TEMP_DIR=$(mktemp -d /tmp/tangsongpai-deploy.XXXXXX)
git worktree add --detach "$TEMP_DIR/source" "$REMOTE_HASH"
cd "$TEMP_DIR/source"
npm ci --prefer-offline --no-audit --no-fund
npx playwright install chromium firefox webkit
npm run verify:ci -- --scope=all

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
    npm run test:gamepad:browser
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
git -C "$PROJECT_DIR" fetch origin main --quiet
if ! git -C "$PROJECT_DIR" merge-base --is-ancestor "$REMOTE_HASH" origin/main; then
    log 'main no longer contains the checked revision; skip upload and observe the new history.'
    rm -f "$STATE_DIR/observed-revision"
    exit 0
fi
/usr/local/bin/deploy-to-cloudflare-pages.py "$TEMP_DIR/source/dist" dachoupai
# A cache-registration failure must not hide a successful upload.
/usr/local/bin/tangsongpai-cache-cloudflare.py "$TEMP_DIR/source/dist" || log 'Asset cache registration failed; a later deployment may re-upload files.'
printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/pending-revision.tmp"
mv "$STATE_DIR/pending-revision.tmp" "$STATE_DIR/pending-revision"
for attempt in 1 2 3 4 5 6; do
    if verify_public; then record_success; exit 0; fi
    [ "$attempt" -eq 6 ] || sleep 5
done
log 'Public domain propagation pending; subsequent polls will check it.'
exit 1
