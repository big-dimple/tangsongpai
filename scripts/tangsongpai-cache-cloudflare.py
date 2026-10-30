#!/usr/bin/env python3
"""Keep the shared Pages uploader's successfully uploaded assets cached."""
import ast
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen


def credentials():
    # The existing shared uploader owns the machine's Pages credentials. Parse
    # its configuration without executing it or copying secrets into the repo.
    config = {}
    for node in ast.parse(Path('/usr/local/bin/deploy-to-cloudflare-pages.py').read_text()).body:
        if not (isinstance(node, ast.Assign) and len(node.targets) == 1 and
                isinstance(node.targets[0], ast.Name) and node.targets[0].id in ('TOKEN', 'ACCOUNT_ID')):
            continue
        value = node.value
        if not (isinstance(value, ast.Call) and len(value.args) == 2 and
                all(isinstance(arg, ast.Constant) and isinstance(arg.value, str) for arg in value.args)):
            raise ValueError('Unsupported shared uploader credential configuration')
        config[node.targets[0].id] = os.environ.get(value.args[0].value, value.args[1].value)
    if not config.get('TOKEN') or not config.get('ACCOUNT_ID'):
        raise ValueError('Missing shared Pages credentials')
    return config


def post_json(url, token, payload):
    request = Request(url, data=json.dumps(payload).encode(), method='POST',
                      headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    with urlopen(request, timeout=30) as response:
        result = json.load(response)
    if not result.get('success'):
        raise RuntimeError('Cloudflare rejected the cache update')
    return result


def main():
    if len(sys.argv) != 2 or not Path(sys.argv[1]).is_dir():
        raise ValueError('Usage: tangsongpai-cache-cloudflare.py DIST_DIR')
    hashes = []
    for path in Path(sys.argv[1]).rglob('*'):
        if path.is_file():
            hashes.append(hashlib.md5(path.read_bytes()).hexdigest())
    config = credentials()
    url = 'https://api.cloudflare.com/client/v4/accounts/' + config['ACCOUNT_ID'] + '/pages/projects/dachoupai/upload-token'
    with urlopen(Request(url, headers={'Authorization': 'Bearer ' + config['TOKEN']}), timeout=30) as response:
        jwt = json.load(response)['result']['jwt']
    post_json('https://api.cloudflare.com/client/v4/pages/assets/upsert-hashes', jwt, {'hashes': list(set(hashes))})
    print('Registered', len(set(hashes)), 'asset hashes for future deployments.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Pages asset cache update failed:', type(error).__name__, file=sys.stderr)
        sys.exit(1)
