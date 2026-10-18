"""Update world handoff documents only after final local delivery checks pass.

Default is a read-only dry run. Run with --write after catalog96, scenes7,
delivery-summary.json, progress.json and verification.json are final. This tool
does not create models/images, contact services, commit, push, or schedule work.
The existing tools/verify-assets.py --write remains the inventory authority.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import struct
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "outputs/world-assets"
HERO_IDS = ("harbor-inn", "repair-workshop", "canvas-market", "harbor-office", "beacon-lighthouse", "memory-observatory")
SCENE_IDS = ("jonghang-harbor", "updraft-canyon", "storm-shelter", "iron-rib-yard", "lower-fog-mooring", "royal-service-deck", "world-map-diorama")
PENDING = {"pending", "planned", "planned_before_build", "pending_hero_source", "generating", "failed", "cancelled"}


def read_json(path):
    if not path.is_file():
        raise ValueError(f"Final record is not ready: {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}")
    return json.loads(path.read_text(encoding="utf-8-sig"))


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def pick(source, names, default=None):
    for name in names:
        if name in source:
            return source[name]
    return default


def number(value):
    if isinstance(value, bool):
        raise ValueError("Expected a numeric count, received a boolean")
    if isinstance(value, list):
        return len(value)
    if isinstance(value, (int, float)):
        return value
    raise ValueError("Expected an explicit numeric/list count in final records")


def inside_base(relative):
    path = (BASE / relative).resolve()
    if not path.is_relative_to(BASE.resolve()):
        raise ValueError("World asset path leaves its output folder: " + str(relative))
    return path


def image_dimensions(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 24:
        return list(struct.unpack(">II", data[16:24]))
    if data[:2] == b"\xff\xd8":
        offset = 2
        while offset + 4 <= len(data):
            if data[offset] != 0xFF:
                offset += 1
                continue
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            if offset >= len(data):
                break
            marker = data[offset]
            offset += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            if offset + 2 > len(data):
                break
            length = int.from_bytes(data[offset:offset + 2], "big")
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF) and length >= 7:
                return [int.from_bytes(data[offset + 5:offset + 7], "big"), int.from_bytes(data[offset + 3:offset + 5], "big")]
            if length < 2:
                break
            offset += length
    raise ValueError("Unsupported embedded image dimensions; do not assume a 2K texture")


def inspect_glb(path):
    data = path.read_bytes()
    if len(data) < 20 or struct.unpack_from("<III", data) != (0x46546C67, 2, len(data)) or data[16:20] != b"JSON":
        raise ValueError("Not a complete real GLB: " + str(path))
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length].decode("utf-8"))
    bin_offset = 20 + json_length
    binary = b""
    if bin_offset + 8 <= len(data):
        bin_length, bin_kind = struct.unpack_from("<II", data, bin_offset)
        if bin_kind == 0x004E4942:
            binary = data[bin_offset + 8:bin_offset + 8 + bin_length]
    triangles, primitives, colored = 0, 0, 0
    mesh_profiles = []
    for mesh in document.get("meshes", []):
        profile = {"vertex_colors": True, "unlit": True}
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                raise ValueError("World model contains an unexpected non-triangle primitive")
            accessor = primitive.get("indices", primitive["attributes"]["POSITION"])
            triangles += document["accessors"][accessor]["count"] // 3
            primitives += 1
            colored += "COLOR_0" in primitive["attributes"]
            material = document.get("materials", [])[primitive.get("material", 0)]
            profile["vertex_colors"] = profile["vertex_colors"] and "COLOR_0" in primitive["attributes"]
            profile["unlit"] = profile["unlit"] and "KHR_materials_unlit" in material.get("extensions", {})
        mesh_profiles.append(profile)
    dimensions, texture_hashes = [], []
    for image in document.get("images", []):
        if image.get("uri") or "bufferView" not in image:
            raise ValueError("World GLB texture is not an embedded image")
        view = document["bufferViews"][image["bufferView"]]
        offset = view.get("byteOffset", 0)
        image_bytes = binary[offset:offset + view["byteLength"]]
        dimensions.append(image_dimensions(image_bytes))
        texture_hashes.append(hashlib.sha256(image_bytes).hexdigest())
    if not triangles or not primitives:
        raise ValueError("World GLB contains no actual triangle mesh")
    return {"mesh_count": len(document.get("meshes", [])), "triangles": triangles,
            "animation_count": len(document.get("animations", [])), "texture_dimensions": dimensions,
            "texture_hashes": texture_hashes, "mesh_profiles": mesh_profiles,
            "all_vertex_colored": colored == primitives, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def verify_hero_sources(item, manifest, actual):
    """Check original, normal-only copy and an optional additive roof copy."""
    id = item["id"]
    original = BASE / "hero" / id / "model.glb"
    if not original.is_file():
        raise ValueError("Original hero GLB is not preserved: " + id)
    original_stats = inspect_glb(original)

    def one_mesh_2k_static(stats, label):
        if (stats["mesh_count"] != 1 or stats["animation_count"] != 0
                or not stats["texture_dimensions"]
                or any(size != [2048, 2048] for size in stats["texture_dimensions"])):
            raise ValueError(label + " must remain one mesh, 2K textured and static: " + id)

    one_mesh_2k_static(original_stats, "Original hero")
    for record in (item, manifest):
        if inside_base(record.get("source_model", "")) != original.resolve() or record.get("source_sha256") != original_stats["sha256"]:
            raise ValueError("Catalog/manifest original-source contract differs: " + id)
    repair_metadata = manifest.get("normal_repair", {})
    repair_path = inside_base(repair_metadata.get("log", "hero/" + id + "/repair-log.json"))
    repair = read_json(repair_path)
    if repair.get("original_source_preserved") is not True or repair.get("changes", {}).get("positions_indices_uvs_textures_materials_unchanged") is not True:
        raise ValueError("Normal-only copy preservation has not been verified: " + id)
    source_record, normal_record = repair["original_source"], repair["repaired_source"]
    normal = inside_base(normal_record["model"])
    normal_stats = inspect_glb(normal)
    one_mesh_2k_static(normal_stats, "Normal-only hero copy")
    if (inside_base(source_record["model"]) != original.resolve()
            or source_record["sha256"] != original_stats["sha256"]
            or normal_record["sha256"] != normal_stats["sha256"]
            or original_stats["triangles"] != normal_stats["triangles"]
            or original_stats["texture_hashes"] != normal_stats["texture_hashes"]):
        raise ValueError("Original/normal-only file or texture hashes differ from contract: " + id)
    if (actual["mesh_count"] < 1 or actual["animation_count"] != 0
            or actual["texture_dimensions"] != original_stats["texture_dimensions"]
            or actual["texture_hashes"] != original_stats["texture_hashes"]):
        raise ValueError("Delivery hero must preserve exact original 2K texture bytes: " + id)
    roof_path_value = item.get("roof_repair_log") or manifest.get("roof_repair_log")
    roof_copy = None
    roof_added = None
    if roof_path_value:
        roof = read_json(inside_base(roof_path_value))
        if (roof.get("original_source_preserved") is not True
                or roof.get("base_normal_copy_preserved") is not True
                or roof.get("original_binary_prefix_preserved") is not True):
            raise ValueError("Roof-copy source preservation is not verified: " + id)
        for key, expected_path, expected_sha in (
                ("original_source", original, original_stats["sha256"]),
                ("base_normal_copy", normal, normal_stats["sha256"]),
                ("repaired_source", inside_base(item["model"]), actual["sha256"])):
            record = roof[key]
            if inside_base(record["model"]) != expected_path.resolve() or record["sha256"] != expected_sha:
                raise ValueError("Roof log source/copy hash mismatch: " + id + " / " + key)
        for record in (item, manifest):
            embedded = record.get("roof_repair")
            if (record.get("roof_repair_log") != roof_path_value or not isinstance(embedded, dict)
                    or embedded.get("repaired_source", {}).get("sha256") != actual["sha256"]
                    or embedded.get("base_normal_copy", {}).get("sha256") != normal_stats["sha256"]):
                raise ValueError("Catalog/manifest roof contract differs from actual log: " + id)
        added, after = roof.get("added_geometry", {}), roof.get("after", {})
        if (after.get("errors") != 0 or after.get("warnings") != 0
                or after.get("mesh_count") != actual["mesh_count"]
                or after.get("triangles") != actual["triangles"]
                or number(added.get("mesh_count")) <= 0
                or actual["mesh_count"] != normal_stats["mesh_count"] + added["mesh_count"]
                or actual["triangles"] != normal_stats["triangles"] + added["triangles"]):
            raise ValueError("Roof added-geometry counts or final format checks differ: " + id)
        additions = actual["mesh_profiles"][normal_stats["mesh_count"]:]
        if not additions or not all(profile["vertex_colors"] and profile["unlit"] for profile in additions):
            raise ValueError("Roof additions must be local vertex-painted unlit meshes: " + id)
        roof_copy, roof_added = inside_base(item["model"]), added
    elif actual["sha256"] != normal_stats["sha256"]:
        raise ValueError("An unrecorded hero delivery variant is selected: " + id)
    return {"original": original, "normal_copy": normal, "roof_copy": roof_copy,
            "roof_added": roof_added, "original_stats": original_stats, "normal_stats": normal_stats}


def checked_section(verification, names, count=None):
    section = pick(verification, names)
    if not isinstance(section, dict) or section.get("passed") is not True:
        raise ValueError("Final verification section has not passed: " + "/".join(names))
    if count is not None:
        actual = pick(section, ("models", "model_count", "count", "assets", "scenes"))
        if number(actual) != count:
            raise ValueError("Final browser count does not match " + str(count))
    return section


def final_context(args):
    delivery = read_json(args.delivery)
    progress = read_json(args.progress)
    verification = read_json(args.verification)
    catalog = read_json(BASE / "catalog.json")
    scenes = read_json(BASE / "scene-catalog.json")
    assets, compositions = catalog.get("items", []), scenes.get("items", [])
    if len(assets) != 96 or len(compositions) != 7 or len({x["id"] for x in assets}) != 96 or {x["id"] for x in compositions} != set(SCENE_IDS):
        raise ValueError("Expected exactly 96 independent assets and 7 distinct scene studies")
    if progress.get("remaining") != [] or progress.get("browser_verification_pending", False) is not False:
        raise ValueError("World production or browser verification is still pending")
    expected_assets = pick(delivery, ("independent_assets", "unique_assets", "asset_count", "world_assets"))
    expected_scenes = pick(delivery, ("composed_scenes", "assembled_scenes", "scene_count", "scene_studies"))
    if number(expected_assets) != 96 or number(expected_scenes) != 7:
        raise ValueError("Final delivery summary has not declared the 96/7 scope")
    standard = pick(verification, ("standard_validator", "gltf_validator", "validator"))
    if not isinstance(standard, dict) or standard.get("errors") != 0 or standard.get("warnings") != 0:
        raise ValueError("Final selected-model validator errors/warnings are not zero")
    browser_assets = checked_section(verification, ("browser_assets", "browser_world_assets", "assets_browser"), 96)
    browser_scenes = checked_section(verification, ("browser_scenes", "scenes_browser"), 7)
    gallery = checked_section(verification, ("gallery", "browser_gallery"))
    stats, manifests = {}, {}
    for item in assets + compositions:
        status = str(item.get("status", "")).lower()
        if not status or status in PENDING or "pending" in status or "failed" in status:
            raise ValueError("Not a completed world prototype: " + item["id"])
        model, preview = inside_base(item["model"]), inside_base(item["preview"])
        if not model.is_file() or not preview.is_file() or preview.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("Missing real model/PNG for " + item["id"])
        actual = inspect_glb(model)
        manifest_path = inside_base(item.get("manifest", "manifests/" + item["id"] + ".json"))
        manifest = read_json(manifest_path)
        if manifest.get("sha256") != actual["sha256"]:
            raise ValueError("Model/manifest SHA256 mismatch: " + item["id"])
        if actual["animation_count"] != 0:
            raise ValueError("This handoff describes static world prototypes; inspect unexpected animation: " + item["id"])
        stats[item["id"]] = actual
        manifests[item["id"]] = manifest
    if not set(HERO_IDS).issubset(stats):
        raise ValueError("Six completed hero models are required")
    local_ids = [item["id"] for item in assets if item["id"] not in HERO_IDS]
    if len(local_ids) != 90 or not all(stats[id]["all_vertex_colored"] for id in local_ids):
        raise ValueError("Expected 90 actual vertex-painted local assets")
    originals, normal_copies, roof_copies, hero_sources = [], [], [], {}
    asset_by_id = {item["id"]: item for item in assets}
    for id in HERO_IDS:
        verified = verify_hero_sources(asset_by_id[id], manifests[id], stats[id])
        hero_sources[id] = verified
        originals.append(verified["original"])
        normal_copies.append(verified["normal_copy"])
        if verified["roof_copy"]:
            roof_copies.append(verified["roof_copy"])
    credits = pick(delivery, ("new_meshy_credits", "reported_consumed_credits", "meshy_credits_used"), pick(progress, ("reported_consumed_credits", "meshy_credits_used")))
    images = pick(delivery, ("new_AI_image_generations", "new_image_generations", "image_generation_count"), pick(progress, ("new_AI_image_generations", "image_generation_count")))
    credits, images = number(credits), number(images)
    return {"delivery": delivery, "progress": progress, "verification": verification,
            "standard": standard, "browser_assets": browser_assets, "browser_scenes": browser_scenes,
            "gallery": gallery, "assets": assets, "scenes": compositions, "stats": stats,
            "original_count": len(originals), "normal_copy_count": len(set(normal_copies)),
            "roof_copy_count": len(set(roof_copies)), "hero_sources": hero_sources,
            "credits": credits, "images": images}


def inventory_counts(inventory=None):
    if inventory is not None:
        entries = inventory["assets"]
        return {"png": sum(x["path"].lower().endswith(".png") for x in entries),
                "glb": sum(x["path"].lower().endswith(".glb") for x in entries),
                "count": len(entries), "bytes": sum(x["bytes"] for x in entries)}
    paths = [path for path in (ROOT / "outputs").rglob("*") if path.is_file() and path.suffix.lower() in (".png", ".glb") and "meshy_output" not in path.parts]
    for path in paths:
        with path.open("rb") as stream:
            if stream.read(64).startswith(b"version https://git-lfs.github.com/spec/v1"):
                raise ValueError("Restore Git LFS asset before documenting current counts: " + path.relative_to(ROOT).as_posix())
    return {"png": sum(path.suffix.lower() == ".png" for path in paths),
            "glb": sum(path.suffix.lower() == ".glb" for path in paths),
            "count": len(paths), "bytes": sum(path.stat().st_size for path in paths)}


def replace_block(text, marker, content, before=None):
    start, end = f"<!-- {marker} BEGIN -->", f"<!-- {marker} END -->"
    block = start + "\n" + content.rstrip() + "\n" + end
    if start in text or end in text:
        pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
        if len(pattern.findall(text)) != 1:
            raise ValueError("Unbalanced or repeated generated document marker: " + marker)
        return pattern.sub(lambda _: block, text, count=1)
    if before and before in text:
        return text.replace(before, block + "\n" + before, 1)
    return text.rstrip() + "\n\n" + block + "\n"


def section16(context):
    rows = "\n".join(f"| `{item['id']}` | {item['name_ko']} | {context['stats'][item['id']]['triangles']:,} | {context['stats'][item['id']]['mesh_count']} |" for item in context["assets"] if item["id"] in HERO_IDS)
    local_stats = [context["stats"][item["id"]] for item in context["assets"] if item["id"] not in HERO_IDS]
    minimum, maximum = min(x["mesh_count"] for x in local_stats), max(x["mesh_count"] for x in local_stats)
    infos = context["standard"].get("infos", "최신 검사 기록 참조")
    return f"""## 16. 최신 추가: 월드 기본팩96자산과7조립 장면

