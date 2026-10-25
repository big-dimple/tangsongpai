#!/usr/bin/env bash
# Installed at /usr/local/bin/tangsongpai-autodeploy.sh and polled every minute.
# GitHub builds main; this low-memory host only downloads and uploads its artifact.
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

PROJECT_DIR="/var/www/tangsongpai"
REPOSITORY="big-dimple/tangsongpai"
STATE_DIR="/var/lib/tangsongpai-deploy"
LOG_FILE="/var/log/tangsongpai-autodeploy.log"
LOCK_FILE="/tmp/tangsongpai-autodeploy.lock"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0
[ -d "$PROJECT_DIR/.git" ] || exit 0
cd "$PROJECT_DIR"
[ "$(git branch --show-current)" = main ] || exit 0

mkdir -p "$STATE_DIR"
exec >>"$LOG_FILE" 2>&1
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
TEMP_DIR=""
cleanup() {
    local result=$?
    [ -z "$TEMP_DIR" ] || rm -rf -- "$TEMP_DIR"
    if [ "$result" -ne 0 ]; then
        log "ERROR: Deployment failed; successful revision unchanged. Next minute will retry."
    fi
}
trap cleanup EXIT

git fetch origin main --quiet
REMOTE_HASH=$(git rev-parse origin/main)
DEPLOYED_HASH=$(cat "$STATE_DIR/deployed-revision" 2>/dev/null || true)
if [ "$REMOTE_HASH" = "$DEPLOYED_HASH" ] && [ "${1:-}" != --force ]; then
    exit 0
fi

# Use the latest push CI result, so an older green attempt cannot hide a new failure.
CI_RUN_ID=$(gh run list --repo "$REPOSITORY" --workflow ci.yml --event push \
    --branch main --commit "$REMOTE_HASH" --limit 1 \
    --json databaseId,status,conclusion \
    --jq '.[0] | select(.status == "completed" and .conclusion == "success") | .databaseId')
RUN_ID=$(gh run list --repo "$REPOSITORY" --workflow production-build.yml \
    --branch main --commit "$REMOTE_HASH" --status success --limit 1 \
    --json databaseId --jq '.[0].databaseId // empty')
if [ -z "$CI_RUN_ID" ] || [ -z "$RUN_ID" ]; then
    WAITING_HASH=$(cat "$STATE_DIR/waiting-revision" 2>/dev/null || true)
    if [ "$WAITING_HASH" != "$REMOTE_HASH" ]; then
        log "Waiting for GitHub CI and Production build of $REMOTE_HASH; no local build."
        printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/waiting-revision"
    fi
    exit 0
fi

TEMP_DIR=$(mktemp -d /tmp/tangsongpai-deploy.XXXXXX)
ARTIFACT_DIR="$TEMP_DIR/dist"
verify_public() {
    curl -fsS --max-time 10 -H 'Cache-Control: no-cache' \
        "https://pai.hp666.cc/build-info.json?revision=$REMOTE_HASH" >"$TEMP_DIR/served-build-info.json" || return 1
    python3 - "$TEMP_DIR/served-build-info.json" "$REMOTE_HASH" <<'PY'
import json
import sys
from pathlib import Path

info = json.loads(Path(sys.argv[1]).read_text())
if info.get("revision") != sys.argv[2] or info.get("sourceStatus") != "clean" or info.get("modified") is not False:
    raise SystemExit("Public domain has not served the expected clean revision")
print("Verified public domain revision:", info["revision"])
PY
}
record_success() {
    printf '%s\n' "$REMOTE_HASH" >"$STATE_DIR/deployed-revision.tmp"
    mv "$STATE_DIR/deployed-revision.tmp" "$STATE_DIR/deployed-revision"
    rm -f "$STATE_DIR/waiting-revision"
    log "Successfully deployed $REMOTE_HASH from GitHub run $RUN_ID to Cloudflare Pages."
}

# A prior upload may have finished before the public domain propagated.
if [ "${1:-}" != --force ] && verify_public >/dev/null 2>&1; then
    record_success
    exit 0
fi

log "Downloading GitHub build $RUN_ID for $REMOTE_HASH (CI=$CI_RUN_ID; last deployed=${DEPLOYED_HASH:-unknown})."
gh run download "$RUN_ID" --repo "$REPOSITORY" \
    --name "tangsongpai-dist-$REMOTE_HASH" --dir "$ARTIFACT_DIR"

# Never publish an artifact from a different revision or a modified source tree.
python3 - "$ARTIFACT_DIR/build-info.json" "$REMOTE_HASH" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
info = json.loads(path.read_text())
if info.get("revision") != sys.argv[2] or info.get("sourceStatus") != "clean" or info.get("modified") is not False:
    raise SystemExit("Artifact build metadata does not match clean origin/main")
if not (path.parent / "index.html").is_file():
    raise SystemExit("Artifact has no index.html")
print("Verified clean artifact revision:", info["revision"])
PY

/usr/local/bin/deploy-to-cloudflare-pages.py "$ARTIFACT_DIR" dachoupai
for attempt in 1 2 3 4 5 6; do
    if verify_public; then
        record_success
        exit 0
    fi
    [ "$attempt" -eq 6 ] || sleep 5
done
log "Public domain propagation still pending; next minute will check it before another upload."
exit 1
