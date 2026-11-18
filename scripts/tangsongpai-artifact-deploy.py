#!/usr/bin/env python3
"""Poll main and deploy only its published, CI-verified Release."""
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
REPO = 'big-dimple/tangsongpai'
PROJECT = 'dachoupai'
PUBLIC_URL = 'https://pai.hp666.cc'
ROOT = Path('/var/www/tangsongpai')
STATE = Path('/var/lib/tangsongpai-deploy')
LOG = Path('/var/log/tangsongpai-autodeploy.log')
LOCK = Path('/tmp/tangsongpai-autodeploy.lock')
ASSETS = {'dist.tar.gz': 256 * 1024 * 1024, 'dist.tar.gz.sha256': 4096, 'manifest.json': 256 * 1024}
PREVIEW_URL = re.compile(r'https://[a-z0-9-]+\.dachoupai\.pages\.dev')


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, HERE / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verifier = load_script('verify-release-artifact.py')
require = verifier.prepare.require
sha = verifier.prepare.SHA


def command(args, cwd=None, timeout=120):
    return subprocess.run(args, cwd=cwd, timeout=timeout, check=True,
                          encoding='utf-8', stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout.strip()


def main_revision():
    command(['git', 'fetch', 'origin', 'main', '--quiet'], ROOT)
    revision = command(['git', 'rev-parse', 'origin/main'], ROOT)
    require(sha.fullmatch(revision), 'invalid main revision')
    return revision


def release_for(revision):
    require(sha.fullmatch(revision), 'invalid release revision')
    tag = 'v' + revision
    try:
        release = json.loads(command(['gh', 'api', f'repos/{REPO}/releases/tags/{tag}']))
    except subprocess.CalledProcessError as error:
        if 'HTTP 404' in (error.stderr or ''):
            return None
        raise
    if release.get('draft') is not False or release.get('prerelease') is not False:
        return None
    require(release.get('tag_name') == tag, 'release tag does not match main')
    assets = release.get('assets', [])
    require(len(assets) == len(ASSETS) and {a.get('name') for a in assets} == set(ASSETS),
            'release must contain exactly the three production assets')
    for asset in assets:
        require(asset.get('state') == 'uploaded' and 0 < asset.get('size', 0) <= ASSETS[asset['name']],
                'release asset is incomplete or too large: ' + asset['name'])
    obj = json.loads(command(['gh', 'api', f'repos/{REPO}/git/ref/tags/{tag}']))['object']
    require(obj.get('type') == 'commit' and obj.get('sha') == revision, 'release tag does not point to main')
    return tag


def pages(path='', method='GET'):
    config = load_script('tangsongpai-cache-cloudflare.py').credentials()
    base = f"https://api.cloudflare.com/client/v4/accounts/{config['ACCOUNT_ID']}/pages/projects/{PROJECT}"
    request = Request(base + path, method=method, data=b'{}' if method == 'POST' else None,
                      headers={'Authorization': 'Bearer ' + config['TOKEN'], 'Content-Type': 'application/json'})
    with urlopen(request, timeout=30) as response:
        result = json.load(response)
    require(result.get('success'), 'Cloudflare rejected the deployment request')
    return result['result']


def health(base, revision):
    headers = {'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 tangsongpai-deploy/1.0'}
    try:
        with urlopen(Request(base + '/build-info.json?revision=' + revision, headers=headers), timeout=10) as response:
            verifier.prepare.check_build(json.load(response), revision)
        with urlopen(Request(base + '/?revision=' + revision, headers=headers), timeout=10) as response:
            return response.status == 200
    except (OSError, ValueError):
        return False


def write_atomic(path, value):
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(value, encoding='utf-8')
    os.replace(temporary, path)


def log(message):
    with LOG.open('a', encoding='utf-8') as stream:
        stream.write(time.strftime('[%Y-%m-%d %H:%M:%S] ') + message + '\n')


def prune_artifacts():
    entries = sorted((p for p in (STATE / 'artifacts').iterdir()
                      if p.is_dir() and not p.is_symlink() and re.fullmatch(r'[0-9a-f]{40}-[a-z0-9_]{8}', p.name)),
                     key=lambda p: p.stat().st_mtime, reverse=True)
    current = Path((STATE / 'current-artifact').read_text(encoding='utf-8').strip())
    for entry in entries[3:]:
        if entry != current:
            shutil.rmtree(entry)


def settle_pending(revision):
    path = STATE / 'artifact-pending.json'
    if not path.exists():
        return True
    pending = json.loads(path.read_text(encoding='utf-8'))
    deployed = pending['revision']
    require(sha.fullmatch(deployed) and PREVIEW_URL.fullmatch(pending['url']), 'invalid pending deployment')
    if health(PUBLIC_URL, deployed):
        write_atomic(STATE / 'current-artifact', pending['directory'] + '\n')
        write_atomic(STATE / 'deployed-revision', deployed + '\n')
        path.unlink()
        log('Public domain confirmed ' + deployed)
        try:
            prune_artifacts()
        except OSError:
            log('Could not prune old artifact directories')
        return True
    if time.time() - pending['createdAt'] < 600:
        return False
    if health(pending['url'], deployed):
        if revision == deployed:
            return False
        path.unlink()
        log('Older preview is healthy. Checking the newer main revision.')
        return True
    current = pages().get('canonical_deployment') or {}
    if current.get('url') == pending['url'] and current.get('id') != pending['previous']:
        previous = pending['previous']
        require(re.fullmatch(r'[0-9a-fA-F-]{36}', previous), 'invalid rollback deployment ID')
        pages(f'/deployments/{previous}/rollback', 'POST')
        log('Rolled back an unhealthy Pages deployment')
    path.unlink()
    raise ValueError('deployment health check failed')


def receive(revision, tag):
    with tempfile.TemporaryDirectory(prefix='incoming-', dir=STATE) as name:
        temp = Path(name)
        download, dist = temp / 'download', temp / 'dist'
        download.mkdir()
        command(['gh', 'release', 'download', tag, '-R', REPO, '--dir', str(download),
                 *[part for asset in ASSETS for part in ('--pattern', asset)]], timeout=900)
        require({p.name for p in download.iterdir()} == set(ASSETS) and
                all(p.is_file() and not p.is_symlink() for p in download.iterdir()), 'invalid downloaded assets')
        verifier.verify(download, revision, destination=dist)
        if main_revision() != revision:
            log('main advanced while receiving. Skipping the superseded artifact.')
            return
        canonical = pages().get('canonical_deployment') or {}
        previous = canonical.get('id')
        require(previous and canonical.get('environment') == 'production' and
                (canonical.get('latest_stage') or {}).get('status') == 'success', 'no healthy rollback target')
        artifacts = STATE / 'artifacts'
        artifacts.mkdir(exist_ok=True)
        final = Path(tempfile.mkdtemp(prefix=revision + '-', dir=artifacts))
        os.replace(dist, final / 'dist')
        upload = command([sys.executable, str(HERE / 'tangsongpai-upload-cloudflare.py'), str(final / 'dist')],
                         timeout=900)
        match = PREVIEW_URL.search(upload)
        require(match, 'Cloudflare returned no deployment URL')
        pending = {'revision': revision, 'directory': str(final), 'url': match.group(),
                   'previous': previous, 'createdAt': time.time()}
        write_atomic(STATE / 'artifact-pending.json', json.dumps(pending) + '\n')
        if 'Asset cache registration failed' in upload:
            try:
                command([sys.executable, str(HERE / 'tangsongpai-cache-cloudflare.py'), str(final / 'dist')], timeout=180)
            except (OSError, subprocess.SubprocessError) as error:
                log('Asset cache retry failed: ' + type(error).__name__)
        settle_pending(revision)


def poll(force):
    revision = main_revision()
    failure_path = STATE / 'artifact-failure.json'
    failure = json.loads(failure_path.read_text(encoding='utf-8')) if failure_path.exists() else {}
    same_failure = failure.get('revision') == revision
    try:
        if not settle_pending(revision):
            return
        deployed_path = STATE / 'deployed-revision'
        if deployed_path.exists():
            deployed = deployed_path.read_text(encoding='utf-8').strip()
            if deployed == revision and not force:
                return
            if sha.fullmatch(deployed):
                command(['git', 'merge-base', '--is-ancestor', deployed, revision], ROOT)
        if same_failure and time.time() < failure.get('retryAfter', 0) and not force:
            return
        tag = release_for(revision)
        if tag is None:
            return
        receive(revision, tag)
        failure_path.unlink(missing_ok=True)
    except Exception:
        count = min(4, failure.get('count', 0) + 1) if same_failure else 1
        delay = (60, 300, 600, 1200)[count - 1]
        write_atomic(failure_path, json.dumps({'revision': revision, 'count': count,
                                               'retryAfter': time.time() + delay}) + '\n')
        raise


def deploy(force):
    import fcntl
    STATE.mkdir(parents=True, exist_ok=True)
    with LOCK.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        poll(force)


if __name__ == '__main__':
    try:
        args = sys.argv[1:]
        require(args in (['deploy'], ['deploy', '--force']), 'usage: tangsongpai-artifact-deploy.py deploy [--force]')
        deploy('--force' in args)
    except Exception as error:
        detail = (f'{Path(error.cmd[0]).name} exited with {error.returncode}'
                  if isinstance(error, subprocess.CalledProcessError) else str(error))
        log('ERROR: ' + detail)
        print(detail, file=sys.stderr)
        raise SystemExit(1)