최종 `outputs/world-assets/delivery-summary.json`, `progress.json`, `verification.json`과 실제 모델을 읽어 확인한 범위다. **독립 자산96개(주요 건물6·로컬 모듈90)와 별도 조립 비교7개**이며 같은 자산을 여러 장면에서 재사용해 독립 자산으로 다시 세지 않는다. 기존 무기·VFX·정사·종료된 자동화 기록은 유지한다. 전체 게임 맵·캠페인·플레이가 완성된 범위가 아니다.

| 바로 볼 자료 | 경로 | 의미 |
|---|---|---|
| 월드 갤러리 | `outputs/world-assets/gallery.html` | 독립96개와 조립7개를 구분해 보는 실제 렌더 모음 |
| 독립 자산 작업대 | `outputs/world-assets/index.html` | 실제 GLB 회전·세 표시 모드·다운로드 |
| 조립 장면 작업대 | `outputs/world-assets/scenes.html` | 항구·지역·지도 비교7개 |
| 제작 기준/결과 | `outputs/world-assets/production-spec.json`, `catalog.json`, `scene-catalog.json`, `manifests/` | 원안과 실제 수치·구조·파일·검사를 구분 |
| 사용/검사 기록 | `outputs/world-assets/README.txt`, `verification.json`, `delivery-summary.json` | 실제 완료 범위·검증·비용·제한 |

