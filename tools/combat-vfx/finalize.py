"""Publish verified local mesh prototypes and their portable verification records."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import shutil
ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'outputs/combat-vfx'
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d): p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
catalog=read(BASE/'catalog.json'); sequences=read(BASE/'sequence-catalog.json'); spec=read(BASE/'production-spec.json')
q=read(ROOT/'work/verification/combat-vfx/qa-result.json')
sq=read(ROOT/'work/verification/combat-vfx-sequences/summary.json')
gq=read(ROOT/'work/verification/combat-vfx-gallery/summary.json')
v=read(ROOT/'work/verification/combat-vfx/gltf-validator.json')
assert len(catalog['items'])==48 and len(sequences['items'])==6
assert q['passed'] and sq['passed'] and gq['passed'] and v['passed']
assert len(q['models'])==48 and len(sq['models'])==6 and len(v['files'])==54
assert all(f['errors']==0 and f['warnings']==0 for f in v['files'])
assert all(x['changedPixels']==0 for x in q['ghosting'])
checks={f['file']:f for f in v['files']}
for entry in catalog['items']:
    file=BASE/entry['model']; m=read(BASE/'manifests'/(entry['id']+'.json'))
    check=checks[file.relative_to(ROOT).as_posix()]
    assert m['sha256']==digest(file)==check['sha256']
    assert (BASE/entry['preview']).is_file() and entry['preview_image']['bounds']
    m['status']='completed_mesh_animation_prototype'
    m['verification']['browser_QA_passed']=True
    m['verification']['standard_validator']={k:check[k] for k in ['errors','warnings','infos','sha256']}
    write(BASE/'manifests'/(entry['id']+'.json'),m)
    entry['status']=m['status']
for entry in sequences['items']:
    file=BASE/entry['model'];check=checks[file.relative_to(ROOT).as_posix()]
    assert entry['sha256']==digest(file)==check['sha256']
    original=ROOT/'outputs/weapon-modules'/entry['id']/'weapon.glb'
    assert digest(original)==entry['source_weapon_sha256']
    assert (BASE/entry['preview']).is_file()
    entry['status']='completed_composed_animation_study'
    write(BASE/'manifests'/(entry['id']+'.json'),{**entry,'standard_validator':{k:check[k] for k in ['errors','warnings','infos','sha256']},'browser_QA_passed':True,'limits':['Composed choreography and estimated muzzle placement, not a combat game or finished weapon sockets.','Original weapon geometry/texture files remain unchanged. Four zero normals were repaired only in the chain-shot copy.','Weapon part separation, recoil rig, collisions and damage are not implemented.']})
write(BASE/'catalog.json',catalog);write(BASE/'sequence-catalog.json',sequences)
spec['status']='48_mesh_animation_prototypes_completed'
for e in spec['effects']:e['status']='completed_mesh_animation_prototype'
spec['actual_implementation']={'geometry':'48 locally authored 3D mesh effects with unlit vertex paint and standard transform clips. No image generation or paid Meshy tasks.','preview_repeat':'Viewer repeats previews by default; recipe loop policies are unchanged.','actual_palette':'tools/combat-vfx/core.mjs PALETTE; vertex RGB is clamped to [0,1].','additional_compositions':6,'verification':'verification.json'}
write(BASE/'production-spec.json',spec)
verification={'standard_validator':{'name':v['validator'],'version':v['version'],'files':54,'errors':0,'warnings':0,'infos':sum(x['infos'] for x in v['files']),'info_note':'426 informational messages in the six composites concern retained unused accessors and identity matrices. No validation issues were ignored.','reports':[{'file':x['file'].replace('outputs/combat-vfx/',''),'sha256':x['sha256'],'errors':x['errors'],'warnings':x['warnings'],'infos':x['infos']} for x in v['files']]},'browser_effects':{'passed':True,'models':48,'downloads_match_source':True,'ghosting':[{'id':x['id'],'changedPixels':x['changedPixels']} for x in q['ghosting']],'mobile_overflow':q['mobile']['overflow'],'external_requests':q['externalRequests']},'browser_sequences':{'passed':True,'models':6,'original_weapon_hashes_preserved':True,'harpoon_tether_visible_after_arrival':True},'gallery':{'passed':True,'models':48,'representative_preview_count':12},'limits':'File, animation and browser-preview verification. Actual game-engine import, combat, fluid/particle simulation and large-scale performance remain untested.'}
write(BASE/'verification.json',verification)
report_dir=BASE/'verification';report_dir.mkdir(exist_ok=True)
for source,name in [('work/verification/combat-vfx/qa-result.json','browser-effects.json'),('work/verification/combat-vfx/gltf-validator.json','gltf-validator.json'),('work/verification/combat-vfx-sequences/summary.json','sequences.json'),('work/verification/combat-vfx-gallery/summary.json','gallery.json')]:shutil.copyfile(ROOT/source,report_dir/name)
progress={'game_title':'Cloudstitch','scope_count':48,'completed':[x['id'] for x in catalog['items']],'remaining':[],'composed_sequences_completed':[x['id'] for x in sequences['items']],'meshy_credits_used':0,'new_AI_image_generations':0,'browser_verification_pending':False,'next_recommended':'Connect one weapon and its effects to actual sockets, collisions and lifecycle in the chosen engine.'}
write(BASE/'progress.json',progress)
summary={'game_title':'Cloudstitch','completed_at_utc':datetime.now(timezone.utc).isoformat(),'unique_effects':48,'composed_attack_studies':6,'GLB_files':54,'embedded_clips':54,'basic_effect_triangles':{'min':min(x['triangles'] for x in catalog['items']),'max':max(x['triangles'] for x in catalog['items']),'total':sum(x['triangles'] for x in catalog['items'])},'GLB_bytes':sum((BASE/x['model']).stat().st_size for x in catalog['items']+sequences['items']),'new_meshy_credits':0,'new_AI_image_generations':0,'original_weapon_files_preserved':True,'verification':'verification.json','deliverables':{'gallery':'gallery.html','effects_workbench':'index.html','weapon_attacks':'attack-sequences.html','overview':'overview.png','recipes':'recipes.json','archive':'Cloudstitch-combat-vfx.zip'},'limitations':['Original low-poly mesh/vertex-paint effects, not a baked fluid or physically simulated particle system.','Appearance/disappearance uses transform scale, not animated opacity shaders.','Game engine, actual sockets, damage, collision, audio, pooling and performance targets remain follow-up work.'],'git':'Local changes only. No commit or push in this task.'}
write(BASE/'delivery-summary.json',summary)
print(json.dumps({'effects':48,'attack_studies':6,'GLBs':54,'standard_errors':0,'standard_warnings':0,'credits':0,'triangles':summary['basic_effect_triangles'],'bytes':summary['GLB_bytes']}))
