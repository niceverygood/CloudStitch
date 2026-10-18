"""Verify that every committed visual asset has been restored by Git LFS."""
from pathlib import Path
import argparse
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'docs' / 'asset-inventory.json'


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def create_inventory():
    assets = []
    for path in sorted((ROOT / 'outputs').rglob('*')):
        if path.is_file() and path.suffix.lower() in ('.png', '.glb', '.webm') and 'meshy_output' not in path.parts:
            assets.append({'path': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size, 'sha256': digest(path)})
    result = {'project': 'Cloudstitch', 'asset_count': len(assets), 'total_bytes': sum(x['bytes'] for x in assets), 'assets': assets}
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'inventory': str(MANIFEST.relative_to(ROOT)), 'asset_count': result['asset_count'], 'total_bytes': result['total_bytes']}))


def verify_inventory():
    result = json.loads(MANIFEST.read_text(encoding='utf-8'))
    missing, pointers, mismatched = [], [], []
    for asset in result['assets']:
        path = ROOT / asset['path']
        if not path.is_file():
            missing.append(asset['path'])
            continue
        with path.open('rb') as stream:
            if stream.read(64).startswith(b'version https://git-lfs.github.com/spec/v1'):
                pointers.append(asset['path'])
                continue
        if path.stat().st_size != asset['bytes'] or digest(path) != asset['sha256']:
            mismatched.append(asset['path'])
    passed = not (missing or pointers or mismatched)
    print(json.dumps({'passed': passed, 'asset_count': result['asset_count'], 'missing': missing, 'lfs_pointers': pointers, 'mismatched': mismatched}, ensure_ascii=True, indent=2))
    if pointers:
        print('Run git lfs install and git lfs pull, then verify again.', file=sys.stderr)
    return 0 if passed else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true', help='Regenerate the inventory after deliberately changing asset files.')
    args = parser.parse_args()
    if args.write:
        create_inventory()
    else:
        raise SystemExit(verify_inventory())