주요 건물은 순서대로 여관·수리 공방·천 시장·항만 사무소·등대·기억 관측소다. 원본과 법선 수정본은 각각 메시1·2K텍스처·애니메이션0이다. 현재 등록한 표시 모델은 원래2K텍스처 바이트를 정확히 유지하며, 지붕 보강본에는 정점 채색의 unlit 메시가 추가되어 있다. 실제 등록 수치는 다음과 같다.

| ID | 건물 | 실제 삼각형 | 등록 메시 |
|---|---|---:|---:|
{rows}

원본 hero GLB **{context['original_count']}개**, 별도 법선 수정본 **{context['normal_copy_count']}개**, 별도 지붕 보강본 **{context['roof_copy_count']}개**를 구분한다. 법선 수정은 잘못된 벡터의 보정이며 원본의 위치·인덱스·UV·텍스처·재질 보존과 해시를 repair-log로 확인한다. 여관·공방의 지붕 보강본은 원본과 법선 수정본을 모두 보존한 뒤 안쪽 청록 라이너·뒷판 등 로컬 정점 채색 메시를 추가한 별도 파일이다. roof-repair-log의 원본/기본수정본/최종파일 해시·추가 형상·검사값과 실제2K텍스처 바이트를 확인한다. 법선 보정 자체가 지붕 구멍을 메운 것은 아니며, 별도 보강도 전체 메시를 watertight로 리메시하거나 의도한 문·처마·창의 모든 구멍을 채운 결과는 아니다. 한 장의 그림에서 추정한 지붕·뒤·내부는 계속 시각 검토가 필요하다. 저장소 파일 수에는 이 복사본이 각각 포함되지만 월드 독립 자산은 여전히96개다.

