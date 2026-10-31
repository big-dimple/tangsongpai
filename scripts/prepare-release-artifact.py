#!/usr/bin/env python3
"""Package the existing CI-verified production build for Pages deployment."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

SHA = re.compile(r'^[0-9a-f]{40}$')
DIGEST = re.compile(r'^[0-9a-f]{64}$')


def command(args, cwd=None, timeout=120):
    return subprocess.run(args, cwd=cwd, timeout=timeout, check=True,
                          text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_ci(ci, revision):
    require(isinstance(ci, dict) and ci.get('scope') == 'all' and
            ci.get('testedCommit') == revision and ci.get('status') == 'PASS' and
            ci.get('exitCode') == 0, 'CI report is not a passing all-scope report for this revision')
    before, after = ci.get('before'), ci.get('after')
    require(isinstance(before, dict) and before == after and before.get('head') == revision and
            all(isinstance(before.get(k), str) and DIGEST.fullmatch(before[k]) for k in ('source', 'index')),
            'CI source/index/HEAD snapshots do not match')
    steps = ci.get('steps')
    require(isinstance(steps, list) and [s.get('name') for s in steps] ==
            ['test', 'verify:content', 'build', 'verify:smoke'] and
            all(s.get('status') == 'PASS' and s.get('childExitCode') == 0 for s in steps),
            'CI steps are incomplete or failed')


def check_build(info, revision):
    require(isinstance(info, dict) and info.get('revision') == revision and
            info.get('sourceStatus') == 'clean' and info.get('modified') is False and
            isinstance(info.get('version'), str) and isinstance(info.get('builtAt'), str),
            'build-info does not describe the expected clean revision')


def digest_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def prepare():
    root = Path(__file__).resolve().parent.parent
    revision = command(['git', 'rev-parse', 'HEAD'], root)
    require(SHA.fullmatch(revision), 'invalid HEAD')
    require(not command(['git', 'status', '--porcelain'], root), 'commit or remove untracked/modified work before preparing an artifact')
    ci = json.loads((root / 'shots/ci/all.json').read_text(encoding='utf-8'))
    check_ci(ci, revision)
    js = "import {snapshotSource} from './scripts/check-runner.mjs'; console.log(JSON.stringify(snapshotSource(process.cwd())))"
    snapshot = json.loads(command(['node', '--input-type=module', '-e', js], root, 300))
    require(snapshot == ci['after'], 'source or index changed since CI; rerun CI')
    dist = root / 'dist'
    info = json.loads((dist / 'build-info.json').read_text(encoding='utf-8'))
    check_build(info, revision)
    require((dist / 'index.html').is_file(), 'dist/index.html is missing')
    output = root / 'shots' / 'deploy' / revision
    output.parent.mkdir(parents=True, exist_ok=True)
    require(not output.exists(), 'artifact directory already exists; inspect it before replacing')
    with tempfile.TemporaryDirectory(prefix='artifact-', dir=output.parent) as temporary:
        temp = Path(temporary)
        count = 0
        total = 0
        with tarfile.open(temp / 'dist.tar.gz', 'w:gz') as archive:
            for path in sorted(dist.rglob('*')):
                require(not path.is_symlink() and (path.is_dir() or path.is_file()), 'dist contains a symlink or special file')
                count += 1
                size = path.stat().st_size if path.is_file() else 0
                total += size
                require(count <= 20000 and total <= 512 * 1024 * 1024 and size <= 25 * 1024 * 1024,
                        'dist exceeds deployment safety limits')
                archive.add(path, arcname=path.relative_to(dist).as_posix(), recursive=False)
        require((temp / 'dist.tar.gz').stat().st_size <= 256 * 1024 * 1024, 'compressed artifact exceeds deployment safety limits')
        digest = digest_file(temp / 'dist.tar.gz')
        (temp / 'dist.tar.gz.sha256').write_text(digest + '  dist.tar.gz\n', encoding='utf-8')
        manifest = {'schemaVersion': 1, 'sourceRevision': revision,
                    'artifact': {'name': 'dist.tar.gz', 'sha256': digest},
                    'buildInfo': info, 'ci': ci}
        (temp / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        require(json.loads(command(['node', '--input-type=module', '-e', js], root, 300)) == ci['after'],
                'source or index changed while packaging')
        temp.rename(output)
    print('Prepared:', output)
    print('After checking the artifact and obtaining authorization, publish the three files as a complete GitHub Release tagged', 'v' + revision)


if __name__ == '__main__':
    try:
        prepare()
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=__import__('sys').stderr)
        raise SystemExit(1)
