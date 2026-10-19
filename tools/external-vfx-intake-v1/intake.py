"""Import only PNG artwork and licenses from browser-downloaded CC0 archives."""
import argparse, hashlib, json, shutil, struct, zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[2]
out = root / 'outputs' / 'external-vfx-intake-v1'
work = root / 'work' / 'external-vfx-intake-v1'
parser = argparse.ArgumentParser()
parser.add_argument('--particle', type=Path, required=True)
parser.add_argument('--smoke', type=Path, required=True)
args = parser.parse_args()
out.mkdir(parents=True, exist_ok=True)
work.mkdir(parents=True, exist_ok=True)
records = []
for name, archive, source, prefix in [
    ('kenney-particle-pack', args.particle, 'https://kenney.nl/assets/particle-pack', 'PNG (Transparent)/'),
    ('kenney-smoke-particles', args.smoke, 'https://kenney.nl/assets/smoke-particles', 'PNG/'),
]:
    archive = archive.resolve(strict=True)
    archive_bytes = archive.read_bytes()
    backup = work / archive.name
    if backup.exists() and backup.read_bytes() != archive_bytes:
        raise RuntimeError('Refusing to overwrite an existing archive')
    if not backup.exists():
        shutil.copyfile(archive, backup)
    files = []
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise RuntimeError('ZIP CRC failure')
        for e in z.infolist():
            if e.is_dir():
                continue
            is_art = e.filename.startswith(prefix) and e.filename.lower().endswith('.png')
            is_license = 'license' in Path(e.filename).name.lower() and e.filename.lower().endswith('.txt')
            is_preview = e.filename in ('preview.png', 'sample.png')
            if not (is_art or is_license or is_preview):
                continue
            dest = (out / name / e.filename).resolve()
            if not dest.is_relative_to((out / name).resolve()):
                raise RuntimeError('Unsafe ZIP entry')
            data = z.read(e)
            if dest.exists() and dest.read_bytes() != data:
                raise RuntimeError('Refusing to overwrite existing art')
            dest.parent.mkdir(parents=True, exist_ok=True)
            if not dest.exists():
                dest.write_bytes(data)
            record = {'path': dest.relative_to(root).as_posix(), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'role': 'license' if is_license else 'preview' if is_preview else 'particle-texture'}
            if data.startswith(b'\x89PNG\r\n\x1a\n'):
                width, height = struct.unpack('>II', data[16:24])
                cursor, transparency = 8, data[25] in (4, 6)
                while cursor + 12 <= len(data):
                    length = struct.unpack('>I',data[cursor:cursor+4])[0]
                    kind = data[cursor+4:cursor+8]
                    if kind == b'tRNS':
                        transparency = True
                    cursor += length + 12
                    if kind == b'IEND':
                        break
                record.update(width=width, height=height, pngColorType=data[25], alphaChannel=data[25] in (4,6), transparency=transparency)
            files.append(record)
    licenses = [r for r in files if r['role']=='license']
    if not licenses or 'CC0' not in (root/licenses[0]['path']).read_text(encoding='utf-8-sig', errors='replace').upper():
        raise RuntimeError('Package license not verified')
    records.append({'id':name,'source':source,'license':'CC0-1.0','status':'downloaded-and-inspected','archiveBytes':len(archive_bytes),'archiveSha256':hashlib.sha256(archive_bytes).hexdigest(),'crcPassed':True,'artworkCount':sum(r['role']=='particle-texture' for r in files),'files':files})
manifest = {'revision':'external-vfx-intake-v1','packs':records,'purchasesCompleted':0,'paidCandidate':{'id':'akcl-fx-sprite-pack','source':'https://maxrobertstudios.itch.io/akcl-fx-sprite-pack','merchant':'Max Robert Studios / itch.io','displayedMinimumUSD':6.50,'displayedArchive':'AKCL FXSpritePack V1.0.zip','displayedArchiveSize':'21 MB','formatClaim':'hand drawn PNG animations; explosions/fire loop/smoke/particles','licenseClaim':'Creator page permits modification and commercial projects; credits optional','status':'checkout-open-user-payment-pending','accountOrPaymentDataEntered':False,'animationFileInspectionCompleted':False},'gameplayInstalled':False,'artApproved':False,'existingProjectAssetsChanged':False,'archivesStoredInGitIgnoredWork':True}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
(out/'README.txt').write_text('Cloudstitch · 외부 VFX 수급 1차\n\nKenney Particle Pack: 실제 선택한 PNG (Transparent) 폴더 PNG96개.\nKenney Smoke Particles: 실제 PNG 폴더 PNG77개.\n페이지 표기80/70과 ZIP 실제96/77을 구분합니다. 원본의 파일명·개별 변형을 임의로 애니메이션 프레임으로 판정하지 않았습니다.\nPNG 헤더·팔레트 tRNS 투명도, 원본 라이선스·프리뷰·SHA/ZIP CRC 기록을 함께 보존합니다. 원 ZIP은 work에 복사했고 Downloads 원본은 변경하지 않았습니다.\n이 자료는 입자 재료이며 완성된 폭발/화염 애니메이션으로 집계하지 않습니다. 기존 게임/비교 시연에는 아직 연결하지 않았습니다.\n\nAKCL FX Sprite Pack: 제작자 페이지와 손그림 미리보기를 열람하고 최소 US$6.50/21MB/PNG 구성을 확인했습니다. Chrome의 구매창은 사용자 결제 대기입니다. 이메일·카드정보 입력/결제0. 결제 전 파일별 프레임 수·알파·해상도·연속성은 확인할 수 없어 구매 후 검사해야 합니다. 명시된 폭발·화염·연기는 후보이며 기관총 포구 전용 애니메이션 포함은 아직 미확인입니다.\n\n사용자가 다른 채팅 메시지를 금지한 기존 선호를 유지합니다. 자동화·배포·유료 API·기존 원본 재생성·commit/push0.\n',encoding='utf-8')
print(json.dumps({'packs':[{'id':p['id'],'artworkCount':p['artworkCount'],'crcPassed':p['crcPassed']} for p in records],'paidStatus':manifest['paidCandidate']['status']},ensure_ascii=False))