로컬90개는 실제 정점 채색의 여러 입체 부품을 가진 정적 모델이다. 현재 파일의 메시 수는 자산별{minimum}~{maximum}개이며 애니메이션은0이다. 단순 큐브 목업을 완성 자산으로 센 결과가 아니며, 입체 부품이 있다는 사실만으로 collider·navmesh·LOD·내부·문 개폐·상호작용·표준 엔진 소켓이 완성된 것도 아니다. 손그림/셀/윤곽선 표시와 상대 크기 정규화는 뷰어 기능이며 원본 GLB를 바꾸지 않는다.

조립 장면은 `jonghang-harbor`, `updraft-canyon`, `storm-shelter`, `iron-rib-yard`, `lower-fog-mooring`, `royal-service-deck`, `world-map-diorama`다. 종항에는 시장·공방을 함께 놓고 후반4곳은 작은 원정 정박 시안으로 제한한다. 황궁은 조용한 서비스 갑판이며 새로운 상점 도시가 아니다. 지도 디오라마는 정사6지역 마커·선택 항로의3D 비교다. 실제 지리·게임 좌표·고도·연료 거리·해금·미발견 공개를 확정하지 않는다. 종 도난/빈 종틀·어머니/부활 증거·결말의 지상 정착 순서는 기존 정사를 따른다.

