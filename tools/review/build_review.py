from pathlib import Path
import hashlib, json, re, shutil
root = Path(__file__).resolve().parents[2]
out = root / "outputs" / "emotional-edition"
source = out / "FINAL-emotional-game-design.html"
text = source.read_text(encoding="utf-8-sig")
cover = """
<section class="review-cover" id="review">
<p class="review-eyebrow">CLOUDSTITCH · DESIGN REVIEW · 2026.10.18</p>
<h1>Cloudstitch<br><small>전체 기획 · 무드보드 검토본</small></h1>
<p class="review-lead">구름 위에서 배를 고치고, 부품과 기억을 건져 올리는 항해.</p>
<p>스토리와 결말, 전투·무기·스킬·성장·제작, 항구·미션·지역, UI·접근성까지 상세 기획 114개와 감성판 무드보드 122장을 아래에 모두 수록했습니다.</p>
<div class="review-actions"><a href="#core">통합 기획 읽기</a><a href="#docs">상세 기획 114개</a><a href="#boards">무드보드 122장</a><a href="moodboard-comparison.html">원본·감성판 122쌍 비교</a></div>
<div class="review-art">
<a href="../cloudstitch-title-screen/index.html"><img src="../cloudstitch-title-screen/start-screen.png" alt="Cloudstitch 손그림 시작화면"><span>현재 브랜드 · 시작화면</span></a>
<a href="../selected-airship-toon3d/viewer-v2.html"><img src="../selected-airship-toon3d/reference.png" alt="크림색 기낭과 목재 선체의 선택 비행선"><span>현재 선택 비행선 · 실제 3D 보기</span></a>
</div>
<h2>현재 아트와 제작 자료</h2>
<p>크림색 천, 꿀빛 목재, 청록색 기계, 황동 장식, 산호색 수선 천을 공유합니다. 감성적인 손그림과 단순한 명암으로, 실제 3D도 입체감 있는 2D 그림처럼 보이게 하는 방향입니다.</p>
<div class="review-links">
<a href="../selected-airship-toon3d/viewer-v2.html">선택 비행선 3D 뷰어</a>
<a href="../weapon-modules/gallery.html">장착 무기 6종</a>
<a href="../combat-vfx/attack-sequences.html">기존 공격 시연 6종</a>
<a href="../combat-vfx/gallery.html">기존 전투 효과 48종</a>
<a href="../world-assets/gallery.html">월드 자산 96종</a>
<a href="../world-assets/scenes.html">지도·지역 조립 7장면</a>
<a href="../2d-volume-airships/index.html">비행선 2D 콘셉트 9종</a>
<a href="../airship-models-9/index.html">초기 3D 옵션 9종</a>
</div>
<p class="review-note"><strong>검토 기준:</strong> 아래 본문은 2026년 10월 17일의 기획·생성 기록을 보존한 전체 자료입니다. 이전 작업명과 당시의 미제작 설명이 남아 있습니다. 정식 제목은 Cloudstitch이며 이후 비행선·무기·효과·월드의 3D 원형과 뷰어가 추가됐습니다. 다른 프로젝트 세션에서 진행 중인 최신 개발의 완료 상태를 이 기획서가 보증하지는 않습니다. 기존 전투 효과는 아트 개선 대상이며, 새 Meshy 기반 효과가 완료된 것으로 표시하지 않습니다. 기획 수치는 검증 전 가설입니다. <strong>이야기와 결말 스포일러가 포함됩니다.</strong></p>
<p class="review-origin"><a href="FINAL-emotional-game-design.html">기존 감성판 원문</a> · <a href="../FINAL-game-design-2026-10-17.html">초기 통합 원문</a> · <a href="../112-system-rules-reference.txt">현재 시스템 기준</a> · <a href="../114-production-decision-register.txt">미확정 제작 결정</a></p>
</section>
"""
style = """
<style>
.review-cover{background:#fffaf0;border:1px solid #c9b999;border-radius:22px;padding:clamp(20px,4vw,44px);margin-bottom:56px}
.review-eyebrow{font-size:12px;letter-spacing:.18em;color:#866847}
.review-cover h1{font-size:clamp(34px,5vw,56px);line-height:1.18;margin:18px 0;color:#365e63}
.review-cover h1 small{font-size:.55em;font-weight:500}
.review-lead{font-size:22px;color:#72583d}
.review-actions,.review-links{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0}
.review-actions a,.review-links a{border:1px solid #c7b99c;border-radius:8px;padding:9px 14px;text-decoration:none;background:#f1e8d5}
.review-actions a:first-child{background:#365e63;color:#fffaf0;border-color:#365e63}
.review-art{display:grid;grid-template-columns:1.3fr 1fr;gap:16px;margin:30px 0}
.review-art a{display:flex;flex-direction:column;text-decoration:none;background:#eee6d4;border:1px solid #d0c4ab;border-radius:12px;overflow:hidden}
.review-art img{width:100%;height:280px;object-fit:contain;background:#f5efdf}
.review-art span{font-size:15px;padding:10px 14px}
.review-cover h2{margin-top:28px;font-size:24px}
.review-note{font-size:15px;line-height:1.8;border-left:3px solid #b58b58;padding:15px 18px;background:#f0e7d4}
.review-origin{font-size:14px}
@media(max-width:640px){.review-art{grid-template-columns:1fr}.review-art img{height:220px}.review-cover{padding:20px}.review-actions a,.review-links a{font-size:15px}}
@media print{.review-cover{break-after:page}.review-actions{display:none}.review-art img{height:190px}}
</style>
"""
text = re.sub(r"<title>.*?</title>", "<title>Cloudstitch — 전체 기획·무드보드 검토본</title>", text, count=1, flags=re.S)
text = text.replace("</head>", style + "</head>", 1)
text = text.replace("<body><main>", "<body><main>" + cover, 1)
text = re.sub(r"<img(?![^>]*loading=)", '<img loading="lazy"', text)
target = out / "Cloudstitch-review.html"
target.write_text(text, encoding="utf-8")
manifest = {
    "title":"Cloudstitch 전체 기획·무드보드 검토본",
    "review_date":"2026-10-18",
    "source":"outputs/emotional-edition/FINAL-emotional-game-design.html",
    "source_sha256":hashlib.sha256(source.read_bytes()).hexdigest(),
    "review":"outputs/emotional-edition/Cloudstitch-review.html",
    "changes":["검토 표지와 최신 기존 자산 링크 추가","원문 전문·무드보드·기록 보존","이미지 지연 로딩"],
    "new_generated_images":0,
    "note":"2026-10-17 기획 보존본. 최신 개발 완료나 VFX v2 완성을 주장하지 않음."
}
(out / "Cloudstitch-review-manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"review_bytes":target.stat().st_size,"source_sha256":manifest["source_sha256"]},ensure_ascii=False))
