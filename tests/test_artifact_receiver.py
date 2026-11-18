"""Exercise the server decision path without contacting or changing production."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'artifact_receiver', Path(__file__).resolve().parents[1] / 'scripts/tangsongpai-artifact-deploy.py')
receiver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receiver)

REVISION = 'a' * 40
PREVIOUS = 'b' * 40
TAG = 'v' + REVISION
PREVIEW = 'https://preview.dachoupai.pages.dev'
ROLLBACK_ID = 'd2d41220-017d-4e86-bcf3-acdf03049da5'


class ArtifactReceiverTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.state = Path(directory.name)
        for name, value in [('STATE', self.state), ('LOG', self.state / 'deploy.log')]:
            replacement = patch.object(receiver, name, value)
            replacement.start()
            self.addCleanup(replacement.stop)

    def release(self, **changes):
        return {'tag_name': TAG, 'draft': False, 'prerelease': False,
                'assets': [{'name': name, 'state': 'uploaded', 'size': 1} for name in receiver.ASSETS],
                **changes}

    def test_release_lookup_uses_only_the_exact_published_tag(self):
        tag = {'object': {'type': 'commit', 'sha': REVISION}}
        with patch.object(receiver, 'command', side_effect=map(json.dumps, [self.release(), tag])) as command:
            self.assertEqual(receiver.release_for(REVISION), TAG)
            self.assertTrue(command.call_args_list[0].args[0][-1].endswith('/releases/tags/' + TAG))
        missing = subprocess.CalledProcessError(1, ['gh'], stderr='gh: Not Found (HTTP 404)')
        with patch.object(receiver, 'command', side_effect=missing) as command:
            self.assertIsNone(receiver.release_for(REVISION))
            command.assert_called_once()
        with patch.object(receiver, 'command', return_value=json.dumps(self.release(draft=True))):
            self.assertIsNone(receiver.release_for(REVISION))

    def test_rejects_incomplete_release_and_retargeted_tag(self):
        broken = self.release()
        broken['assets'][0]['state'] = 'new'
        with patch.object(receiver, 'command', return_value=json.dumps(broken)):
            with self.assertRaisesRegex(ValueError, 'incomplete'):
                receiver.release_for(REVISION)
        tag = {'object': {'type': 'commit', 'sha': PREVIOUS}}
        with patch.object(receiver, 'command', side_effect=map(json.dumps, [self.release(), tag])):
            with self.assertRaisesRegex(ValueError, 'tag does not point to main'):
                receiver.release_for(REVISION)

    def download(self, args, **_):
        self.assertEqual(args[:4], ['gh', 'release', 'download', TAG])
        directory = Path(args[args.index('--dir') + 1])
        for name in receiver.ASSETS:
            (directory / name).write_text('test')

    def test_failed_validation_cannot_call_pages(self):
        with patch.object(receiver, 'command', side_effect=self.download) as command, \
                patch.object(receiver.verifier, 'verify', side_effect=ValueError('checksum')), \
                patch.object(receiver, 'pages') as pages:
            with self.assertRaisesRegex(ValueError, 'checksum'):
                receiver.receive(REVISION, TAG)
            command.assert_called_once()
            pages.assert_not_called()
        self.assertFalse((self.state / 'artifact-pending.json').exists())

    def test_verified_artifact_is_skipped_if_main_moves_before_upload(self):
        with patch.object(receiver, 'command', side_effect=self.download) as command, \
                patch.object(receiver.verifier, 'verify') as verify, \
                patch.object(receiver, 'main_revision', return_value=PREVIOUS), \
                patch.object(receiver, 'pages') as pages:
            receiver.receive(REVISION, TAG)
            self.assertEqual(verify.call_args.args[1], REVISION)
            self.assertEqual(verify.call_args.kwargs['destination'].name, 'dist')
            command.assert_called_once()
            pages.assert_not_called()

    def write_pending(self, *, age=30):
        pending = {'revision': REVISION, 'url': PREVIEW, 'directory': str(self.state / 'retained'),
                   'createdAt': 1000 - age, 'previous': ROLLBACK_ID}
        (self.state / 'artifact-pending.json').write_text(json.dumps(pending))

    def test_state_waits_for_public_confirmation(self):
        (self.state / 'artifacts').mkdir()
        self.write_pending()
        with patch.object(receiver.time, 'time', return_value=1000), \
                patch.object(receiver, 'health', return_value=False):
            self.assertFalse(receiver.settle_pending(REVISION))
        self.assertTrue((self.state / 'artifact-pending.json').exists())
        self.assertFalse((self.state / 'deployed-revision').exists())
        with patch.object(receiver, 'health', return_value=True) as health:
            self.assertTrue(receiver.settle_pending(REVISION))
            health.assert_called_once_with(receiver.PUBLIC_URL, REVISION)
        self.assertEqual((self.state / 'deployed-revision').read_text().strip(), REVISION)
        self.assertFalse((self.state / 'artifact-pending.json').exists())

    def test_only_the_matching_unhealthy_deployment_is_rolled_back(self):
        for url, should_rollback in [(PREVIEW, True), ('https://newer.dachoupai.pages.dev', False)]:
            with self.subTest(url=url):
                self.write_pending(age=650)
                canonical = {'canonical_deployment': {'id': 'running', 'url': url}}
                with patch.object(receiver.time, 'time', return_value=1000), \
                        patch.object(receiver, 'health', return_value=False), \
                        patch.object(receiver, 'pages', return_value=canonical) as pages:
                    with self.assertRaisesRegex(ValueError, 'health check failed'):
                        receiver.settle_pending(REVISION)
                    self.assertEqual(pages.call_count, 2 if should_rollback else 1)
                    if should_rollback:
                        self.assertEqual(pages.call_args.args, (f'/deployments/{ROLLBACK_ID}/rollback', 'POST'))
                self.assertFalse((self.state / 'deployed-revision').exists())


if __name__ == '__main__':
    unittest.main()