최종 검증 기록의 선택 모델 공식 검사는 **오류0·경고0**, 정보 메시지는 **{infos}개**다. 독립 자산96개 브라우저 검사·조립7개 브라우저 검사·갤러리는 각각 최종 기록의 passed를 확인했다. 상세 다운로드 해시·텍스처·모드·대표 잔상·모바일·외부 요청 검사는 `verification.json`과 그 원본 기록을 따른다. 대표 검사를 모든 모델에 확대하거나 파일/브라우저 검사를 실제 엔진 성능·플레이·밸런스로 주장하지 않는다.

이번 월드 작업의 실제 기록은 **Meshy {context['credits']:g}크레딧·AI 이미지 생성 {context['images']:g}건**이다. 앞선 무기90크레딧·VFX 신규 생성0과 구분한다. 이 문서 도구는 인증·추가 모델/이미지 생성·자동화·git commit/push를 수행하지 않는다. 이번 무기·VFX·월드 새 로컬 결과를 과거 원격 업로드에 이미 포함된 것으로 가정하지 말고 최신 Git 상태·원격 커밋을 확인한다. 같은 Codex 계정이 미푸시 로컬 자산을 다른PC로 자동 동기화하지 않는다.

재현 소스는 `tools/world-assets/README.md`와 `core.mjs`, `primary.mjs`, `secondary.mjs`, `generate.mjs`, `repair-hero.mjs`, `close-hero-roof.mjs`, `scenes.mjs`, `build.cjs`, `capture.cjs`, `gallery.cjs`에 있다. 실제 브라우저 검사와 공식 GLB 검사는 `tools/qa/world-workbench.cjs`, `world-gltf.cjs`를 사용한다. `handoff.py --write`는 완료 기록을 확인한 뒤 문서·사본과 기존 inventory 도구를 갱신하며 모델·원화를 수정하지 않는다.

