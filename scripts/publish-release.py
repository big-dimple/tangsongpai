#!/usr/bin/env python3
"""Publish a complete CI-verified candidate as a manifest-matched Release."""
import filecmp
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('candidate_verifier', Path(__file__).with_name('verify-release-artifact.py'))
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
ASSETS = ('dist.tar.gz', 'dist.tar.gz.sha256', 'manifest.json')
REPO = re.compile(r'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')


def gh(*args):
    return subprocess.run(['gh', *args], check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, text=True, timeout=300).stdout


def gh_json(*args):
    return json.loads(gh(*args))


def main_revision(repo):
    return gh_json('api', f'repos/{repo}/git/ref/heads/main')['object']['sha']


def ensure_current(repo, revision):
    if main_revision(repo) != revision:
        raise ValueError('main moved; refusing to publish this candidate')


def get_tag(repo, tag):
    try:
        return gh_json('api', f'repos/{repo}/git/ref/tags/{tag}')['object']
    except subprocess.CalledProcessError as error:
        if 'HTTP 404' in (error.stderr or ''):
            return None
        raise


def ensure_tag(repo, tag, revision, create=False):
    obj = get_tag(repo, tag)
    if obj is None and create:
        gh('api', '--method', 'POST', f'repos/{repo}/git/refs', '-f', f'ref=refs/tags/{tag}', '-f', f'sha={revision}')
        obj = get_tag(repo, tag)
    # This workflow creates lightweight tags only; never move or reinterpret an existing tag.
    if not obj or obj.get('type') != 'commit' or obj.get('sha') != revision:
        raise ValueError('release tag is missing or does not point directly to the candidate commit')


def find_release(repo, tag):
    pages = gh_json('api', f'repos/{repo}/releases?per_page=100', '--paginate', '--slurp')
    matches = [item for page in pages for item in page if item.get('tag_name') == tag]
    if len(matches) > 1:
        raise ValueError('multiple releases use the target tag')
    return matches[0] if matches else None


def check_draft(release, tag):
    if not release or release.get('tag_name') != tag or release.get('draft') is not True or release.get('prerelease') is not False:
        raise ValueError('expected a draft full release; refusing to alter an existing published release')
    assets = release.get('assets')
    if not isinstance(assets, list) or sorted(a.get('name') for a in assets) != sorted(ASSETS) or any(a.get('state') != 'uploaded' for a in assets):
        raise ValueError('draft does not contain exactly the three fully uploaded assets')


def publish(directory, repo, revision):
    if not REPO.fullmatch(repo) or not verifier.prepare.SHA.fullmatch(revision):
        raise ValueError('invalid repository or revision')
    verifier.verify(directory, revision)
    tag = 'v' + revision
    ensure_current(repo, revision)
    ensure_tag(repo, tag, revision, create=True)
    release = find_release(repo, tag)
    if release is None:
        gh('release', 'create', tag, '-R', repo, '--verify-tag', '--draft', '--title', revision,
           '--notes', 'CI-verified production artifact', *(str(directory / name) for name in ASSETS))
        release = find_release(repo, tag)
    # Existing drafts are only resumed if all asset bytes match the CI candidate.
    check_draft(release, tag)
    with tempfile.TemporaryDirectory(prefix='release-verify-') as temp:
        gh('release', 'download', tag, '-R', repo, '--dir', temp,
           *[arg for name in ASSETS for arg in ('--pattern', name)])
        downloaded = Path(temp)
        if {p.name for p in downloaded.iterdir()} != set(ASSETS):
            raise ValueError('downloaded release asset set is incomplete')
        for name in ASSETS:
            if not filecmp.cmp(directory / name, downloaded / name, shallow=False):
                raise ValueError('downloaded release asset differs from candidate: ' + name)
        verifier.verify(downloaded, revision)
    # Do not promote an incomplete, changed, retagged or superseded draft.
    check_draft(find_release(repo, tag), tag)
    ensure_tag(repo, tag, revision)
    ensure_current(repo, revision)
    gh('release', 'edit', tag, '-R', repo, '--draft=false', '--latest')
    latest = gh_json('api', f'repos/{repo}/releases/latest')
    if latest.get('tag_name') != tag or latest.get('draft') is not False or latest.get('prerelease') is not False:
        raise ValueError('published release was not confirmed as latest')
    ensure_current(repo, revision)
    print('Published verified latest Release', tag)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 4:
            raise ValueError('usage: publish-release.py DIRECTORY OWNER/REPO REVISION')
        publish(Path(sys.argv[1]), sys.argv[2], sys.argv[3])
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        raise SystemExit(1)
