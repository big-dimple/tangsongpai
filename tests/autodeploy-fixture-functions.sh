# In-process command fixtures for autodeploy-ci-gate.test.mjs.
# The production deployment script is unchanged; only its external tools are replaced.
flock() { :; }
timeout() {
    shift 2
    if [ "$DEPLOY_FAIL" = timeout ] && [ "${1:-}" = npx ]; then return 124; fi
    "$@"
}
git() {
    echo "git $*" >> "$DEPLOY_TEST_ROOT/calls"
    if [ "${1:-}" = -C ]; then shift 2; fi
    case "$*" in
        'fetch origin main --quiet') echo fetch >> "$DEPLOY_TEST_ROOT/fetches";;
        'rev-parse origin/main')
            local count=0 line
            while IFS= read -r line; do count=$((count + 1)); done < "$DEPLOY_TEST_ROOT/fetches"
            if [ "$DEPLOY_ADVANCE" = 1 ] && [ "$count" -gt 1 ]; then echo "$DEPLOY_PREVIOUS"; else echo "$DEPLOY_REVISION"; fi;;
        'worktree add --detach '*) mkdir -p "$4/dist";;
        'worktree remove --force '*) :;;
        'cat-file -e '*) return 0;;
        'merge-base --is-ancestor '*) if [ "$DEPLOY_DIVERGED" = 1 ]; then return 1; fi;;
        'status --porcelain') if [ "$DEPLOY_DIRTY" = 1 ]; then echo ' M source'; fi;;
        *) echo "unexpected git: $*" >&2; return 2;;
    esac
}
npm() {
    echo "npm $*" >> "$DEPLOY_TEST_ROOT/calls"
    if [ "$DEPLOY_FAIL" = install ]; then return 1; fi
}
npx() {
    echo "npx $*" >> "$DEPLOY_TEST_ROOT/calls"
    if [ "$DEPLOY_FAIL" = build ]; then return 1; fi
    cp "$DEPLOY_TEST_ROOT/build.json" dist/build-info.json
    echo fixture > dist/index.html
}
sleep() { :; }
cache() {
    echo cache >> "$DEPLOY_TEST_ROOT/calls"
    if [ "$DEPLOY_CACHE_FAIL" = 1 ]; then return 1; fi
}
curl() {
    echo curl >> "$DEPLOY_TEST_ROOT/calls"
    if [ -f "$DEPLOY_TEST_ROOT/uploaded" ] && [ "$DEPLOY_PROPAGATED" = 1 ]; then
        printf '%s\n' "$(<"$DEPLOY_TEST_ROOT/current.json")"
    else
        printf '%s\n' "$(<"$DEPLOY_TEST_ROOT/served.json")"
    fi
}
upload() {
    echo upload >> "$DEPLOY_TEST_ROOT/calls"
    : > "$DEPLOY_TEST_ROOT/uploaded"
}
python3() {
    local json
    json=$(<"$2")
    [[ "$json" == *'"revision":"'$3'"'* && "$json" == *'"sourceStatus":"clean"'* && "$json" == *'"modified":false'* ]] || return 1
    if [ "$2" = dist/build-info.json ] && [ ! -f dist/index.html ]; then return 1; fi
}