다음 추천은 엔진·표준 소켓을 정하고 작은 정박 장면과 기관총 한 공격 순환을 연결하는 것이다. 이동/가림·실제 충돌·피격·효과 종료·한 수리/귀환 접점을 검증한다. 모든96자산·7장면을 즉시 플레이 맵으로 전환하거나 내부·캐릭터·경제·저장·성능을 완료했다고 하지 않는다. 최신 사용자 요청이 우선이며 새 유료 생성·자동화·배포를 추정하여 시작하지 않는다.
"""


def continue_state(context):
    return f"""- 최신 월드팩은 `outputs/world-assets/`의 **독립96자산(주요 건물6+로컬90)과 별도 조립7장면**이야. `gallery.html`, `index.html`, `scenes.html`로 실제 렌더/GLB를 보고, `production-spec.json` 원안과 `catalog.json`/`scene-catalog.json`/`manifests/` 실제 결과를 구분해줘. 완성된 전투 게임·전체 캠페인 맵은 아니야.
- 주요 건물은 원본GLB{context['original_count']}개·법선 수정본{context['normal_copy_count']}개·지붕 보강본{context['roof_copy_count']}개를 구분해 보존했어. 원본/법선수정본은 메시1·2K텍스처·정적이며 등록 여관·공방은 원래2K텍스처를 정확히 유지하고 청록 라이너/뒷판의 정점 채색unlit 메시를 더한 별도 파일이야. roof-repair-log와 source_model/source_sha256의 실제 파일·해시를 확인해줘. 로컬90개도 정점 채색의 여러 메시·정적 모델이야. 법선 수정 자체가 지붕 구멍을 메운 것은 아니고 별도 보강도 전체watertight 리메시·추정 후면/내부 완성이 아니야. collider/navmesh/LOD/건물내부/상호작용/엔진소켓은 미구현이야.
- 최종 `delivery-summary.json`/`progress.json`/`verification.json`의96자산·7장면·갤러리 완료와 공식 검사 오류0·경고0을 확인했어. 자세한 수치·대표 잔상·모바일·다운로드·텍스처·정보 메시지는 그 기록을 읽어줘. 월드 비용은 실제 기록상Meshy{context['credits']:g}크레딧·이미지생성{context['images']:g}건이며 과거 무기/VFX 비용과 구별해줘.
- 종항에는 시장·공방을 함께 놓고 후반4곳은 작은 원정 정박, 황궁은 조용한 서비스 갑판이야. world-map-diorama는 정사6지역 마커/선택 항로 비교이며 실제 지리·게임 좌표·해금은 미확정이야. 새 로컬 무기/VFX/월드의 원격 반영을 가정하지 말고 Git 상태를 확인해줘. 다음 추천은 엔진·표준 소켓에 작은 정박 장면과 한 공격 순환을 연결하는 것이며 새 유료 생성/자동화를 자동 시작하지 마.
"""


def update_readme(text, counts):
    world_rows = ("| 월드 기본팩 96종 | [월드 갤러리](outputs/world-assets/gallery.html) · [3D 작업대](outputs/world-assets/index.html) | 주요 건물6·모듈90의 실제3D 외형 원형 |\n"
                  "| 월드 조립 장면 7종 | [지역·지도 조립 비교](outputs/world-assets/scenes.html) | 정사6지역과 지도 디오라마, 독립 자산과 별도 집계 |\n")
    text = re.sub(r"^\| 월드 (?:기본팩 96종|조립 장면 7종) \|.*\n", "", text, flags=re.M)
    anchor = next((line for line in text.splitlines() if line.startswith("| 감성판 최종 기획서 |")), None)
    if not anchor:
        raise ValueError("README quick-links table anchor changed; preserve the document manually")
    text = text.replace(anchor, world_rows + anchor, 1)
    paragraph = (f"현재 로컬 자산은 PNG {counts['png']:,}개와 GLB {counts['glb']:,}개, 합계 약 {counts['bytes'] / 1e9:.2f} GB입니다. "
                 f"[자산 목록](docs/asset-inventory.json)에 실제 {counts['count']:,}개 파일의 크기와 SHA-256을 기록했습니다. "
                 "`python tools/verify-assets.py`로 무결성을 검사할 수 있습니다. 이 파일 수에는 원본·법선 수정본·지붕 보강본·합성 장면이 각각 들어가므로 월드 독립96자산과 다릅니다. "
                 "이번 무기·VFX·월드 새 자료와 최신 문서는 로컬 작업 결과이며 과거 원격 업로드에 포함되었다고 가정하지 마세요. 이 갱신 도구는 git commit/push하지 않습니다.")
    text, replaced = re.subn(r"^현재(?: 로컬)? 자산은 .+$", lambda _: paragraph, text, count=1, flags=re.M)
    if replaced != 1:
        raise ValueError("README current-inventory paragraph changed; no blind rewrite")
    if not re.search(r"^  world-assets/", text, flags=re.M):
        text = text.replace("  handoff/", "  world-assets/             주요 건물6·로컬 모듈90·조립 장면7과 오프라인 작업대\n  handoff/", 1)
    return text


def tooling_section():
    return """## 월드 기본팩

