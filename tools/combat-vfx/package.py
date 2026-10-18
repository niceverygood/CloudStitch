"""Package checked Cloudstitch combat VFX; never include caches or credentials."""
from pathlib import Path
import hashlib
import json
import os
import tempfile
import zipfile
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'outputs/combat-vfx'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    c=read(BASE/'catalog.json');s=read(BASE/'sequence-catalog.json');v=read(BASE/'verification.json');p=read(BASE/'progress.json')
    assert len(c['items'])==48 and len(s['items'])==6 and p['remaining']==[]
    assert v['standard_validator']['errors']==v['standard_validator']['warnings']==0 and v['browser_effects']['passed'] and v['browser_sequences']['passed'] and v['gallery']['passed']
    files=['README.txt','production-spec.json','recipes.json','catalog.json','sequence-catalog.json','progress.json','delivery-summary.json','verification.json','index.html','attack-sequences.html','gallery.html','overview.png']
    files += ['verification/'+x for x in ['browser-effects.json','gltf-validator.json','sequences.json','gallery.json']]
    for entry in c['items']+s['items']:
        assert entry['status'] in ('completed_mesh_animation_prototype','completed_composed_animation_study')
        manifest='manifests/'+entry['id']+'.json';m=read(BASE/manifest)
        validation=m.get('standard_validator',m.get('verification',{}).get('standard_validator',{}))
        assert digest(BASE/entry['model'])==m['sha256'] and validation['errors']==0 and validation['warnings']==0
        files += [entry['model'],entry['preview'],manifest]
    records=[]
    for name in files:
        file=BASE/name
        assert file.is_file() and file.resolve().is_relative_to(BASE.resolve()) and file.stat().st_size>0
        records.append({'path':name,'bytes':file.stat().st_size,'sha256':digest(file)})
    assert len(set(files))==len(files)
    manifest={'schema_version':1,'game_title':'Cloudstitch','package':'Cloudstitch-combat-vfx.zip','effect_count':48,'sequence_count':6,'GLB_count':54,'entries':records,'verification':{'all_assets_completed':True,'all_model_hashes_match':True,'standard_errors':0,'standard_warnings':0,'archive_entries_hash_checked':True},'manifest_note':'This manifest is included verbatim; its own recursive hash is omitted.'}
    encoded=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
    work=ROOT/'work/combat-vfx-package';work.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work) as tmp:
        archive=Path(tmp)/'Cloudstitch-combat-vfx.zip'
        with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            for x in records:z.write(BASE/x['path'],x['path'])
            z.writestr('package-manifest.json',encoded)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None and len(z.namelist())==len(records)+1
            assert z.read('package-manifest.json')==encoded
            for x in records:
                data=z.read(x['path'])
                assert len(data)==x['bytes'] and hashlib.sha256(data).hexdigest()==x['sha256']==digest(BASE/x['path'])
        (BASE/'package-manifest.json').write_bytes(encoded)
        os.replace(archive,BASE/'Cloudstitch-combat-vfx.zip')
    output=BASE/'Cloudstitch-combat-vfx.zip'
    print(json.dumps({'zip':'outputs/combat-vfx/'+output.name,'bytes':output.stat().st_size,'sha256':digest(output),'entries':len(records)+1,'GLB_count':54,'entry_hashes_match':True}))
if __name__=='__main__':main()
