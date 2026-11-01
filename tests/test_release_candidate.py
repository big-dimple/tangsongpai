"""Check the release candidate verifier against real archive bytes."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('verifier', Path(__file__).resolve().parents[1] / 'scripts/verify-release-artifact.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)


class CandidateTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.revision = 'a' * 40
        self.info = {'revision': self.revision, 'version': 'test', 'builtAt': 'now', 'sourceStatus': 'clean', 'modified': False}
        snapshot = {'head': self.revision, 'source': 'b' * 64, 'index': 'c' * 64, 'branch': None}
        self.ci = {'scope': 'all', 'testedCommit': self.revision, 'status': 'PASS', 'exitCode': 0,
                   'before': snapshot, 'after': snapshot.copy(),
                   'steps': [{'name': name, 'status': 'PASS', 'childExitCode': 0}
                             for name in ['test', 'verify:content', 'build', 'verify:smoke']]}

    def package(self, extra=None):
        archive = self.root / 'dist.tar.gz'
        with tarfile.open(archive, 'w:gz') as out:
            for name, content in [('index.html', b'game'), ('build-info.json', json.dumps(self.info).encode())]:
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                out.addfile(entry, io.BytesIO(content))
            if extra:
                out.addfile(extra, io.BytesIO(b'x') if extra.isfile() else None)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (self.root / 'dist.tar.gz.sha256').write_text(digest + '  dist.tar.gz\n')
        manifest = {'schemaVersion': 1, 'sourceRevision': self.revision,
                    'artifact': {'name': 'dist.tar.gz', 'sha256': digest},
                    'buildInfo': self.info, 'ci': self.ci}
        (self.root / 'manifest.json').write_text(json.dumps(manifest))

    def test_valid_package(self):
        self.package()
        verifier.verify(self.root, self.revision)

    def test_rejects_corrupted_archive(self):
        self.package()
        with (self.root / 'dist.tar.gz').open('ab') as out:
            out.write(b'changed')
        with self.assertRaisesRegex(ValueError, 'checksum'):
            verifier.verify(self.root, self.revision)

    def test_rejects_unsafe_path(self):
        entry = tarfile.TarInfo('../outside')
        entry.size = 1
        self.package(entry)
        with self.assertRaisesRegex(ValueError, 'unsafe archive path'):
            verifier.verify(self.root, self.revision)

    def test_rejects_symlink(self):
        entry = tarfile.TarInfo('outside')
        entry.type = tarfile.SYMTYPE
        entry.linkname = '../outside'
        self.package(entry)
        with self.assertRaisesRegex(ValueError, 'links or special'):
            verifier.verify(self.root, self.revision)

    def test_rejects_wrong_or_failed_ci(self):
        self.ci['steps'][0]['status'] = 'FAIL'
        self.package()
        with self.assertRaisesRegex(ValueError, 'CI steps'):
            verifier.verify(self.root, self.revision)
        with self.assertRaisesRegex(ValueError, 'revision/schema'):
            verifier.verify(self.root, 'd' * 40)


if __name__ == '__main__':
    unittest.main()