`tools/world-assets/README.md`에 실제96자산과7조립 장면의 제작·뷰어·캡처 사용법이 있습니다. 원본·법선 수정본·별도 지붕 보강본을 구분하며 엔진 소켓·충돌·navmesh·LOD·내부·상호작용은 후속 작업입니다. 법선 보정과 지붕 라이너 추가는 서로 다른 단계이며 원래2K텍스처 바이트를 보존합니다. 아래 빌드/검사/문서 도구는 외부 생성·인증·git push를 수행하지 않습니다. 생성/재현 명령은 로컬 산출물을 다시 쓰므로 현재 변경과 원본을 먼저 보존합니다.

```sh
node tools/world-assets/build.cjs
node tools/world-assets/build.cjs outputs/world-assets/scene-catalog.json outputs/world-assets/scenes.html
node tools/world-assets/capture.cjs
node tools/world-assets/gallery.cjs
node tools/qa/world-workbench.cjs outputs/world-assets/index.html work/verification/world-assets outputs/world-assets/catalog.json all 96
node tools/qa/world-workbench.cjs outputs/world-assets/scenes.html work/verification/world-scenes outputs/world-assets/scene-catalog.json all 7
python tools/world-assets/handoff.py --dry-run
python tools/world-assets/handoff.py --write
python tools/verify-assets.py
```

