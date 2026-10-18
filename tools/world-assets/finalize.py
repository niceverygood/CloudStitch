"""Finalize the checked 96-asset / seven-scene world pack without editing art."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import tempfile

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASE = ROOT / "outputs/world-assets"
ASSET_STATUS = "completed_world_asset_prototype"
SCENE_STATUS = "completed_world_scene_prototype"


def read_json(file: Path):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def sha256(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def local_file(base: Path, name: str) -> Path:
    if not isinstance(name, str) or not name or "\\" in name or ":" in name:
        raise ValueError(f"Unsafe or missing relative file: {name!r}")
    result = (base / name).resolve()
    if not result.is_relative_to(base.resolve()) or not result.is_file() or not result.stat().st_size:
        raise ValueError(f"Missing, empty or outside-pack file: {name}")
    return result


def file_record(base: Path, name: str) -> dict:
    file = local_file(base, name)
    return {"path": name, "bytes": file.stat().st_size, "sha256": sha256(file)}


def inspect_glb(file: Path) -> dict:
    with file.open("rb") as stream:
        header = stream.read(20)
        if len(header) != 20:
            raise ValueError(f"Truncated GLB: {file.name}")
        magic, version, length, json_length, chunk_type = struct.unpack("<5I", header)
        if magic != 0x46546C67 or version != 2 or length != file.stat().st_size or chunk_type != 0x4E4F534A:
            raise ValueError(f"Invalid glTF 2 GLB header: {file.name}")
        document = json.loads(stream.read(json_length).decode("utf-8"))
    for resource in document.get("buffers", []) + document.get("images", []):
        uri = resource.get("uri")
        if uri and not uri.startswith("data:"):
            raise ValueError(f"External GLB resource URI is not portable: {file.name}")
    return {"schema": "glTF 2.0 GLB", "embedded_resources_only": True,
            "animation_count": len(document.get("animations", []))}


def inspect_png(base: Path, name: str, require_rgba: bool = False) -> dict:
    file = local_file(base, name)
    with Image.open(file) as image:
        image.load()
        if image.format != "PNG" or min(image.size) <= 0:
            raise ValueError(f"Expected a real PNG preview: {name}")
        if require_rgba and image.mode != "RGBA":
            raise ValueError(f"Native transparent WebGL preview must be RGBA: {name}")
        alpha = image.getchannel("A") if "A" in image.getbands() else None
        bounds = alpha.getbbox() if alpha is not None else (0, 0, *image.size)
        if require_rgba and bounds is None:
            raise ValueError(f"Preview is fully transparent: {name}")
        metadata = {"schema": "PNG", "width": image.width, "height": image.height,
                    "mode": image.mode, "bands": list(image.getbands()),
                    "rgba": image.mode == "RGBA", "alpha_bounds": list(bounds) if bounds else None,
                    "inspection": "Read-only Pillow decode; original PNG bytes preserved."}
    return {**file_record(base, name), **metadata}


def checked_catalog(catalog: dict, definitions: list, count: int, status: str) -> list:
    items = catalog.get("items", [])
    expected = {item["id"] for item in definitions}
    if len(items) != count or len(expected) != count or {item.get("id") for item in items} != expected:
        raise ValueError(f"Catalog must contain exactly the {count} declared, unique ids.")
    if any(item.get("status") != status for item in items):
        raise ValueError("Pending/failed assets cannot be finalized.")
    return items


def compact_browser_report(file: Path, items: list) -> dict:
    report = read_json(file)
    models = report.get("models", [])
    expected = {item["id"]: item for item in items}
    if report.get("passed") is not True or report.get("availableCount") != len(items):
        raise ValueError(f"Full browser QA did not pass: {file.name}")
    if len(models) != len(items) or {model.get("id") for model in models} != set(expected):
        raise ValueError("A partial model QA run is not full-pack verification.")
    for field in ("errors", "consoleErrors", "failedRequests", "externalRequests"):
        if report.get(field):
            raise ValueError(f"Browser QA reported {field}.")
    if report.get("mobile", {}).get("overflow") is not False:
        raise ValueError("Browser QA must explicitly verify mobile overflow is absent.")
    records = []
    for model in models:
        item = expected[model["id"]]
        source, download, stats = model.get("source", {}), model.get("download", {}), model.get("stats", {})
        if any(record.get("sha256") != item["sha256"] or record.get("bytes") != item["bytes"] for record in (source, download)):
            raise ValueError(f"QA source/download hash is stale: {item['id']}")
        if stats.get("triangleCount") != item["triangles"] or stats.get("texturesReady") is not True:
            raise ValueError(f"QA geometry/texture result is stale: {item['id']}")
        samples = model.get("samples", [])
        if {sample.get("mode") for sample in samples} != {"handdrawn", "cel", "original"} or any(not sample.get("finite") or not sample.get("texturesReady") or sample.get("visiblePixels", 0) <= 0 for sample in samples):
            raise ValueError(f"Missing actual three-mode render verification: {item['id']}")
        records.append({"id": item["id"], "sha256": source["sha256"], "bytes": source["bytes"],
                        "triangles": stats["triangleCount"], "textures_ready": True,
                        "modes": [{"mode": s["mode"], "visible_pixels": s["visiblePixels"], "finite": s["finite"]} for s in samples],
                        "download_matches_source": True})
    ghosting = report.get("ghosting", [])
    if not ghosting or any(g.get("changedPixels") != 0 or g.get("outlineAutoClear") is not True for g in ghosting):
        raise ValueError("Missing/pending outline ghosting regression check.")
    return {"passed": True, "source_report_sha256": sha256(file), "models": len(records),
            "model_results": records, "ghosting": ghosting,
            "mobile": report["mobile"], "errors": [], "external_requests": [],
            "scope": "Actual GLB loading, native WebGL renders and viewer controls; not gameplay or engine performance."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", nargs="?", type=Path, default=DEFAULT_BASE)
    parser.add_argument("--asset-qa", type=Path, default=ROOT / "work/verification/world-workbench/qa-result.json")
    parser.add_argument("--scene-qa", type=Path, default=ROOT / "work/verification/world-scenes/qa-result.json")
    parser.add_argument("--gallery-qa", type=Path, default=ROOT / "work/verification/world-gallery/qa-result.json")
    args = parser.parse_args()
    base = args.base.resolve()
    spec = read_json(local_file(base, "production-spec.json"))
    assets = checked_catalog(read_json(local_file(base, "catalog.json")), spec["assets"], 96, ASSET_STATUS)
    scenes = checked_catalog(read_json(local_file(base, "scene-catalog.json")), spec["scenes"], 7, SCENE_STATUS)
    heroes = [item for item in assets if item.get("build_method") == "hero_meshy"]
    if len(heroes) != 6 or sum(item.get("build_method") == "local_mesh" for item in assets) != 90:
        raise ValueError("Expected six downloaded hero buildings and 90 original local modules.")
    records, originals, references, task_trail = [], [], [], []
    roof_review_pngs = 0
    errors = warnings = infos = repaired_normals = 0
    for kind, items in (("asset", assets), ("scene", scenes)):
        for item in items:
            manifest_path = item.get("manifest", f"manifests/{item['id']}.json")
            manifest_file = local_file(base, manifest_path)
            manifest = read_json(manifest_file)
            model = file_record(base, item["model"])
            if any(manifest.get(field) != item.get(field) for field in ("id", "model", "status", "triangles", "animation_count")):
                raise ValueError(f"Catalog and manifest disagree: {item['id']}")
            if any(record.get("sha256") != model["sha256"] or record.get("bytes") != model["bytes"] for record in (item, manifest)):
                raise ValueError(f"Actual model bytes do not match registered hashes: {item['id']}")
            validation = manifest.get("standard_validator", manifest.get("verification", {}).get("standard_validator", {}))
            if manifest.get("verification", {}).get("passed") is not True or validation.get("errors") != 0 or validation.get("warnings") != 0:
                raise ValueError(f"Registered GLB has no clean official verification: {item['id']}")
            glb = inspect_glb(local_file(base, item["model"]))
            if glb["animation_count"] != 0 or item["animation_count"] != 0:
                raise ValueError("This world pack is static; do not invent rigging/animation completion.")
            preview = inspect_png(base, item["preview"], require_rgba=True)
            record = {"id": item["id"], "kind": kind, "name_ko": item.get("name_ko"),
                      "category": item.get("category"), "build_method": item["build_method"],
                      "status": item["status"], "model": model,
                      "manifest": file_record(base, manifest_path), "preview": preview,
                      "triangles": manifest["triangles"], "mesh_count": manifest["mesh_count"],
                      "texture_count": manifest["texture_count"], "animation_count": 0,
                      "standard_validator": {key: validation.get(key, 0) for key in ("errors", "warnings", "infos")},
                      "embedded_resources_only": True}
            errors += validation["errors"]; warnings += validation["warnings"]; infos += validation.get("infos", 0)
            if item["build_method"] == "hero_meshy":
                original = file_record(base, item["source_model"])
                inspect_glb(local_file(base, item["source_model"]))
                if original["sha256"] != item.get("source_sha256") or original["sha256"] != manifest.get("source_sha256") or manifest.get("original_source_preserved") is not True:
                    raise ValueError(f"Preserved hero original changed: {item['id']}")
                record["preserved_original"] = original
                originals.append({"id": item["id"], **original})
                reference = inspect_png(base, item.get("reference", f"hero/{item['id']}/reference.png"))
                references.append({"id": item["id"], **reference}); record["reference"] = reference
                repair = item.get("normal_repair")
                if repair:
                    log_file = local_file(base, repair["log"]); log = read_json(log_file)
                    normal_copy = file_record(base, log["repaired_source"]["model"])
                    inspect_glb(local_file(base, normal_copy["path"]))
                    if log.get("original_source", {}).get("sha256") != original["sha256"] or log.get("repaired_source", {}).get("sha256") != normal_copy["sha256"] or repair.get("repaired_sha256") != normal_copy["sha256"] or log.get("after", {}).get("errors") != 0 or log.get("original_source_preserved") is not True:
                        raise ValueError(f"Normal repair provenance is stale: {item['id']}")
                    count = log.get("changes", {}).get("normal_vectors_repaired", 0)
                    repaired_normals += count
                    record["normal_repair"] = {"log": file_record(base, repair["log"]), "normal_vectors_repaired": count,
                                               "model": normal_copy,
                                               "original_sha256": original["sha256"], "repaired_sha256": normal_copy["sha256"],
                                               "geometry_topology_and_texture_preserved": True}
                    if not item.get("roof_repair_log") and normal_copy["sha256"] != model["sha256"]:
                        raise ValueError(f"Registered hero is not its declared normal copy: {item['id']}")
                if item.get("roof_repair_log"):
                    roof_file = local_file(base, item["roof_repair_log"]); roof = read_json(roof_file)
                    if not repair or item.get("roof_repair") != roof or manifest.get("roof_repair") != roof or manifest.get("roof_repair_log") != item["roof_repair_log"]:
                        raise ValueError(f"Roof correction catalog/manifest/log disagreement: {item['id']}")
                    for key, expected in (("original_source", original), ("base_normal_copy", normal_copy), ("repaired_source", model)):
                        source = roof.get(key, {})
                        if source.get("model") != expected["path"] or source.get("sha256") != expected["sha256"] or source.get("bytes") != expected["bytes"]:
                            raise ValueError(f"Roof {key} byte provenance is stale: {item['id']}")
                    if roof.get("after", {}).get("errors") != 0 or roof.get("after", {}).get("warnings") != 0 or roof.get("after", {}).get("triangles") != manifest["triangles"] or roof.get("after", {}).get("mesh_count") != manifest["mesh_count"] or roof.get("original_source_preserved") is not True or roof.get("base_normal_copy_preserved") is not True:
                        raise ValueError(f"Roof correction validation is incomplete: {item['id']}")
                    review = roof.get("visual_comparison", {})
                    if not review.get("status", "").startswith("completed") or review.get("textures_decoded") is not True or review.get("browser_errors") or review.get("external_requests") or len(review.get("views", [])) != 4:
                        raise ValueError(f"Roof four-direction render review is incomplete: {item['id']}")
                    review_images = []
                    for view in review["views"]:
                        review_images.extend(inspect_png(base, view[key]) for key in ("before", "after"))
                    roof_review_pngs += len(review_images)
                    comparison = review["directory"] + "/render-comparison.json"
                    if read_json(local_file(base, comparison)) != review:
                        raise ValueError(f"Roof comparison record is stale: {item['id']}")
                    record["roof_repair"] = {"role": "Registered roof-backing derivative; preserved normal-only copy remains separate.",
                                              "log": file_record(base, item["roof_repair_log"]),
                                              "base_normal_copy": normal_copy, "registered_roof_copy": model,
                                              "original_sha256": original["sha256"],
                                              "added_meshes": roof["added_geometry"]["mesh_count"],
                                              "added_triangles": roof["added_geometry"]["triangles"],
                                              "review": {"page": file_record(base, review["page"]),
                                                         "comparison": file_record(base, comparison), "images": review_images},
                                              "original_textured_geometry_preserved": True,
                                              "scope": "Thin local roof backing; not global watertight remeshing."}
                credits = manifest.get("consumed_credits")
                if credits != 15 or not manifest.get("task_id") or not manifest.get("operation_id"):
                    raise ValueError(f"Missing audited Meshy task/15-credit trail: {item['id']}")
                task_trail.append({"id": item["id"], "task_id": manifest["task_id"], "operation_id": manifest["operation_id"], "consumed_credits": credits})
            elif kind == "asset" and manifest.get("consumed_credits") != 0:
                raise ValueError("Local geometry must not be reported as paid generation.")
            if kind == "scene":
                if manifest.get("original_sources_unchanged") is not True or manifest.get("mesh_images_reused_per_source") is not True or not manifest.get("placements"):
                    raise ValueError(f"Scene assembly provenance is incomplete: {item['id']}")
                source_records = []
                for source in manifest.get("source_assets", []):
                    if source["asset_id"].startswith("@"):
                        if source["asset_id"] == "@selected-airship":
                            source_path = (base / source["model"]).resolve()
                            if not source_path.is_relative_to(ROOT) or sha256(source_path) != source["sha256"]:
                                raise ValueError("The selected airship original changed during scene assembly.")
                            source_records.append({"id": source["asset_id"], "original_sha256": source["sha256"],
                                                   "embedded_copy_sha256": source["embedded_copy_sha256"],
                                                   "copy_only_zero_normals_repaired": source["copied_zero_normals_repaired"],
                                                   "runtime_external_dependency": False})
                        continue
                    if file_record(base, source["model"])["sha256"] != source["sha256"]:
                        raise ValueError(f"Scene's registered source changed: {source['asset_id']}")
                    source_records.append({"id": source["asset_id"], "sha256": source["sha256"], "instances": source["instances"]})
                record["assembly_sources"] = source_records
                record["assembly_layout"] = {"manifest": manifest_path, "placements": len(manifest["placements"]),
                                             "relative_design_units_only": True, "game_map_or_progression": False}
            records.append(record)
    canonical = []
    for name in spec.get("canonical_sources", []):
        file = local_file(ROOT, name)
        canonical.append({"repository_path": name, "package_path": "canonical/" + file.name,
                          "bytes": file.stat().st_size, "sha256": sha256(file)})
    qa_assets = compact_browser_report(args.asset_qa, assets)
    qa_scenes = compact_browser_report(args.scene_qa, scenes)
    source = read_json(args.gallery_qa)
    if source.get("passed") is not True or source.get("assets") != 96 or source.get("scenes") != 7 or source.get("cards") != 103 or source.get("brokenLinks") != [] or source.get("overview") != 13 or source.get("mobile", {}).get("overflow") is not False or source.get("errors") or source.get("externalRequests"):
        raise ValueError("Final gallery QA did not pass.")
    gallery = {"passed": True, "source_report_sha256": sha256(args.gallery_qa),
               "assets": source["assets"], "scenes": source["scenes"], "cards": source["cards"],
               "links": source["links"], "brokenLinks": [], "overview": source["overview"], "mobile": source["mobile"],
               "scope": "Actual gallery cards, decoded preview images and relative links checked in browser."}
    generated = datetime.now(timezone.utc).isoformat()
    limits = ["실행 가능한 게임이 아닌 정적 월드 3D 아트 원형과 조립 배치 비교입니다.",
              "96개 독립 자산과 7개 재사용 조립 장면을 별도 집계합니다. 조립 장면을 새 독립 자산으로 세지 않습니다.",
              "엔진·플랫폼·미터/U·성능 예산·일정은 미확정입니다. 상대 단위 배치만 기록했습니다.",
              "충돌·navmesh·LOD·건물 내부·상호작용·물리·저장·전투·최종 소켓은 미구현입니다.",
              "손그림·셀 명암·윤곽선은 HTML 뷰어 런타임 기능이며 GLB만 가져오면 자동 재현되지 않습니다.",
              "hero 원본의 작은 normal 오류는 별도 수정본과 로그로 구별합니다. 원본 bytes는 보존합니다.",
              "여관·공방은 normal-only 복사본 위에 국소 지붕 안감을 더한 별도 등록본입니다. 방수 리메시나 완성 실내가 아닙니다.",
              "선택 비행선은 종항 합성 GLB 내부 복사본에 포함됩니다. 원본 파일은 변경하지 않았습니다.",
              "후반 4곳은 원정 정박 시안이며 새 도시·새 정사 시설·진행 잠금을 추가하지 않습니다.",
              "PNG는 실제 GLB의 브라우저 렌더이며 읽기 전용 메타 검사 외에 이미지 후편집하지 않았습니다.",
              "뷰어·파일 검증은 실제 게임 재미·밸런스·최종 엔진 성능 검증이 아닙니다."]
    counts = {"independent_assets": 96, "hero_buildings": 6, "local_modules": 90,
              "assembled_scenes": 7, "registered_models": 103, "native_preview_pngs": 103,
              "preserved_hero_originals": 6, "hero_reference_pngs": 6,
              "normal_only_hero_copies": sum("normal_repair" in record for record in records),
              "registered_roof_derivatives": sum("roof_repair" in record for record in records),
              "additional_roof_review_pngs": roof_review_pngs,
              "registered_model_bytes": sum(r["model"]["bytes"] for r in records),
              "registered_triangle_instances": sum(r["triangles"] for r in records),
              "categories": dict(sorted(Counter(item["category"] for item in assets).items()))}
    costs = {"currency": "Meshy credits", "hero_tasks": task_trail,
             "reported_consumed_credits": sum(t["consumed_credits"] for t in task_trail),
             "local_generation_consumed_credits": 0,
             "basis": "Whitelisted consumed_credits from completed task manifests; no balance inference, raw responses or credentials."}
    verification = {"schema_version": 1, "game_title": "Cloudstitch", "generated_at_utc": generated,
                    "passed": True, "counts": counts, "all_model_hashes_match": True,
                    "all_preserved_original_hashes_match": True, "native_preview_decodes": 103,
                    "standard_validator": {"files": 103, "errors": errors, "warnings": warnings, "infos": infos},
                    "normal_repairs": {"hero_registered_vectors": repaired_normals, "original_sources_preserved": True},
                    "browser_assets": qa_assets, "browser_scenes": qa_scenes, "gallery": gallery,
                    "limits": limits}
    asset_manifest = {"schema_version": 1, "game_title": "Cloudstitch", "generated_at_utc": generated,
                      "counts": counts, "records": records, "preserved_hero_originals": originals,
                      "hero_references": references, "costs": costs, "canonical_sources": canonical,
                      "limits": limits, "hash_algorithm": "SHA-256"}
    progress = {"schema_version": 1, "game_title": "Cloudstitch", "generated_at_utc": generated,
                "status": "completed_world_asset_and_scene_prototypes", "counts": counts,
                "completed_assets": [item["id"] for item in assets], "completed_scenes": [item["id"] for item in scenes],
                "remaining": [], "browser_verification_pending": False, "costs": costs,
                "entrypoints": {"gallery": "gallery.html", "assets": "index.html", "scenes": "scenes.html"},
                "verification": "verification.json", "asset_manifest": "asset-manifest.json", "limits": limits}
    lines = ["Cloudstitch · 클라우드스티치 월드 3D 기본팩", "", "실제 완료 범위",
             "- 독립 자산 96개: Meshy hero 건물 6개 + 로컬 정점 채색 모듈 90개",
             "- 재사용 조립 장면 7개: 정사 6지역의 비교 배치 + 별도 월드 맵 디오라마",
             "- 등록 GLB 103개 / 실제 브라우저 렌더 RGBA PNG 103장 / hero 기준 그림 6장",
             "- hero 원본 6개 보존. 사용한 normal 수정본·변경 수·해시는 각 repair-log와 manifest에 기록.",
             f"- 여관·공방 지붕 안감 파생본 2개를 등록. normal-only 복사본도 보존하며 추가 비교 PNG {roof_review_pngs}장은 주 프리뷰 103장과 별도 집계.",
             f"- 보고된 Meshy 비용: hero 6회 × 15 = {costs['reported_consumed_credits']} 크레딧. 로컬 모듈/장면 추가 비용 0.",
             "", "열기: gallery.html → index.html(독립 자산) / scenes.html(조립 장면)",
             "HTML은 실제 GLB와 Three.js를 내장하여 로컬 file://에서 열 수 있습니다.",
             "", "실제 검증", f"- 등록 GLB 103개 공식 형식 검사: 오류 {errors}, 경고 {warnings}, 정보 {infos}",
             "- 두 뷰어의 전체 모델·세 표시 모드·텍스처·다운로드 SHA-256 일치",
             "- 대표 120프레임 회전 잔상 차이 픽셀 0 / 외부 요청 0 / 모바일 넘침 없음",
             "- 등록 원본/수정본/프리뷰 bytes·SHA-256과 안전한 작업 ID·비용 근거: asset-manifest.json",
             "", "정사 기준 링크(저장소 원문 / ZIP 내 canonical 사본)"]
    lines.extend(f"- {record['repository_path']} / {record['package_path']}" for record in canonical)
    lines += ["", "한계"] + ["- " + line for line in limits]
    delivery = {"schema_version": 1, "game_title": "Cloudstitch", "generated_at_utc": generated,
                "independent_assets": 96, "composed_scenes": 7, "registered_models": 103,
                "hero_buildings": 6, "local_modules": 90, "new_meshy_credits": costs["reported_consumed_credits"],
                "new_AI_image_generations": 6,
                "image_count_basis": "Six existing hero reference PNGs for this requested world pack; native GLB browser captures are not counted as AI image generation.",
                "git": "Local uncommitted/unpushed world-pack outputs; this finalizer does not commit or push.",
                "canonical_sources": canonical, "task_trail": task_trail,
                "entrypoints": progress["entrypoints"], "verification": "verification.json",
                "asset_manifest": "asset-manifest.json", "limits": limits}
    outputs = {"delivery-summary.txt": ("\n".join(lines) + "\n").encode("utf-8"),
               "delivery-summary.json": (json.dumps(delivery, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
               "progress.json": (json.dumps(progress, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
               "asset-manifest.json": (json.dumps(asset_manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
               "verification.json": (json.dumps(verification, ensure_ascii=False, indent=2) + "\n").encode("utf-8")}
    work = ROOT / "work/world-finalize"; work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work) as directory:
        for name, data in outputs.items():
            file = Path(directory) / name; file.write_bytes(data)
        for name in outputs:
            os.replace(Path(directory) / name, base / name)
    print(json.dumps({"passed": True, "counts": counts, "consumed_credits": costs["reported_consumed_credits"],
                      "outputs": list(outputs), "source_art_modified": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
