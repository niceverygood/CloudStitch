"""Read-only archive inspection and a small preview of existing CC0 artwork."""
import argparse, base64, hashlib, io, json, re, shutil, zipfile
from pathlib import Path
from PIL import Image

root=Path(__file__).resolve().parents[2]
out=root/'outputs'/'external-vfx-free-review-v1'
private=root/'work'/'external-vfx-free-review-v1'
out.mkdir(parents=True,exist_ok=True);private.mkdir(parents=True,exist_ok=True)
p=argparse.ArgumentParser();p.add_argument('--brackeys',type=Path,required=True);p.add_argument('--cartoon',type=Path,required=True);a=p.parse_args()
sha=lambda b:hashlib.sha256(b).hexdigest()
records=[];items=[]
selection=[('flipbooks/explosion_01_8x8.tga','폭발 01','함포 명중 후보',8,8),('flipbooks/explosion_02_8x8.tga','폭발 02','대형 파열 후보',8,8),('flipbooks/fire_01_8x8.tga','화염 덩어리','화염·불씨 후보',8,8),('flipbooks/flame_01_16x4.tga','화염 기둥','분사·지속 화염 후보',16,4),('flipbooks/explosion_smoke_01_8x8.tga','폭발 연기','명중 뒤 연기 후보',8,8),('flipbooks/wispy_smoke_01_8x8.tga','옅은 연기','포구 뒤 잔연기 후보',8,8),('predrawn/explosion_6x5.png','그린 폭발','카툰 폭발·화풍 비교',6,5),('predrawn/fire_ring_6x5.png','그린 화염 고리','발사·폭발 보조 후보',6,5)]
for kind,archive in [('brackeys',a.brackeys),('craftpix',a.cartoon)]:
    data=archive.read_bytes();saved=private/archive.name
    if saved.exists() and saved.read_bytes()!=data:raise RuntimeError('Existing archive differs')
    if not saved.exists():shutil.copyfile(archive,saved)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if z.testzip():raise RuntimeError('CRC failure')
        names=[n for n in z.namelist() if not n.startswith('__MACOSX/') and not Path(n).name.startswith('.') and not n.endswith('/')]
        if kind=='brackeys':
            license_text=z.read('brackeys_vfx_bundle/LICENSE & CREDITS.txt').decode('utf-8-sig')
            if 'Creative Commons Zero' not in license_text:raise RuntimeError('CC0 not present')
            (out/'LICENSE & CREDITS.txt').write_text(license_text,encoding='utf-8')
            for short,label,purpose,cols,rows in selection:
                raw=z.read('brackeys_vfx_bundle/'+short)
                image=Image.open(io.BytesIO(raw)).convert('RGBA');image.load()
                if image.width%cols or image.height%rows:raise RuntimeError('Grid mismatch')
                dest=out/'assets'/(Path(short).stem+'.png');dest.parent.mkdir(exist_ok=True)
                image.save(dest)
                reload=Image.open(dest).convert('RGBA');reload.load()
                if reload.tobytes()!=image.tobytes():raise RuntimeError('PNG conversion altered pixels')
                entry={'id':Path(short).stem,'label':label,'purpose':purpose,'src':'assets/'+dest.name,'width':image.width,'height':image.height,'columns':cols,'rows':rows,'frames':cols*rows,'previewFPS':30,'fpsIsPreviewAssumption':True,'alphaExtrema':image.getchannel('A').getextrema(),'sourceEntry':short,'sourceSha256':sha(raw),'pngSha256':sha(dest.read_bytes()),'conversion':'lossless RGBA TGA/PNG -> PNG; decoded pixels identical'}
                entry['blendRecommendation']='additive' if entry['alphaExtrema']==(255,255) else 'normal-alpha'
                # Public-domain contact strip for visual review, no art changes.
                cw,ch=image.width//cols,image.height//rows
                strip=Image.new('RGBA',(cw*6,ch))
                for i,f in enumerate([0,(cols*rows)//6,(cols*rows)//3,(cols*rows)//2,(cols*rows)*2//3,cols*rows-1]):
                    strip.paste(image.crop(((f%cols)*cw,(f//cols)*ch,(f%cols+1)*cw,(f//cols+1)*ch)),(i*cw,0))
                strip.save(out/'assets'/(Path(short).stem+'-strip.png'))
                items.append(entry)
            records.append({'id':kind,'url':'https://brackeysgames.itch.io/brackeys-vfx-bundle','license':'CC0','archiveBytes':len(data),'archiveSha256':sha(data),'crcPassed':True,'flipbookSourceFiles':len([n for n in names if '/flipbooks/' in n and n.lower().endswith('.tga')]),'predrawnSheets':len([n for n in names if '/predrawn/' in n and n.lower().endswith('.png')]),'selectedSheets':len(items),'sourceArchiveStored':'work/external-vfx-free-review-v1/'+archive.name})
        else:
            groups={}
            for n in names:
                if not n.lower().endswith('.png') or '_Frame_' not in n:continue
                im=Image.open(io.BytesIO(z.read(n)));im.load()
                group=n.split('/')[0];groups.setdefault(group,[]).append({'entry':n,'width':im.width,'height':im.height,'mode':im.mode})
            records.append({'id':kind,'url':'https://free-game-assets.itch.io/free-2d-cartoon-smoke-effects-pack','licenseURL':'https://craftpix.net/file-licenses/','license':'Craftpix Freebie custom terms, commercial game use allowed; source redistribution restricted, not CC0','archiveBytes':len(data),'archiveSha256':sha(data),'crcPassed':True,'animations':{k:{'frameCount':len(v),'dimensions':sorted(set((f['width'],f['height']) for f in v))} for k,v in groups.items()},'sourceArchiveStored':'work/external-vfx-free-review-v1/'+archive.name,'rawArtInOutputs':False})
manifest={'revision':'free-vfx-review-v1','cost':0,'packs':records,'items':items,'previewOnly':True,'gameplayInstalled':False,'artApproved':False,'otherChatsMessaged':False,'excludedSheets':{'predrawn/impact_white_6x4.png':'1746x1505 not evenly divisible by declared6x4; manual layout review needed','predrawn/star_explosion_6x5.png':'840x654 not evenly divisible by declared6x5; manual layout review needed'},'selectionNotes':'Brackeys smooth simulated flame/smoke for first runtime test; predrawn sheets may show a pixel-art mismatch. Craftpix cartoon smoke is a separate style candidate with custom license. Existing Kenney packs remain supplementary textures.'}
(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
cards=''.join('<article><h2>'+e['label']+'</h2><p>'+e['purpose']+'</p><canvas width="300" height="260"></canvas><small>'+str(e['frames'])+'프레임 · 셀 '+str(e['width']//e['columns'])+'×'+str(e['height']//e['rows'])+'</small></article>' for e in items)
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cloudstitch · 무료 VFX 후보</title><style>*{box-sizing:border-box}body{margin:0;background:#eeeede;color:#315b51;font-family:system-ui,'Malgun Gothic',sans-serif}main{max-width:1400px;margin:auto;padding:25px}h1{font-size:27px}p{font-size:13px;line-height:1.8}nav{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:20px 0}button,select{padding:9px 13px;border:1px solid #aebfa5;border-radius:7px;background:#faf9ee;color:inherit}section{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}article{border:1px solid #bac8b0;border-radius:12px;overflow:hidden;background:#faf9ef}article h2,article p,article small{margin:12px;display:block}h2{font-size:16px}canvas{width:100%;height:auto;background:#203331;display:block}small{font-size:11px;color:#778b74}footer{font-size:12px;line-height:1.9;margin-top:22px}a{color:#376e60}@media(max-width:900px){section{grid-template-columns:repeat(2,1fr)}}@media(max-width:480px){section{grid-template-columns:1fr}}</style><main><h1>무료 VFX · 실제 애니메이션 후보 8종</h1><p>Brackeys CC0 번들에서 고른 원본입니다. 새 그림을 생성하지 않았으며 TGA를 PNG로 무손실 변환했습니다.<br>30fps는 검토용 속도입니다. 화풍과 프레임 순서는 적용 전에 장면에서 확인합니다.</p><nav><button id="pause">일시정지</button><label>배경 <select id="bg"><option value="#203331">짙은 청록</option><option value="#e4e8d9">밝은 하늘</option></select></label><label>속도 <select id="fps"><option>15</option><option selected>30</option><option>60</option></select></label><label><input type="checkbox" id="reverse">행 순서 뒤집기</label><span id="state">준비</span></nav><section>CARDS</section><footer><strong>우선 후보:</strong> 화염 기둥·폭발 연기·옅은 연기. 그린 폭발은 손그림 세계와 픽셀 표현의 어울림을 별도로 판단합니다.<br><a href="https://brackeysgames.itch.io/brackeys-vfx-bundle">Brackeys 번들 · CC0</a> · <a href="https://free-game-assets.itch.io/free-2d-cartoon-smoke-effects-pack">무료 카툰 연기 · 별도 라이선스</a><br>카툰 연기는 다운로드·파일 구조 확인까지 완료했고 원본은 work에 보관했습니다. 이 화면은 CC0 자료만 포함합니다. 기존 함선·전투 시연에는 아직 연결하지 않았습니다.</footer></main><script>const data=DATA,canvases=[...document.querySelectorAll('canvas')];let playing=true,start=performance.now(),elapsed=0;const images=data.map(e=>{const im=new Image();im.src=e.src;return im;});document.getElementById('pause').onclick=()=>{playing=!playing;document.getElementById('pause').textContent=playing?'일시정지':'계속 재생';};let last=performance.now();function tick(now){if(playing)elapsed+=(now-last)/1000;last=now;const fps=Number(document.getElementById('fps').value),reverse=document.getElementById('reverse').checked;let loaded=0;data.forEach((e,i)=>{const im=images[i],c=canvases[i],ctx=c.getContext('2d');ctx.fillStyle=document.getElementById('bg').value;ctx.fillRect(0,0,c.width,c.height);if(!im.complete||!im.naturalWidth)return;loaded++;const f=Math.floor(elapsed*fps)%(e.frames+15);if(f>=e.frames)return;const col=f%e.columns,row=reverse?e.rows-1-Math.floor(f/e.columns):Math.floor(f/e.columns),w=e.width/e.columns,h=e.height/e.rows,scale=Math.min(260/w,235/h);ctx.globalCompositeOperation=e.blendRecommendation==='additive'?'lighter':'source-over';ctx.drawImage(im,col*w,row*h,w,h,(c.width-w*scale)/2,(c.height-h*scale)/2,w*scale,h*scale);ctx.globalCompositeOperation=\"source-over\";});document.getElementById('state').textContent=loaded+'/'+data.length+' 로드 · '+Math.floor(elapsed*fps)+'f';requestAnimationFrame(tick);}requestAnimationFrame(tick);</script></html>'''.replace('CARDS',cards).replace('const data=DATA','const data='+json.dumps(items,ensure_ascii=False))
(out/'index.html').write_text(html,encoding='utf-8')
(out/'README.txt').write_text('무료 VFX 추가 조사\n\nBrackeys VFX Bundle CC0: 실제 플립북 TGA14개와 predrawn PNG14개 중 대표8개를 PNG 무손실 변환해 재생 화면을 만들었습니다. manifest 실제 집계가 우선입니다.\nCraftpix Free 2D Cartoon Smoke: 실제 프레임그룹/크기/ZIP CRC를 확인했습니다. 커스텀 Freebie 라이선스로 상업 게임 사용이 가능하나 원본 재배포가 제한되어 ZIP과 원본은 work에만 보관합니다.\n기존 Kenney 2팩은 정지 입자 재료로 유지하며 이번 애니메이션과 별도 집계합니다.\n비용0, 결제/가입/코드 실행/유료 API0. 게임 설치나 미술 승인은 아직 아닙니다.\n',encoding='utf-8')
print(json.dumps({'packs':records,'preview':'outputs/external-vfx-free-review-v1/index.html'},ensure_ascii=False))


