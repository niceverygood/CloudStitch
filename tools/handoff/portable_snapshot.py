#!/usr/bin/env python3
"""Local, read-only source selection; explicit ZIP export. Python 3.10+."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import zipfile

BLOCK_DIRS = {'.git', '.codex', '.ssh', '.aws', '.azure', '.config', '.cache',
              'work', 'node_modules', '__pycache__', '.venv', 'venv', 'cache',
              'caches', 'browser-profile',
              'credentials', 'secrets', 'tokens', '.tokens', '.credentials', '.auth',
              '.next', '.npm', '.vercel', '.supabase',
              '.local', '.kube', '.gcloud', '.docker', '.gnupg', 'appdata'}
SECRET_NAME = re.compile(r'(^|[._-])(secret|secrets|credential|credentials|token|tokens|keys?|api[._-]?key|private[._-]?key|auth|cookies?|session|runtime|state)([._-]|$)', re.I)
SOURCE_SUFFIXES = {'.js', '.mjs', '.cjs', '.ts', '.tsx', '.py', '.html', '.css', '.md', '.txt'}
SELECTION = {'selectedSubset': True,
             'scope': 'current tracked and nonignored untracked files after exclusions',
             'completeMeans': 'selected files copied consistently; not entire project/account/chat completeness'}
SECRET_BYTES = re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b|(?:https?://)[^\s/:]{1,100}:[^\s/@]{1,100}@|\bBearer[ \t]+[A-Za-z0-9._~-]{24,}')


def exclusion(rel):
    """Conservative filename policy; never a complete secret detector."""
    parts = PurePosixPath(rel).parts
    low = [p.lower() for p in parts]
    if any(p in ('', '.', '..') for p in parts) or PurePosixPath(rel).is_absolute() or ':' in rel or '\\' in rel:
        return 'unsafe-path'
    if any(p in BLOCK_DIRS or p.startswith('.env') for p in low[:-1]):
        return 'local-or-account-directory'
    if len(low) >= 3 and low[:2] == ['outputs', 'handoff'] and low[2].startswith('usage-portable-'):
        return 'previous-snapshot'
    name = low[-1]
    if name.endswith(('.zip', '.tar', '.tar.gz', '.tgz', '.bundle', '.pyc', '.pfx', '.p12', '.pem', '.key', '.sqlite', '.sqlite3', '.db')):
        return 'archive-key-or-local-database'
    if name in ('.npmrc', '.netrc', '_netrc', '.pypirc', '.git-credentials', 'id_rsa', 'id_ed25519'):
        return 'credential-file'
    template = name.endswith(('.example', '.sample', '.template'))
    if name.startswith('.env'):
        return None if template else 'credential-or-local-state-name'
    if SECRET_NAME.search(name) and not template and PurePosixPath(name).suffix not in SOURCE_SUFFIXES:
        return 'credential-or-local-state-name'
    return None


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise RuntimeError('Git inspection failed (repository must be available locally).')
    return result.stdout


def signature(path):
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or path.is_symlink() or getattr(s, 'st_file_attributes', 0) & 0x400:
        raise ValueError('not-regular-or-reparse-file')
    return stat_signature(s)


def stat_signature(s):
    return (s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_dev, s.st_ino)


def descriptor_matches(src, expected):
    current = stat_signature(os.fstat(src.fileno()))
    # Windows reports different ctime semantics through fstat and lstat.
    return current[:2] + current[3:] == expected[:2] + expected[3:]


def inspect(root, label):
    if git(root, 'rev-parse', '--show-prefix').strip():
        raise RuntimeError('--workspace must identify a Git worktree root.')
    raw = git(root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard')
    paths = sorted(set(os.fsdecode(p) for p in raw.split(b'\0') if p))
    files, excluded, warnings = {}, [], []
    for rel in paths:
        reason = exclusion(rel)
        p = root / rel
        if not reason:
            try:
                if not p.resolve().is_relative_to(root):
                    reason = 'outside-workspace'
                elif any((root.joinpath(*PurePosixPath(rel).parts[:i])).is_symlink()
                         for i in range(1, len(PurePosixPath(rel).parts))):
                    reason = 'symlink-parent'
                else:
                    files[rel] = signature(p)
            except FileNotFoundError:
                reason = 'deleted-or-missing'
            except (ValueError, OSError):
                reason = 'unreadable-or-nonregular'
                warnings.append({'path': rel, 'reason': reason})
        if reason:
            excluded.append({'path': rel, 'reason': reason})
    try:
        head = git(root, 'rev-parse', '--verify', 'HEAD').decode().strip()
    except RuntimeError:
        head = None  # A new, uncommitted repository is still exportable.
    return {'workspace': label, 'head': head, 'selected_count': len(files),
            'selected_bytes': sum(s[0] for s in files.values()),
            'excluded': excluded, 'warnings': warnings}, files


def copy_file(root, rel, expected, archive, member):
    path = root / rel
    if signature(path) != expected:
        raise RuntimeError('changed-before-copy')
    digest, size, tail = hashlib.sha256(), 0, b''
    pointer = b''
    with path.open('rb') as src:
        if not descriptor_matches(src, expected):
            raise RuntimeError('file-replaced-before-read')
        with archive.open(member, 'w', force_zip64=True) as dest:
            for chunk in iter(lambda: src.read(1024 * 1024), b''):
                if SECRET_BYTES.search(tail + chunk):
                    raise RuntimeError('possible-secret-content; do not distribute this partial archive')
                tail = chunk[-512:]
                if size == 0:
                    pointer = chunk[:128]
                digest.update(chunk)
                size += len(chunk)
                dest.write(chunk)
        if not descriptor_matches(src, expected):
            raise RuntimeError('changed-open-file')
    if signature(path) != expected or size != expected[0]:
        raise RuntimeError('changed-during-copy')
    return {'path': member, 'bytes': size, 'sha256': digest.hexdigest(),
            'lfs_pointer': pointer.startswith(b'version https://git-lfs.github.com/spec/v1')}


def export(roots, destination):
    destination.mkdir(parents=True, exist_ok=False)
    report = {'format': 'cloudstitch-portable-v1', 'mode': 'export',
              **SELECTION,
              'created_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
              'status': 'INCOMPLETE', 'workspaces': [], 'files': [], 'warnings': []}
    partial = destination / 'project-files.PARTIAL.zip'
    plans = []
    try:
        for index, root in enumerate(roots, 1):
            label = f'workspace-{index:03d}'
            meta, files = inspect(root, label)
            report['workspaces'].append(meta)
            plans.append((root, label, files))
        with zipfile.ZipFile(partial, 'w', compression=zipfile.ZIP_STORED, allowZip64=True) as archive:
            for root, label, files in plans:
                for rel, expected in files.items():
                    report['files'].append(copy_file(root, rel, expected, archive, f'{label}/{rel}'))
        for root, label, before in plans:
            after_meta, after = inspect(root, label)
            if before != after or after_meta['head'] != next(m['head'] for m in report['workspaces'] if m['workspace'] == label):
                report['warnings'].append(f'{label}: live workspace changed; export is incomplete')
        if any(m['warnings'] for m in report['workspaces']):
            report['warnings'].append('Some selected files could not be inspected.')
        if any(f['lfs_pointer'] for f in report['files']):
            report['warnings'].append('Git LFS pointers found: actual assets are missing; export is incomplete.')
        if not report['warnings']:
            final = destination / 'project-files.zip'
            partial.rename(final)
            digest = hashlib.sha256()
            with final.open('rb') as source:
                for chunk in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(chunk)
            report['archive'] = {'path': final.name, 'bytes': final.stat().st_size, 'sha256': digest.hexdigest()}
            report['status'] = 'COMPLETE'
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile) as exc:
        # Exception messages are controlled above or reduced to type to avoid paths/credentials.
        report['warnings'].append(str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__)
    (destination / 'manifest.json').write_text(json.dumps(report, ensure_ascii=True, indent=2) + '\n', encoding='utf-8')
    return report


def hash_stream(source):
    digest, size = hashlib.sha256(), 0
    for chunk in iter(lambda: source.read(1024 * 1024), b''):
        digest.update(chunk)
        size += len(chunk)
    return size, digest.hexdigest()


def verify(manifest_path):
    """Read only: validate the ZIP bytes and every member without extracting."""
    manifest_path = manifest_path.resolve()
    report = json.loads(manifest_path.read_text(encoding='utf-8'))
    if report.get('format') != 'cloudstitch-portable-v1' or report.get('status') != 'COMPLETE':
        raise RuntimeError('Manifest is not a COMPLETE portable snapshot.')
    archive_info = report['archive']
    if archive_info['path'] != 'project-files.zip':
        raise RuntimeError('Unexpected archive filename.')
    archive_path = manifest_path.parent / archive_info['path']
    expected = report['files']
    entries = {e['path']: e for e in expected}
    if len(entries) != len(expected):
        raise RuntimeError('Duplicate manifest member paths.')
    for name in entries:
        parts = PurePosixPath(name).parts
        if len(parts) < 2 or not re.fullmatch(r'workspace-[0-9]{3,}', parts[0]) or exclusion('/'.join(parts[1:])):
            raise RuntimeError('Unsafe or excluded member path in manifest.')
    with archive_path.open('rb') as source:
        before = stat_signature(os.fstat(source.fileno()))
        if hash_stream(source) != (archive_info['bytes'], archive_info['sha256']):
            raise RuntimeError('Archive SHA-256 or size mismatch.')
        source.seek(0)
        with zipfile.ZipFile(source) as archive:
            if sorted(archive.namelist()) != sorted(entries):
                raise RuntimeError('ZIP member inventory mismatch.')
            for name, entry in entries.items():
                with archive.open(name) as member:
                    if hash_stream(member) != (entry['bytes'], entry['sha256']):
                        raise RuntimeError('ZIP member SHA-256 or size mismatch.')
        if stat_signature(os.fstat(source.fileno())) != before:
            raise RuntimeError('Archive changed during verification.')
    return {'status': 'VERIFIED', **SELECTION, 'verified_files': len(entries),
            'meaning': 'ZIP and listed members match manifest; manifest authenticity is not verified'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', action='append', type=Path,
                        help='Git worktree root; repeat to include separate worktrees (default: current directory)')
    parser.add_argument('--export', action='store_true', help='Explicitly copy selected files and hash them into a new ZIP')
    parser.add_argument('--verify', type=Path, metavar='MANIFEST', help='Read-only ZIP and member hash verification; no Git required')
    args = parser.parse_args(argv)
    if args.verify:
        if args.export or args.workspace:
            parser.error('--verify cannot be combined with --export or --workspace.')
        try:
            result = verify(args.verify)
            print(json.dumps(result, ensure_ascii=True, indent=2))
            return 0
        except (OSError, RuntimeError, ValueError, KeyError, TypeError, zipfile.BadZipFile, EOFError) as exc:
            print(json.dumps({'status': 'VERIFICATION_FAILED', 'reason': str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__}))
            return 2
    roots = [p.resolve() for p in (args.workspace or [Path.cwd()])]
    if len(roots) != len(set(roots)):
        parser.error('Duplicate workspace roots are not allowed.')
    if args.export:
        stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
        destination = roots[0] / 'outputs' / 'handoff' / f'usage-portable-{stamp}'
        report = export(roots, destination)
        print(json.dumps({'status': report['status'], 'output': str(destination.relative_to(roots[0])),
                          'warnings': report['warnings']}, ensure_ascii=True, indent=2))
        return 0 if report['status'] == 'COMPLETE' else 2
    report = {'format': 'cloudstitch-portable-v1', 'mode': 'metadata-only',
              **SELECTION,
              'content_read': False, 'files_written': False, 'workspaces': []}
    try:
        for index, root in enumerate(roots, 1):
            metadata, _ = inspect(root, f'workspace-{index:03d}')
            report['workspaces'].append(metadata)
    except (OSError, RuntimeError) as exc:
        print(str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__, file=sys.stderr)
        return 2
    print(json.dumps(report, ensure_ascii=True, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
