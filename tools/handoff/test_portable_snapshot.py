"""Small temporary Git fixtures only; no repository asset traversal."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import portable_snapshot as snapshot


class PortableTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'repo'
        self.root.mkdir()
        self.git('init', '-q')
        self.write('.gitignore', 'ignored.txt\nwork/\n')
        self.write('tracked.txt', 'committed version')
        self.git('add', '.')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture')
        self.write('tracked.txt', 'local edit')
        self.write('untracked 한글.txt', 'new local file')
        self.write('.env', 'do not export')
        self.write('.env.example', 'SERVICE_KEY=replace-me')
        self.write('ignored.txt', 'ignored')
        self.write('work/local.txt', 'cache')
        self.write('tools/integration/session.mjs', 'export const session = {};')
        self.write('runtime/state.ts', 'export const state = {};')
        self.write('auth/login.py', '# ordinary project implementation')
        self.write('sessions/README.md', 'Project session protocol')
        self.write('tokens.json', 'not exported')

    def git(self, *args):
        subprocess.run(['git', '-C', str(self.root), *args], check=True,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')

    def test_default_does_not_read_content_or_write(self):
        with patch.object(snapshot, 'copy_file', side_effect=AssertionError('copy called')):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(snapshot.main(['--workspace', str(self.root)]), 0)
        self.assertEqual(json.loads(output.getvalue())['mode'], 'metadata-only')
        self.assertFalse((self.root / 'outputs').exists())

    def test_export_hashes_and_multiple_workspaces(self):
        second = Path(self.temp.name) / 'second'
        subprocess.run(['git', 'worktree', 'add', '--detach', str(second)], cwd=self.root,
                       check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        destination = self.root / 'outputs/handoff/usage-portable-test'
        result = snapshot.export([self.root, second], destination)
        self.assertEqual(result['status'], 'COMPLETE', result['warnings'])
        with zipfile.ZipFile(destination / 'project-files.zip') as archive:
            self.assertEqual(archive.read('workspace-001/tracked.txt'), b'local edit')
            self.assertEqual(archive.read('workspace-002/tracked.txt'), b'committed version')
            self.assertIn('workspace-001/.env.example', archive.namelist())
            for implementation in ('tools/integration/session.mjs', 'runtime/state.ts', 'auth/login.py', 'sessions/README.md'):
                self.assertIn('workspace-001/' + implementation, archive.namelist())
            for blocked in ('.env', 'ignored.txt', 'work/local.txt', 'tokens.json'):
                self.assertNotIn('workspace-001/' + blocked, archive.namelist())
            for entry in result['files']:
                data = archive.read(entry['path'])
                self.assertEqual(entry['sha256'], hashlib.sha256(data).hexdigest())
                self.assertEqual(entry['bytes'], len(data))
        info = result['archive']
        self.assertEqual(hashlib.sha256((destination / info['path']).read_bytes()).hexdigest(), info['sha256'])
        self.assertTrue(result['selectedSubset'])
        verified = snapshot.verify(destination / 'manifest.json')
        self.assertEqual(verified['status'], 'VERIFIED')
        self.assertEqual(verified['verified_files'], len(result['files']))

    def test_verification_rejects_archive_and_member_mismatch(self):
        destination = self.root / 'outputs/handoff/usage-portable-verify'
        result = snapshot.export([self.root], destination)
        manifest_path = destination / 'manifest.json'
        result['files'][0]['sha256'] = '0' * 64
        manifest_path.write_text(json.dumps(result), encoding='utf-8')
        with self.assertRaisesRegex(RuntimeError, 'member SHA-256'):
            snapshot.verify(manifest_path)
        result['archive']['sha256'] = '0' * 64
        manifest_path.write_text(json.dumps(result), encoding='utf-8')
        with contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(snapshot.main(['--verify', str(manifest_path)]), 2)
        self.assertEqual(json.loads(output.getvalue())['status'], 'VERIFICATION_FAILED')

    def test_live_change_is_incomplete(self):
        original = snapshot.copy_file
        def changing(*args):
            value = original(*args)
            self.write('new-after-selection.txt', 'live edit')
            return value
        with patch.object(snapshot, 'copy_file', side_effect=changing):
            result = snapshot.export([self.root], self.root / 'outputs/handoff/usage-portable-live')
        self.assertEqual(result['status'], 'INCOMPLETE')
        self.assertNotIn('archive', result)

    def test_secret_content_and_lfs_are_incomplete(self):
        self.write('notes.txt', 'Bearer ' + 'a' * 40)
        result = snapshot.export([self.root], self.root / 'outputs/handoff/usage-portable-secret')
        self.assertEqual(result['status'], 'INCOMPLETE')
        self.assertNotIn('a' * 40, json.dumps(result))
        (self.root / 'notes.txt').unlink()
        self.write('asset.glb', 'version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n')
        result = snapshot.export([self.root], self.root / 'outputs/handoff/usage-portable-lfs')
        self.assertEqual(result['status'], 'INCOMPLETE')

    def test_change_before_copy_is_incomplete(self):
        original = snapshot.copy_file
        def changing(root, rel, expected, archive, member):
            self.write(rel, 'changed after inventory')
            return original(root, rel, expected, archive, member)
        with patch.object(snapshot, 'copy_file', side_effect=changing):
            result = snapshot.export([self.root], self.root / 'outputs/handoff/usage-portable-race')
        self.assertEqual(result['status'], 'INCOMPLETE')


if __name__ == '__main__':
    unittest.main()
