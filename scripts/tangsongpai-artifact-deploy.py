#!/usr/bin/env python3
"""Create a CI-backed dist handoff, or receive and publish it on the server."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.parse import quote

REPO = 'big-dimple/tangsongpai'
PROJECT = 'dachoupai'
STATE = Path('/var/lib/tangsongpai-deploy')
LOG = Path('/var/log/tangsongpai-autodeploy.log')
ROOT = Path('/var/www/tangsongpai')
ASSETS = ('dist.tar.gz', 'dist.tar.gz.sha256', 'manifest.json')
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
    print('After checking the artifact and obtaining authorization, publish the three files as a complete GitHub Release tagged', revision)


def unpack_verified(download, dest, revision, allow_unverified_ci=False):
    manifest = json.loads((download / 'manifest.json').read_text(encoding='utf-8'))
    require(manifest.get('schemaVersion') == 1 and manifest.get('sourceRevision') == revision,
            'manifest revision/schema mismatch')
    artifact = manifest.get('artifact', {})
    expected = artifact.get('sha256', '')
    require(artifact.get('name') == 'dist.tar.gz' and isinstance(expected, str) and DIGEST.fullmatch(expected), 'invalid artifact metadata')
    checksum = (download / 'dist.tar.gz.sha256').read_text(encoding='utf-8').strip().split()
    require(checksum == [expected, 'dist.tar.gz'] and digest_file(download / 'dist.tar.gz') == expected, 'artifact checksum mismatch')
    try:
        check_ci(manifest.get('ci'), revision)
    except ValueError:
        if not allow_unverified_ci:
            raise
        require(isinstance(manifest.get('ci'), dict), 'manifest has no CI record')
        log('WARNING: CI report is not fully verified; explicitly authorized one-time exception for ' + revision)
    check_build(manifest.get('buildInfo'), revision)
    dest.mkdir()
    names, count, total = set(), 0, 0
    with tarfile.open(download / 'dist.tar.gz', 'r|gz') as archive:
        for item in archive:
            name = item.name
            while name.startswith('./'):
                name = name[2:]
            if name in ('', '.') and item.isdir():
                continue
            path = PurePosixPath(name)
            require(name and '\\' not in name and not path.is_absolute() and
                    all(part not in ('', '.', '..') for part in path.parts), 'unsafe archive path')
            require(item.isdir() or item.isfile(), 'archive contains links or special files')
            key = path.as_posix()
            require(key not in names, 'duplicate archive path')
            names.add(key)
            count += 1
            total += item.size
            require(count <= 20000 and total <= 512 * 1024 * 1024 and item.size <= 25 * 1024 * 1024,
                    'archive exceeds safety limits')
            target = dest.joinpath(*path.parts)
            if item.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(item) as source, target.open('xb') as out:
                    shutil.copyfileobj(source, out, 1024 * 1024)
    require((dest / 'index.html').is_file(), 'archive has no index.html')
    info = json.loads((dest / 'build-info.json').read_text(encoding='utf-8'))
    check_build(info, revision)
    require(info == manifest['buildInfo'], 'archive build-info differs from manifest')


def cf_api(path='', method='GET'):
    spec = importlib.util.spec_from_file_location('pages_cache', '/usr/local/bin/tangsongpai-cache-cloudflare.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    config = module.credentials()
    base = 'https://api.cloudflare.com/client/v4/accounts/' + config['ACCOUNT_ID'] + '/pages/projects/' + PROJECT
    request = Request(base + path, data=b'{}' if method == 'POST' else None, method=method,
                      headers={'Authorization': 'Bearer ' + config['TOKEN'], 'Content-Type': 'application/json'})
    with urlopen(request, timeout=30) as response:
        result = json.load(response)
    require(result.get('success'), 'Cloudflare API rejected the request')
    return result['result']


def health(base, revision):
    try:
        headers = {'Cache-Control': 'no-cache', 'User-Agent': 'Mozilla/5.0 tangsongpai-deploy/1.0'}
        with urlopen(Request(base + '/build-info.json?revision=' + revision,
                             headers=headers), timeout=10) as response:
            check_build(json.load(response), revision)
        with urlopen(Request(base + '/?revision=' + revision, headers=headers, method='GET'), timeout=10) as response:
            return response.status == 200
    except Exception:
        return False


def write_atomic(path, value):
    temporary = path.with_name(path.name + '.tmp')
    temporary.write_text(value, encoding='utf-8')
    os.replace(temporary, path)


def log(message):
    with LOG.open('a', encoding='utf-8') as f:
        f.write(time.strftime('[%Y-%m-%d %H:%M:%S] ') + message + '\n')


def prune_artifacts(current):
    releases = STATE / 'artifacts'
    candidates = [p for p in releases.iterdir() if not p.is_symlink() and p.is_dir() and
                  re.fullmatch(r'[0-9a-f]{40}-[a-z0-9_]{8}', p.name)]
    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    keep = {str(current)} | {str(p) for p in candidates[:3]}
    for path in candidates:
        if str(path) not in keep:
            shutil.rmtree(path)


def release_for(revision):
    releases = []
    page_number = 1
    while True:
        page = json.loads(command(['gh', 'api', 'repos/' + REPO + '/releases?per_page=100&page=' + str(page_number)]))
        require(isinstance(page, list), 'unexpected GitHub release list')
        releases.extend(release for release in page if not release.get('draft') and not release.get('prerelease'))
        if len(page) < 100:
            break
        page_number += 1
    releases.sort(key=lambda item: item.get('tag_name') != 'v' + revision)
    cache_path = STATE / 'release-manifest-cache.json'
    try:
        cache = json.loads(cache_path.read_text(encoding='utf-8'))
        if not isinstance(cache, dict):
            cache = {}
    except (OSError, ValueError):
        cache = {}
    for release in releases:
        tag = release.get('tag_name')
        if not isinstance(tag, str) or not tag or tag.startswith('-'):
            continue
        assets = release.get('assets', [])
        manifests = [a for a in assets if a.get('name') == 'manifest.json' and a.get('state') == 'uploaded'
                     and 0 < a.get('size', 0) <= 256 * 1024]
        if len(manifests) != 1:
            continue
        asset = manifests[0]
        cache_key = str(asset.get('id', '')) + ':' + str(asset.get('updated_at', '')) + ':' + str(asset.get('size', ''))
        source_revision = cache.get(cache_key) if asset.get('id') else None
        if source_revision is None:
            try:
                manifest = json.loads(command(['gh', 'release', 'download', tag, '-R', REPO,
                                               '--pattern', 'manifest.json', '--output', '-'], timeout=30))
            except ValueError:
                continue
            except subprocess.CalledProcessError as error:
                if 'HTTP 404' in error.stderr:
                    continue
                raise
            source_revision = manifest.get('sourceRevision') if isinstance(manifest, dict) else None
            if isinstance(source_revision, str) and SHA.fullmatch(source_revision) and asset.get('id'):
                cache[cache_key] = source_revision
                if len(cache) > 2000:
                    cache = dict(list(cache.items())[-2000:])
                write_atomic(cache_path, json.dumps(cache) + '\n')
        if source_revision != revision:
            continue
        for name in ASSETS:
            matching = [a for a in assets if a.get('name') == name and a.get('state') == 'uploaded']
            limit = {'dist.tar.gz': 256 * 1024 * 1024, 'dist.tar.gz.sha256': 4096, 'manifest.json': 256 * 1024}[name]
            require(len(matching) == 1 and 0 < matching[0].get('size', 0) <= limit, 'release asset missing or too large: ' + name)
        obj = json.loads(command(['gh', 'api', 'repos/' + REPO + '/git/ref/tags/' + quote(tag, safe='/')]))['object']
        for _ in range(5):
            if obj['type'] != 'tag':
                break
            obj = json.loads(command(['gh', 'api', 'repos/' + REPO + '/git/tags/' + obj['sha']]))['object']
        require(obj.get('type') == 'commit' and obj.get('sha') == revision, 'release tag does not point to the target commit')
        return release
    return None


def deploy(force, allowed_revision=''):
    import fcntl
    STATE.mkdir(parents=True, exist_ok=True)
    with open('/tmp/tangsongpai-autodeploy.lock', 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        try:
            os.nice(10)
        except OSError:
            pass
        revision = ''
        try:
            command(['git', 'fetch', 'origin', 'main', '--quiet'], ROOT)
            revision = command(['git', 'rev-parse', 'origin/main'], ROOT)
            require(SHA.fullmatch(revision), 'invalid main revision')
            exception_path = STATE / 'authorized-ci-exception'
            if allowed_revision:
                require(allowed_revision == revision, 'CI exception is for a different main revision')
                write_atomic(exception_path, revision + '\n')
            elif exception_path.exists():
                if exception_path.read_text().strip() == revision:
                    allowed_revision = revision
                else:
                    exception_path.unlink()
            deployed = (STATE / 'deployed-revision').read_text().strip() if (STATE / 'deployed-revision').exists() else ''
            pending_path = STATE / 'artifact-pending.json'
            if pending_path.exists():
                pending = json.loads(pending_path.read_text())
                if health('https://pai.hp666.cc', pending['revision']):
                    write_atomic(STATE / 'deployed-revision', pending['revision'] + '\n')
                    write_atomic(STATE / 'current-artifact', pending['directory'] + '\n')
                    pending_path.unlink()
                    if pending['revision'] == revision:
                        exception_path.unlink(missing_ok=True)
                    deployed = pending['revision']
                    log('Public domain confirmed artifact ' + deployed)
                    try:
                        prune_artifacts(pending['directory'])
                    except OSError:
                        log('Could not prune old artifact directories')
                else:
                    elapsed = time.time() - pending.get('createdAt', time.time())
                    if elapsed >= 600 and health(pending['url'], pending['revision']):
                        if revision != pending['revision']:
                            pending_path.unlink()
                            log('Older healthy deployment remains pending domain propagation; checking newer main ' + revision)
                        else:
                            return
                    elif elapsed >= 600:
                        current = cf_api().get('canonical_deployment') or {}
                        if current.get('url') == pending['url'] and current.get('id') != pending['previous']:
                            cf_api('/deployments/' + pending['previous'] + '/rollback', 'POST')
                            log('Rolled back unhealthy deployment to previous Pages version ' + pending['previous'])
                            pending_path.unlink()
                            raise ValueError('deployment health check failed after rollback')
                        else:
                            pending_path.unlink()
                            raise ValueError('unhealthy pending deployment; Pages did not switch to it or changed independently')
                    else:
                        return
            if revision == deployed and not force:
                return
            if SHA.fullmatch(deployed):
                command(['git', 'merge-base', '--is-ancestor', deployed, revision], ROOT)
            failure_path = STATE / 'artifact-failure.json'
            if failure_path.exists() and not force:
                failure = json.loads(failure_path.read_text())
                if failure.get('revision') == revision and time.time() < failure.get('retryAfter', 0):
                    return
            release = release_for(revision)
            if release is None:
                waiting = STATE / 'artifact-waiting'
                if not waiting.exists() or waiting.read_text().strip() != revision:
                    write_atomic(waiting, revision + '\n')
                    log('Waiting for a completed CI artifact release for main ' + revision)
                return
            log('Receiving completed artifact for main ' + revision)
            releases = STATE / 'artifacts'
            releases.mkdir(exist_ok=True)
            with tempfile.TemporaryDirectory(prefix='incoming-', dir=STATE) as tempname:
                temp = Path(tempname)
                download = temp / 'download'
                download.mkdir()
                args = ['gh', 'release', 'download', release['tag_name'], '-R', REPO, '--dir', str(download)]
                for asset in ASSETS:
                    args += ['--pattern', asset]
                command(args, timeout=900)
                for asset in ASSETS:
                    require((download / asset).is_file() and not (download / asset).is_symlink(), 'invalid downloaded asset')
                dest = temp / 'dist'
                unpack_verified(download, dest, revision, allow_unverified_ci=(allowed_revision == revision))
                command(['git', 'fetch', 'origin', 'main', '--quiet'], ROOT)
                if command(['git', 'rev-parse', 'origin/main'], ROOT) != revision:
                    log('main advanced while receiving; will look for its artifact on the next poll')
                    return
                canonical = cf_api().get('canonical_deployment') or {}
                previous = canonical.get('id')
                require(previous and canonical.get('environment') == 'production' and
                        (canonical.get('latest_stage') or {}).get('status') == 'success', 'cannot identify a healthy rollback target')
                final = Path(tempfile.mkdtemp(prefix=revision + '-', dir=releases))
                os.replace(dest, final / 'dist')
                upload = command(['/usr/local/bin/tangsongpai-upload-cloudflare.py', str(final / 'dist')], timeout=900)
                if 'Asset cache registration failed' in upload:
                    log('Asset cache registration failed; retrying with the shared cache helper')
                    try:
                        command(['/usr/local/bin/tangsongpai-cache-cloudflare.py', str(final / 'dist')], timeout=180)
                        log('Asset cache registration recovered')
                    except Exception as error:
                        log('Asset cache retry failed; deployment was created: ' + type(error).__name__)
                match = re.search(r'https://[a-z0-9-]+\.dachoupai\.pages\.dev', upload)
                require(match, 'Cloudflare upload returned no deployment URL')
                url = match.group(0)
                write_atomic(pending_path, json.dumps({'revision': revision, 'directory': str(final), 'url': url,
                                                      'previous': previous, 'createdAt': time.time()}) + '\n')
                for _ in range(6):
                    if health(url, revision) and health('https://pai.hp666.cc', revision):
                        write_atomic(STATE / 'deployed-revision', revision + '\n')
                        write_atomic(STATE / 'current-artifact', str(final) + '\n')
                        pending_path.unlink()
                        exception_path.unlink(missing_ok=True)
                        log('Public domain confirmed artifact ' + revision)
                        try:
                            prune_artifacts(final)
                        except OSError:
                            log('Could not prune old artifact directories')
                        break
                    time.sleep(5)
                else:
                    log('Deployment submitted; waiting for health and public domain confirmation for ' + revision)
                failure_path.unlink(missing_ok=True)
                (STATE / 'artifact-waiting').unlink(missing_ok=True)
        except Exception as exc:
            detail = str(exc)
            if isinstance(exc, subprocess.CalledProcessError) and exc.stderr:
                safe_stderr = re.sub(r'(?i)(bearer\s+|token[=:]\s*)\S+', r'\1[redacted]', exc.stderr.strip())
                detail += ': ' + safe_stderr[:500]
            if revision:
                prior = {}
                try:
                    prior = json.loads((STATE / 'artifact-failure.json').read_text())
                except (OSError, ValueError):
                    pass
                count = min(4, prior.get('count', 0) + 1) if prior.get('revision') == revision else 1
                delay = [60, 300, 600, 1200][count - 1]
                write_atomic(STATE / 'artifact-failure.json', json.dumps({'revision': revision, 'count': count, 'retryAfter': time.time() + delay}) + '\n')
                log('ERROR: ' + detail + '; retry in ' + str(delay // 60) + ' minutes')
            else:
                log('ERROR: ' + detail + '; retry next poll')
            raise


if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['prepare']:
            prepare()
        elif len(sys.argv) >= 2 and sys.argv[1] == 'deploy':
            args = sys.argv[2:]
            overrides = [arg.partition('=')[2] for arg in args if arg.startswith('--allow-unverified-ci=')]
            require(len(overrides) <= 1 and all(arg == '--force' or arg.startswith('--allow-unverified-ci=') for arg in args), 'invalid deploy arguments')
            require(not overrides or SHA.fullmatch(overrides[0]), 'CI exception must name a complete revision')
            deploy('--force' in args, overrides[0] if overrides else '')
        else:
            raise ValueError('usage: tangsongpai-artifact-deploy.py prepare | deploy [--force]')
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        sys.exit(1)
