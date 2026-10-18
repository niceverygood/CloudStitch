"""Package the finalized Cloudstitch world art; no raw service data or caches."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BASE = ROOT / "outputs/world-assets"
ARCHIVE_NAME = "Cloudstitch-world-assets.zip"


def read_json(file):
    return json.loads(file.read_text(encoding="utf-8-sig"))


def digest(file):
    value = hashlib.sha256()
    with file.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def safe_file(base, name):
    if not isinstance(name, str) or not name or "\\" in name or ":" in name:
        raise ValueError(f"Unsafe package relative path: {name!r}")
    file = (base / name).resolve()
    if not file.is_relative_to(base.resolve()) or not file.is_file() or file.stat().st_size <= 0:
        raise ValueError(f"Missing, empty or outside-root package source: {name}")
    return file


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base", nargs="?", type=Path, default=DEFAULT_BASE)
    args = parser.parse_args(); base = args.base.resolve()
    catalog = read_json(safe_file(base, "catalog.json"))
    scene_catalog = read_json(safe_file(base, "scene-catalog.json"))
    progress = read_json(safe_file(base, "progress.json"))
    verification = read_json(safe_file(base, "verification.json"))
    assets = read_json(safe_file(base, "asset-manifest.json"))
    if len(catalog["items"]) != 96 or len(scene_catalog["items"]) != 7 or progress.get("remaining") != [] or progress.get("browser_verification_pending") is not False:
        raise ValueError("Only the fully finalized 96-asset / seven-scene pack may be packaged.")
    if verification.get("passed") is not True or verification.get("standard_validator", {}).get("files") != 103 or any(verification["standard_validator"].get(key) != 0 for key in ("errors", "warnings")) or verification.get("browser_assets", {}).get("passed") is not True or verification.get("browser_assets", {}).get("models") != 96 or verification.get("browser_scenes", {}).get("passed") is not True or verification.get("browser_scenes", {}).get("models") != 7 or verification.get("gallery", {}).get("passed") is not True:
        raise ValueError("Complete actual GLB, browser and gallery verification is required.")
    registry = {item["id"]: item for item in catalog["items"] + scene_catalog["items"]}
    records = assets.get("records", [])
    if len(registry) != 103 or len(records) != 103 or {record["id"] for record in records} != set(registry):
        raise ValueError("Final asset manifest must register every one of the 103 unique models.")
    files = {}

    def add(archive_path, source):
        if archive_path.startswith("/") or "\\" in archive_path or any(part in ("", ".", "..") for part in archive_path.split("/")):
            raise ValueError(f"Unsafe archive path: {archive_path}")
        if any(part in ("work", "node_modules", "meshy_output", ".git", "__pycache__") for part in archive_path.split("/")) or Path(archive_path).name.lower() in ("state.json", ".env") or archive_path.lower().endswith(".zip"):
            raise ValueError(f"Cache, state, secret or nested archive is forbidden: {archive_path}")
        if archive_path in files and files[archive_path] != source:
            raise ValueError(f"Conflicting duplicate archive path: {archive_path}")
        files[archive_path] = source

    def add_local(name):
        add(name, safe_file(base, name))

    def add_registered(record):
        file = safe_file(base, record["path"])
        if file.stat().st_size != record["bytes"] or digest(file) != record["sha256"]:
            raise ValueError(f"Finalized source changed before packaging: {record['path']}")
        add(record["path"], file)

    for name in ("index.html", "scenes.html", "gallery.html", "gallery-overview.html", "overview.png", "README.txt", "art-review-notes.txt", "production-spec.json",
                 "catalog.json", "scene-catalog.json", "progress.json", "asset-manifest.json", "verification.json",
                 "delivery-summary.txt", "delivery-summary.json"):
        add_local(name)
    for record in records:
        item = registry[record["id"]]
        expected_status = "completed_world_asset_prototype" if record["kind"] == "asset" else "completed_world_scene_prototype"
        if item.get("status") != expected_status or item.get("model") != record["model"]["path"] or item.get("sha256") != record["model"]["sha256"]:
            raise ValueError(f"Catalog completion/hash changed: {item['id']}")
        for key in ("model", "manifest", "preview"):
            add_registered(record[key])
        manifest = read_json(files[record["manifest"]["path"]])
        if manifest.get("verification", {}).get("passed") is not True or manifest.get("sha256") != record["model"]["sha256"]:
            raise ValueError(f"Final model verification changed: {item['id']}")
        if record.get("preserved_original"):
            add_registered(record["preserved_original"])
            add_registered(record["reference"])
        if record.get("normal_repair"):
            add_registered(record["normal_repair"]["log"])
            log = read_json(files[record["normal_repair"]["log"]["path"]])
            for key in ("original_source", "repaired_source"):
                source = log[key]
                add_registered({"path": source["model"], "bytes": source["bytes"], "sha256": source["sha256"]})
        if record.get("roof_repair"):
            roof = record["roof_repair"]
            for key in ("log", "base_normal_copy", "registered_roof_copy"):
                add_registered(roof[key])
            log = read_json(files[roof["log"]["path"]])
            for key in ("original_source", "base_normal_copy", "repaired_source"):
                source = log[key]
                add_registered({"path": source["model"], "bytes": source["bytes"], "sha256": source["sha256"]})
            for key in ("page", "comparison"):
                add_registered(roof["review"][key])
            for image in roof["review"]["images"]:
                add_registered(image)
        # Additional authored corrections must be explicitly registered with role,
        # relative model path and byte hash; no directory glob of service output.
        for copy in manifest.get("additional_model_copies", []):
            if not copy.get("role") or not copy.get("sha256") or not copy.get("bytes"):
                raise ValueError("Additional model copies need role, bytes and SHA-256 provenance.")
            add_registered({"path": copy["model"], "bytes": copy["bytes"], "sha256": copy["sha256"]})
            if copy.get("log"):
                add_local(copy["log"])
        if record.get("reference"):
            hero_dir = Path(record["reference"]["path"]).parent.as_posix()
            for filename in ("reference-prompt.txt", "reference-cleanup-prompt.txt", "art-review.txt"):
                name = hero_dir + "/" + filename
                if (base / name).is_file():
                    add_local(name)
    for canonical in assets.get("canonical_sources", []):
        source = safe_file(ROOT, canonical["repository_path"])
        if source.stat().st_size != canonical["bytes"] or digest(source) != canonical["sha256"]:
            raise ValueError("Canonical source changed after finalization.")
        add(canonical["package_path"], source)
    for optional in ("assembly-layout.json", "art-review.txt", "preview-contact-sheet.png"):
        if (base / optional).is_file():
            add_local(optional)
    # Sources are useful for review/rebuild, but installed dependencies/caches and
    # credentials are never required to view the three embedded offline HTMLs.
    source_roots = [(ROOT / "tools/world-assets", "source/tools/world-assets")]
    for directory, archive_dir in source_roots:
        for source in sorted(directory.iterdir()):
            if source.is_file() and source.suffix.lower() in (".js", ".mjs", ".cjs", ".html", ".md", ".py"):
                add(archive_dir + "/" + source.name, source)
    for name in ("tools/qa/world-gltf.cjs", "tools/qa/world-workbench.cjs", "tools/qa/world-gallery.cjs", "tools/qa/world-package.cjs",
                 "tools/lib/runtime.cjs", "tools/lib/paths.cjs", "package.json", "package-lock.json"):
        add("source/" + name, safe_file(ROOT, name))
    work = ROOT / "work/world-assets-package"; work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=work) as directory:
        temporary = Path(directory)
        source_note = temporary / "source-README.txt"
        source_note.write_text("Cloudstitch world pack — source notes\n\n"
                               "Open ../gallery.html, ../index.html or ../scenes.html directly; viewing requires no Node installation.\n"
                               "Source is retained under source/ for review and reuse. npm ci installs the locked Node dependencies.\n"
                               "The full repository uses outputs/world-assets/. To run generation/finalization tools with their default paths, copy this pack's asset files into source/outputs/world-assets/ or use the CloudStitch repository.\n"
                               "Viewer build accepts explicit paths: from source/, node tools/world-assets/build.cjs ../catalog.json ../index.html.\n"
                               "Python metadata tools require Pillow. Official validator tools additionally require the Khronos gltf-validator module; its work/ installation is intentionally excluded.\n"
                               "Scene regeneration references the selected airship in the full repository; existing scene GLBs and offline viewers already embed that geometry/texture and do not need an external airship file.\n"
                               "No state.json, raw Meshy responses, service cache, account credentials, node_modules or nested ZIP is included.\n", encoding="utf-8")
        add("source/README.txt", source_note)
        entries = [{"path": name, "bytes": source.stat().st_size, "sha256": digest(source)} for name, source in sorted(files.items())]
        manifest = {"schema_version": 1, "game_title": "Cloudstitch", "package": ARCHIVE_NAME,
                    "independent_assets": 96, "composed_scenes": 7, "registered_models": 103,
                    "preserved_hero_originals": 6,
                    "archive_glb_files": sum(entry["path"].endswith(".glb") for entry in entries),
                    "entries": entries, "hash_algorithm": "SHA-256",
                    "scope": "Assets-first offline viewing archive; source/ is supplemental review/rebuild material.",
                    "source_art_modified": False,
                    "manifest_note": "Every entry is byte-hashed against its source, including this manifest's exact serialized bytes. Its recursive own hash is omitted from entries; the final archive SHA is recorded externally."}
        encoded = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        archive = temporary / ARCHIVE_NAME
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as output:
            for entry in entries:
                output.write(files[entry["path"]], entry["path"])
            output.writestr("package-manifest.json", encoded)
        with zipfile.ZipFile(archive) as output:
            if output.testzip() is not None or len(output.namelist()) != len(entries) + 1 or len(set(output.namelist())) != len(entries) + 1:
                raise ValueError("Archive CRC/count/unique path check failed.")
            if output.read("package-manifest.json") != encoded:
                raise ValueError("Archive manifest bytes changed.")
            for entry in entries:
                data = output.read(entry["path"])
                if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"] or digest(files[entry["path"]]) != entry["sha256"]:
                    raise ValueError(f"Archive/source byte hash mismatch: {entry['path']}")
        archive_digest, archive_bytes = digest(archive), archive.stat().st_size
        verification_text = (f"Cloudstitch world asset package verification\n"
                             f"Archive: {ARCHIVE_NAME}\nBytes: {archive_bytes}\nSHA-256: {archive_digest}\n"
                             f"ZIP entries: {len(entries) + 1}\nRegistered independent GLBs: 96\nRegistered scene GLBs: 7\n"
                             f"Preserved hero originals: 6\nArchive GLB files including preserved copies: {manifest['archive_glb_files']}\n"
                             f"Every archive entry/source SHA-256 and byte count matched. CRC and duplicate-path checks passed.\n"
                             "Original PNG/GLB/source documents were read without modification.\n"
                             "Fresh-extraction browser independence verification is a separate tools/qa/world-package.cjs run.\n"
                             "This is visual prototype delivery, not an implemented game or engine performance acceptance.\n")
        (base / "package-manifest.json").write_bytes(encoded)
        os.replace(archive, base / ARCHIVE_NAME)
        (base / "package-verification.txt").write_text(verification_text, encoding="utf-8")
    print(json.dumps({"zip": "outputs/world-assets/" + ARCHIVE_NAME, "bytes": archive_bytes,
                      "sha256": archive_digest, "entries": len(entries) + 1,
                      "registered_models": 103, "archive_glb_files": manifest["archive_glb_files"],
                      "entry_hashes_match": True, "source_art_modified": False}, ensure_ascii=False))


if __name__ == "__main__":
    main()
