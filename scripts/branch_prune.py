#!/usr/bin/env python3
"""Prune provably redundant remote GitHub branches without deleting unique work.

Usage:
  python3 scripts/branch_prune.py --repo big-dimple/tangsongpai
  python3 scripts/branch_prune.py --repo big-dimple/tangsongpai --apply --max-delete 100

Requires Python 3.10+ and GH_TOKEN / GITHUB_TOKEN, or authenticated GitHub CLI
('gh auth login'). No third-party Python dependencies.

Default = dry run.  A branch is eligible only if it has NO commits ahead of
the current default branch, is not protected, is not the default branch,
has no open PR and does not match the explicitly retained work patterns.
An apply rechecks HEAD SHA, protection, ahead-by, and open PR immediately
before deletion.  Diverged/ahead branches are NEVER deleted.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API_ROOT = "https://api.github.com"
RETAIN_PARTS = (
    "qiyu", "encounter", "polychrome-isolated", "late-multiplier",
)
RETAIN_EXACT = {
    "main",
    "feat/qiyu-special-animation-plan-20261022",
    "feat/b2-polychrome-isolated-candidate-20261022",
    "research/late-multiplier-reachability-20261021",
    "feat/poker-polychrome-encounter-20261022",
}


class GitHubError(RuntimeError):
    pass


class GitHub:
    def __init__(self, repo: str):
        self.repo = repo
        token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
        if not token:
            try:
                token = subprocess.check_output(
                    ["gh", "auth", "token"], text=True, stderr=subprocess.DEVNULL
                ).strip()
            except (OSError, subprocess.CalledProcessError):
                pass
        if not token:
            raise GitHubError(
                "No credentials. Set GH_TOKEN/GITHUB_TOKEN or run 'gh auth login'."
            )
        self.token = token

    def request(self, method: str, endpoint: str):
        url = API_ROOT + endpoint
        request = Request(url, method=method, headers={
            "Authorization": "Bearer " + self.token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "tangsongpai-safe-branch-prune",
        })
        for attempt in range(4):
            try:
                with urlopen(request, timeout=35) as r:
                    body = r.read()
                return json.loads(body) if body else None
            except HTTPError as exc:
                message = exc.read().decode("utf-8", errors="replace")[:250]
                if exc.code in (429, 502, 503, 504) and attempt < 3:
                    time.sleep(min(2 ** attempt, 8))
                    continue
                raise GitHubError(
                    f"{method} {endpoint}: HTTP {exc.code}, {message}"
                ) from exc
            except URLError as exc:
                if attempt < 3:
                    time.sleep(min(2 ** attempt, 8))
                    continue
                raise GitHubError(f"{method} {endpoint}: {exc}") from exc
        raise GitHubError(f"Retries exhausted for {method} {endpoint}")

    def paged(self, suffix: str):
        output = []
        for page in range(1, 99):
            rows = self.request(
                "GET", f"/repos/{self.repo}/{suffix}?per_page=100&page={page}"
            )
            if not isinstance(rows, list):
                raise GitHubError(f"Expected list for {suffix}, page {page}")
            output.extend(rows)
            if len(rows) < 100:
                return output
        raise GitHubError(f"Too many pages for {suffix}; refusing partial list")

    def branch(self, name: str):
        return self.request(
            "GET", f"/repos/{self.repo}/branches/{quote(name, safe='/')}"
        )

    def compare(self, default: str, name: str):
        base = quote(default, safe="")
        head = quote(name, safe="/")
        return self.request(
            "GET", f"/repos/{self.repo}/compare/{base}...{head}"
        )

    def current_open_prs(self, owner: str, branch: str):
        # GitHub's 'head' filter accepts owner:ref and returns only matching PRs.
        query = f"state=open&head={quote(owner + ':' + branch, safe='')}&per_page=100"
        return self.request("GET", f"/repos/{self.repo}/pulls?{query}")

    def delete_branch(self, name: str):
        return self.request(
            "DELETE", f"/repos/{self.repo}/git/refs/heads/{quote(name, safe='/')}"
        )


def save_report(rows, repo: str, default: str, apply: bool, path: Path):
    document = {
        "repo": repo,
        "default_branch": default,
        "run_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "mode": "APPLY" if apply else "DRY_RUN",
        "branch_count": len(rows),
        "counts": {},
        "branches": rows,
    }
    for row in rows:
        status = row["decision"]
        document["counts"][status] = document["counts"].get(status, 0) + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return document


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default="big-dimple/tangsongpai")
    parser.add_argument("--apply", action="store_true", help="Actually delete safe refs")
    parser.add_argument("--max-delete", type=int, default=100,
                        help="Per-run deletion limit; default 100, 0 means unlimited")
    parser.add_argument("--report", type=Path, default=None)
    args = parser.parse_args()
    if args.repo.count("/") != 1 or args.max_delete < 0:
        parser.error("Invalid --repo or --max-delete")

    gh = GitHub(args.repo)
    metadata = gh.request("GET", f"/repos/{args.repo}")
    default = metadata["default_branch"]
    owner = args.repo.split("/")[0]

    branches = gh.paged("branches")
    open_prs = gh.request(
        "GET", f"/repos/{args.repo}/pulls?state=open&per_page=100"
    )
    if not isinstance(open_prs, list) or len(open_prs) >= 100:
        raise GitHubError("Open PR listing may be incomplete; refusing deletions")
    active = {
        pr["head"]["ref"] for pr in open_prs
        if pr.get("head", {}).get("repo")
        and pr["head"]["repo"].get("full_name", "").lower() == args.repo.lower()
    }

    rows = []
    deletion_count = 0
    for i, branch in enumerate(branches, 1):
        name = branch["name"]
        sha = branch["commit"]["sha"]
        row = {"name": name, "original_sha": sha, "decision": "",
               "ahead_by": None, "behind_by": None}
        rows.append(row)

        if name == default or branch.get("protected", False):
            row["decision"] = "PROTECTED"
        elif name in RETAIN_EXACT or any(part in name.lower() for part in RETAIN_PARTS):
            row["decision"] = "RETAIN_ACTIVE_OR_RESEARCH"
        elif name in active:
            row["decision"] = "OPEN_PR"
        else:
            try:
                compare = gh.compare(default, name)
                row["ahead_by"] = compare.get("ahead_by")
                row["behind_by"] = compare.get("behind_by")
                if compare.get("ahead_by") != 0:
                    row["decision"] = "UNIQUE_COMMITS_RETAIN"
                elif not args.apply:
                    row["decision"] = "SAFE_CANDIDATE_DRY_RUN"
                elif args.max_delete and deletion_count >= args.max_delete:
                    row["decision"] = "SAFE_CANDIDATE_BATCH_LIMIT"
                else:
                    # Recheck all safety properties just before mutating.
                    fresh = gh.branch(name)
                    if fresh["commit"]["sha"] != sha:
                        row["decision"] = "SKIP_HEAD_CHANGED"
                    elif fresh.get("protected", False):
                        row["decision"] = "PROTECTED"
                    elif gh.current_open_prs(owner, name):
                        row["decision"] = "OPEN_PR"
                    else:
                        again = gh.compare(default, name)
                        if again.get("ahead_by") != 0:
                            row["decision"] = "SKIP_COMPARISON_CHANGED"
                        else:
                            gh.delete_branch(name)
                            row["decision"] = "DELETED"
                            deletion_count += 1
            except (GitHubError, KeyError, TypeError) as exc:
                row["decision"] = "ERROR_RETAIN"
                row["error"] = str(exc)[:400]
        if i % 50 == 0:
            print(f"Checked {i}/{len(branches)} branches", file=sys.stderr)

    report = args.report or Path(
        "branch-prune-" + dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        + (".apply.json" if args.apply else ".dry-run.json")
    )
    summary = save_report(rows, args.repo, default, args.apply, report)
    print(json.dumps({
        "report": str(report),
        "mode": summary["mode"],
        "total": len(rows),
        "counts": summary["counts"],
    }, ensure_ascii=False, indent=2))
    if "ERROR_RETAIN" in summary["counts"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (GitHubError, KeyError, ValueError) as exc:
        print(f"ABORTED: {exc}", file=sys.stderr)
        sys.exit(2)
