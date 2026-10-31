#!/usr/bin/env bash
# Cron invokes the installed receiver; production never installs or builds.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export GIT_TERMINAL_PROMPT=0
exec python3 /usr/local/bin/tangsongpai-artifact-deploy.py deploy "$@"
