#!/usr/bin/env python3
"""Upload only missing Pages assets without retaining the whole dist in memory."""
import base64
import hashlib
import importlib.util
import json
import mimetypes
from pathlib import Path
import sys
from urllib.request import Request, urlopen


def call(url, token, data=None, content_type='application/json'):
    request = Request(url, data=data, headers={'Authorization': 'Bearer ' + token, 'Content-Type': content_type},
                      method='POST' if data is not None else 'GET')
    with urlopen(request, timeout=120) as response:
        result = json.load(response)
    if not result.get('success'):
        raise RuntimeError('Cloudflare API rejected an asset or deployment request')
    return result['result']


def main():
    if len(sys.argv) != 2:
        raise ValueError('usage: tangsongpai-upload-cloudflare.py DIST_DIR')
    dist = Path(sys.argv[1])
    spec = importlib.util.spec_from_file_location('pages_cache', '/usr/local/bin/tangsongpai-cache-cloudflare.py')
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    config = helper.credentials()
    api = 'https://api.cloudflare.com/client/v4/accounts/' + config['ACCOUNT_ID'] + '/pages/projects/dachoupai'
    jwt = call(api + '/upload-token', config['TOKEN'])['jwt']
    manifest, files = {}, {}
    for path in sorted(dist.rglob('*')):
        if not path.is_file():
            continue
        if path.is_symlink():
            raise ValueError('dist contains a symlink')
        hasher = hashlib.md5()
        with path.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                hasher.update(block)
        digest = hasher.hexdigest()
        relative = '/' + path.relative_to(dist).as_posix()
        manifest[relative] = digest
        files[digest] = (path, mimetypes.guess_type(relative)[0] or 'application/octet-stream')
    missing = call('https://api.cloudflare.com/client/v4/pages/assets/check-missing', jwt,
                   json.dumps({'hashes': list(files)}).encode())
    if not isinstance(missing, list) or any(key not in files for key in missing):
        raise ValueError('unexpected list of missing assets')
    batch, size = [], 0
    def flush():
        if batch:
            call('https://api.cloudflare.com/client/v4/pages/assets/upload', jwt, json.dumps(batch).encode())
            batch.clear()
    for digest in missing:
        path, mime = files[digest]
        file_size = path.stat().st_size
        if batch and size + file_size > 8 * 1024 * 1024:
            flush()
            size = 0
        batch.append({'key': digest, 'value': base64.b64encode(path.read_bytes()).decode('ascii'),
                      'metadata': {'contentType': mime}, 'base64': True})
        size += file_size
        if size >= 8 * 1024 * 1024 or len(batch) >= 300:
            flush()
            size = 0
    flush()
    boundary = '----tangsongpai-pages-boundary'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="manifest"\r\n\r\n' +
            json.dumps(manifest) + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="branch"\r\n\r\nmain\r\n--{boundary}--\r\n').encode()
    deployment = call(api + '/deployments', config['TOKEN'], body, 'multipart/form-data; boundary=' + boundary)
    if not deployment.get('id') or not deployment.get('url'):
        raise ValueError('Cloudflare returned no deployment identity')
    try:
        cache_jwt = call(api + '/upload-token', config['TOKEN'])['jwt']
        call('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', cache_jwt,
             json.dumps({'hashes': list(files)}).encode())
    except Exception as error:
        print('Asset cache registration failed; deployment was created: ' + type(error).__name__ + ': ' + str(error))
    print(f"Uploaded {len(missing)} missing assets out of {len(manifest)} files; deployment: {deployment['url']}")


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        sys.exit(1)
