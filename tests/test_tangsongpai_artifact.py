"""Run on a development computer: python -m unittest discover -s tests -p 'test_tangsongpai_artifact.py'."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest import mock

spec = importlib.util.spec_from_file_location('receiver', Path(__file__).resolve().parents[1] / 'scripts/tangsongpai-artifact-deploy.py')
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)


class ArtifactTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sha = 'a' * 40
        self.info = {'revision': self.sha, 'version': 'test', 'builtAt': 'now', 'sourceStatus': 'clean', 'modified': False}
        snapshot = {'head': self.sha, 'source': 'b' * 64, 'index': 'c' * 64, 'branch': 'refs/heads/main'}
        self.ci = {'scope': 'all', 'testedCommit': self.sha, 'status': 'PASS', 'exitCode': 0,
                   'before': snapshot, 'after': snapshot.copy(),
                   'steps': [{'name': name, 'status': 'PASS', 'childExitCode': 0}
                             for name in ['test', 'verify:content', 'build', 'verify:smoke']]}

    def make_package(self, extra=None):
        download = self.root / 'download'
        download.mkdir()
        archive = download / 'dist.tar.gz'
        with tarfile.open(archive, 'w:gz') as out:
            for name, content in [('index.html', b'game'), ('build-info.json', json.dumps(self.info).encode())]:
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                out.addfile(entry, io.BytesIO(content))
            if extra:
                out.addfile(extra, io.BytesIO(b'x') if extra.isfile() else None)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        (download / 'dist.tar.gz.sha256').write_text(digest + '  dist.tar.gz\n')
        manifest = {'schemaVersion': 1, 'sourceRevision': self.sha,
                    'artifact': {'name': 'dist.tar.gz', 'sha256': digest},
                    'buildInfo': self.info, 'ci': self.ci}
        (download / 'manifest.json').write_text(json.dumps(manifest))
        return download

    def test_verified_package_extracts(self):
        receiver.unpack_verified(self.make_package(), self.root / 'dist', self.sha)
        self.assertEqual((self.root / 'dist/index.html').read_text(), 'game')

    def test_rejects_path_traversal(self):
        entry = tarfile.TarInfo('../escaped')
        entry.size = 1
        with self.assertRaises(ValueError):
            receiver.unpack_verified(self.make_package(entry), self.root / 'dist', self.sha)
        self.assertFalse((self.root / 'escaped').exists())

    def test_rejects_symlinks(self):
        entry = tarfile.TarInfo('link')
        entry.type = tarfile.SYMTYPE
        entry.linkname = '../outside'
        with self.assertRaises(ValueError):
            receiver.unpack_verified(self.make_package(entry), self.root / 'dist', self.sha)

    def test_rejects_bad_checksum(self):
        download = self.make_package()
        (download / 'dist.tar.gz.sha256').write_text('d' * 64 + '  dist.tar.gz\n')
        with self.assertRaises(ValueError):
            receiver.unpack_verified(download, self.root / 'dist', self.sha)

    def test_rejects_failed_ci(self):
        self.ci['steps'][0]['status'] = 'FAIL'
        with self.assertRaises(ValueError):
            receiver.unpack_verified(self.make_package(), self.root / 'dist', self.sha)

    def test_explicit_ci_exception_still_checks_the_artifact(self):
        self.ci['steps'][0]['status'] = 'FAIL'
        download = self.make_package()
        with mock.patch.object(receiver, 'log') as log:
            receiver.unpack_verified(download, self.root / 'dist', self.sha, allow_unverified_ci=True)
            self.assertIn('one-time exception', log.call_args.args[0])
        (download / 'dist.tar.gz.sha256').write_text('d' * 64 + '  dist.tar.gz\n')
        with self.assertRaises(ValueError):
            receiver.unpack_verified(download, self.root / 'other', self.sha, allow_unverified_ci=True)

    def test_release_matches_manifest_independently_of_tag_name(self):
        assets = [{'name': name, 'state': 'uploaded', 'size': 100, 'id': i, 'updated_at': 'now'}
                  for i, name in enumerate(receiver.ASSETS, 1)]
        release = {'tag_name': 'custom-release-name', 'draft': False, 'prerelease': False, 'assets': assets}
        calls = []

        def api(args, **kwargs):
            calls.append(args)
            if args[:2] == ['gh', 'release']:
                return json.dumps({'sourceRevision': self.sha})
            if '/releases?' in args[-1]:
                return json.dumps([release])
            return json.dumps({'object': {'type': 'commit', 'sha': self.sha}})

        with mock.patch.object(receiver, 'STATE', self.root), mock.patch.object(receiver, 'command', side_effect=api):
            self.assertEqual(receiver.release_for(self.sha)['tag_name'], 'custom-release-name')
            self.assertEqual(receiver.release_for(self.sha)['tag_name'], 'custom-release-name')
        self.assertEqual(sum(args[:2] == ['gh', 'release'] for args in calls), 1)

    def test_release_rejects_tag_pointing_to_another_commit(self):
        assets = [{'name': name, 'state': 'uploaded', 'size': 100, 'id': i, 'updated_at': 'now'}
                  for i, name in enumerate(receiver.ASSETS, 1)]
        release = {'tag_name': 'custom-release-name', 'draft': False, 'prerelease': False, 'assets': assets}

        def api(args, **kwargs):
            if args[:2] == ['gh', 'release']:
                return json.dumps({'sourceRevision': self.sha})
            if '/releases?' in args[-1]:
                return json.dumps([release])
            return json.dumps({'object': {'type': 'commit', 'sha': 'b' * 40}})

        with mock.patch.object(receiver, 'STATE', self.root), mock.patch.object(receiver, 'command', side_effect=api):
            with self.assertRaises(ValueError):
                receiver.release_for(self.sha)


if __name__ == '__main__':
    unittest.main()
