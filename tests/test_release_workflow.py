"""Protect the download retry boundary without requiring GitHub credentials."""
import os
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
ACTION = (ROOT / '.github/actions/download-release-candidate/action.yml').read_text()
WORKFLOW = (ROOT / '.github/workflows/release-candidate.yml').read_text()


class ReleaseWorkflowTest(unittest.TestCase):
    def test_empty_or_multiple_ids_cannot_download_unrelated_artifacts(self):
        match = re.search(r'      run: \|\n((?:        .+\n)+)', ACTION)
        self.assertIsNotNone(match)
        script = '\n'.join(line[8:] for line in match.group(1).splitlines())
        for artifact_id, expected in [('', False), ('0', False), ('123,456', False),
                                      ('123x', False), ('123', True)]:
            with self.subTest(artifact_id=artifact_id):
                result = subprocess.run(['bash', '-e', '-c', script],
                                        env={**os.environ, 'ARTIFACT_ID': artifact_id},
                                        capture_output=True, text=True)
                self.assertEqual(result.returncode == 0, expected, result.stderr)

    def test_retries_are_bounded_isolated_and_fail_closed(self):
        attempts = re.split(r'    - id: attempt_[123]\n', ACTION)
        self.assertEqual(len(attempts), 4)
        for n, step in enumerate(attempts[1:], 1):
            self.assertIn('uses: actions/download-artifact@v4', step)
            self.assertIn('artifact-ids: ${{ inputs.artifact-id }}', step)
            self.assertIn(f'path: ${{{{ inputs.path }}}}/attempt-{n}', step)
            self.assertIn('merge-multiple: true', step)
        self.assertIn('continue-on-error: true', attempts[1])
        self.assertIn('continue-on-error: true', attempts[2])
        self.assertNotIn('continue-on-error', attempts[3])
        self.assertIn("steps.attempt_1.outcome == 'failure' && steps.attempt_2.outcome == 'failure'", attempts[3])
        for n in range(1, 4):
            self.assertIn(f"steps.attempt_{n}.outcome == 'success'", ACTION)

    def test_candidate_and_publish_both_verify_the_uploaded_id(self):
        self.assertIn('release-candidate-${{ github.sha }}-${{ github.run_id }}-${{ github.run_attempt }}', WORKFLOW)
        self.assertIn('artifact-id: ${{ steps.upload_candidate.outputs.artifact-id }}', WORKFLOW)
        self.assertIn('artifact-id: ${{ needs.candidate.outputs.artifact-id }}', WORKFLOW)
        self.assertEqual(WORKFLOW.count('uses: ./.github/actions/download-release-candidate'), 2)
        self.assertIn('verify-release-artifact.py "$CANDIDATE_DIRECTORY" "$GITHUB_SHA"', WORKFLOW)
        self.assertIn('publish-release.py "$CANDIDATE_DIRECTORY" "$GITHUB_REPOSITORY" "$GITHUB_SHA"', WORKFLOW)


if __name__ == '__main__':
    unittest.main()
