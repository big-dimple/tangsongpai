#!/usr/bin/env python3
"""Verify a release candidate without extracting it or publishing anything."""
import importlib.util
import json
from pathlib import Path, PurePosixPath
import sys
import tarfile

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('prepare_release', Path(__file__).with_name('prepare-release-artifact.py'))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


def verify(directory, revision):
    require = prepare.require
    require(prepare.SHA.fullmatch(revision), 'invalid revision')
    manifest = json.loads((directory / 'manifest.json').read_text(encoding='utf-8'))
    require(manifest.get('schemaVersion') == 1 and manifest.get('sourceRevision') == revision,
            'manifest revision/schema mismatch')
    artifact = manifest.get('artifact', {})
    expected = artifact.get('sha256', '')
    require(artifact.get('name') == 'dist.tar.gz' and isinstance(expected, str)
            and prepare.DIGEST.fullmatch(expected), 'invalid artifact metadata')
    checksum = (directory / 'dist.tar.gz.sha256').read_text(encoding='utf-8').strip().split()
    require(checksum == [expected, 'dist.tar.gz'] and
            prepare.digest_file(directory / 'dist.tar.gz') == expected, 'artifact checksum mismatch')
    prepare.check_ci(manifest.get('ci'), revision)
    prepare.check_build(manifest.get('buildInfo'), revision)
    names, total, info, has_index = set(), 0, None, False
    require((directory / 'dist.tar.gz').stat().st_size <= 256 * 1024 * 1024, 'archive too large')
    with tarfile.open(directory / 'dist.tar.gz', 'r|gz') as archive:
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
            total += item.size
            require(len(names) <= 20000 and total <= 512 * 1024 * 1024 and
                    item.size <= 25 * 1024 * 1024, 'archive exceeds safety limits')
            if key == 'index.html':
                has_index = item.isfile()
            if key == 'build-info.json':
                require(item.isfile() and item.size <= 256 * 1024, 'invalid build-info')
                info = json.load(archive.extractfile(item))
    require(has_index and info == manifest['buildInfo'], 'archive contents do not match manifest')
    print('Verified release candidate for', revision, 'SHA256', expected)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 3:
            raise ValueError('usage: verify-release-artifact.py DIRECTORY REVISION')
        verify(Path(sys.argv[1]), sys.argv[2])
    except Exception as error:
        print(type(error).__name__ + ': ' + str(error), file=sys.stderr)
        raise SystemExit(1)