부분 QA는 네 번째 인수의 `all` 대신 쉼표로 구분한 ID를 사용합니다. `gallery.html?overview=1`은 주요 건물6개와7장면만 표시하며 독립96개와 구별합니다. `handoff.py`는 최종 delivery/progress/verification과 실제 모델/해시가 모두 준비됐을 때만 문서·outputs/handoff 사본·현재 자산 inventory를 갱신합니다. `--dry-run`이나 기본 실행은 읽기 전용입니다. 표준 inventory 재계산은 기존 `tools/verify-assets.py --write`를 호출합니다.
"""


def changes(context, counts):
    handoff_path, prompt_path = ROOT / "docs/HANDOFF.md", ROOT / "docs/CONTINUE_PROMPT.md"
    handoff = handoff_path.read_text(encoding="utf-8-sig")
    if "## 16." in handoff and "<!-- WORLD-ASSETS-HANDOFF BEGIN -->" not in handoff:
        raise ValueError("An unmarked section16 already exists; preserve it rather than overwrite")
    handoff = replace_block(handoff, "WORLD-ASSETS-HANDOFF", section16(context))
    prompt = replace_block(prompt_path.read_text(encoding="utf-8-sig"), "WORLD-ASSETS-CONTINUE", continue_state(context), before="- 시스템 기준은")
    readme = update_readme((ROOT / "README.md").read_text(encoding="utf-8-sig"), counts)
    tools_readme = (ROOT / "tools/README.md").read_text(encoding="utf-8-sig")
    tools_readme = re.sub(r"로 [\d,]+개 PNG/GLB의", f"로 {counts['count']:,}개 PNG/GLB의", tools_readme)
    tools_readme = replace_block(tools_readme, "WORLD-ASSETS-TOOLS", tooling_section())
    return {handoff_path: handoff, prompt_path: prompt, ROOT / "README.md": readme, ROOT / "tools/README.md": tools_readme,
            ROOT / "outputs/handoff/HANDOFF.md": handoff, ROOT / "outputs/handoff/CONTINUE_PROMPT.md": prompt}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true", help="Write documents/inventory only after the final completion gate passes")
    mode.add_argument("--dry-run", action="store_true", help="Read-only final gate and proposed change summary (default)")
    parser.add_argument("--delivery", type=Path, default=BASE / "delivery-summary.json")
    parser.add_argument("--progress", type=Path, default=BASE / "progress.json")
    parser.add_argument("--verification", type=Path, default=BASE / "verification.json")
    args = parser.parse_args()
    for name in ("delivery", "progress", "verification"):
        path = getattr(args, name)
        setattr(args, name, path if path.is_absolute() else ROOT / path)
    context = final_context(args)
    counts = inventory_counts()
    updates = changes(context, counts)  # Validate anchors before inventory mutation.
    if args.write:
        subprocess.run([sys.executable, str(ROOT / "tools/verify-assets.py"), "--write"], cwd=ROOT, check=True)
        inventory = read_json(ROOT / "docs/asset-inventory.json")
        counts = inventory_counts(inventory)
        updates = changes(context, counts)
        for path, content in updates.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content.rstrip() + "\n", encoding="utf-8")
        subprocess.run([sys.executable, str(ROOT / "tools/verify-assets.py")], cwd=ROOT, check=True)
        for name in ("HANDOFF.md", "CONTINUE_PROMPT.md"):
            if digest(ROOT / "docs" / name) != digest(ROOT / "outputs/handoff" / name):
                raise ValueError("Handoff copy differs from its source")
    print(json.dumps({"passed_final_gate": True, "write": args.write, "world_assets": 96, "scene_studies": 7,
                      "hero_originals": context["original_count"], "normal_copies": context["normal_copy_count"],
                      "roof_copies": context["roof_copy_count"],
                      "inventory": counts, "files": [path.relative_to(ROOT).as_posix() for path in updates],
                      "models_images_changed": False, "git_commit_push": False}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as error:
        print("Handoff update stopped without claiming completion: " + str(error), file=sys.stderr)
        raise SystemExit(2)
