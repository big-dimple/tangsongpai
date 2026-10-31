"""Exercise release orchestration without calling GitHub."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import unittest
from unittest import mock
from test_release_candidate import CandidateTest

spec = importlib.util.spec_from_file_location('publisher', Path(__file__).resolve().parents[1] / 'scripts/publish-release.py')
publisher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(publisher)


class FakeGitHub:
    def __init__(self, directory, revision):
        self.directory, self.revision = directory, revision
        self.tag = 'v' + revision
        self.release = None
        self.events = []
        self.moved_after = 999
        self.checks = 0
        self.corrupt = False
        self.tag_sha = revision

    def data(self, *args):
        endpoint = args[1]
        if '/git/ref/heads/main' in endpoint:
            self.checks += 1
            return {'object': {'sha': self.revision if self.checks <= self.moved_after else 'b' * 40}}
        if '/git/ref/tags/' in endpoint:
            if self.tag_sha is None:
                raise subprocess.CalledProcessError(1, args, stderr='HTTP 404')
            return {'object': {'type': 'commit', 'sha': self.tag_sha}}
        if endpoint.endswith('releases?per_page=100'):
            return [[self.release] if self.release else []]
        if endpoint.endswith('releases/latest'):
            return self.release
        raise AssertionError(args)

    def run(self, *args):
        self.events.append(args[:2])
        if args[:2] == ('api', '--method'):
            self.tag_sha = self.revision
        elif args[:2] == ('release', 'create'):
            self.release = {'tag_name': self.tag, 'draft': True, 'prerelease': False,
                            'assets': [{'name': x, 'state': 'uploaded'} for x in publisher.ASSETS]}
        elif args[:2] == ('release', 'download'):
            dest = Path(args[args.index('--dir') + 1])
            for name in publisher.ASSETS:
                shutil.copyfile(self.directory / name, dest / name)
            if self.corrupt:
                with (dest / 'dist.tar.gz').open('ab') as f:
                    f.write(b'bad')
        elif args[:2] == ('release', 'edit'):
            self.release['draft'] = False
        else:
            raise AssertionError(args)
        return ''


class PublishTest(unittest.TestCase):
    def setUp(self):
        fixture = CandidateTest('test_valid_package')
        fixture.setUp()
        self.addCleanup(fixture.temp.cleanup)
        fixture.package()
        self.root, self.revision = fixture.root, fixture.revision
        self.github = FakeGitHub(self.root, self.revision)
        self.addCleanup(mock.patch.stopall)
        mock.patch.object(publisher, 'gh', side_effect=self.github.run).start()
        mock.patch.object(publisher, 'gh_json', side_effect=self.github.data).start()

    def publish(self):
        publisher.publish(self.root, 'owner/repo', self.revision)

    def test_publish_only_after_verified_download(self):
        self.publish()
        self.assertEqual(self.github.events, [('release', 'create'), ('release', 'download'), ('release', 'edit')])
        self.assertFalse(self.github.release['draft'])

    def test_corrupt_download_never_publishes(self):
        self.github.corrupt = True
        with self.assertRaisesRegex(ValueError, 'differs from candidate'):
            self.publish()
        self.assertTrue(self.github.release['draft'])
        self.assertNotIn(('release', 'edit'), self.github.events)

    def test_moved_main_never_publishes(self):
        self.github.moved_after = 1
        with self.assertRaisesRegex(ValueError, 'main moved'):
            self.publish()
        self.assertTrue(self.github.release['draft'])
        self.assertNotIn(('release', 'edit'), self.github.events)

    def test_wrong_tag_never_creates_release(self):
        self.github.tag_sha = 'b' * 40
        with self.assertRaisesRegex(ValueError, 'tag'):
            self.publish()
        self.assertEqual(self.github.events, [])

    def test_missing_tag_is_created_for_exact_revision(self):
        self.github.tag_sha = None
        self.publish()
        self.assertEqual(self.github.events[0], ('api', '--method'))
        self.assertEqual(self.github.tag_sha, self.revision)

    def test_published_or_incomplete_release_never_modified(self):
        self.github.release = {'tag_name': self.github.tag, 'draft': False, 'prerelease': False, 'assets': []}
        with self.assertRaisesRegex(ValueError, 'draft full release'):
            self.publish()
        self.github.release['draft'] = True
        with self.assertRaisesRegex(ValueError, 'exactly the three'):
            self.publish()
        self.assertEqual(self.github.events, [])

    def test_complete_matching_draft_can_resume(self):
        self.github.run('release', 'create')
        self.github.events.clear()
        self.publish()
        self.assertEqual(self.github.events, [('release', 'download'), ('release', 'edit')])


if __name__ == '__main__':
    unittest.main()
