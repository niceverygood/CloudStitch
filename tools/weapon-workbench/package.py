"""Package six verified Cloudstitch weapon prototypes without generation-session files.

Run only after all six items have completed their browser verification and captures:
    python tools/weapon-workbench/package.py
The standard library is sufficient. All model/reference files are read-only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import tempfile
import zipfile


REPO_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_IDS = (
    "01-machine-gun", "02-deck-cannon", "03-mortar",
    "04-harpoon", "05-chain-shot", "06-flamethrower",
)
COMPLETED = "completed_asset_prototype"
ROOT_REQUIRED = (
    "index.html", "gallery.html", "catalog.json", "progress.json",
    "production-spec.json", "README.txt", "art-review.txt", "delivery-summary.json",
)
PREVIEWS = (
    "preview-handdrawn.png", "preview-cel.png",
    "preview-original.png", "preview-mounted.png",
)
WEAPON_REQUIRED = (
    "reference.png", "reference-prompt.txt", "weapon.glb",
    "meshy-render.png", "manifest.json", *PREVIEWS,
)
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def read_json(file: Path) -> dict:
    return json.loads(file.read_text(encoding="utf-8-sig"))


def digest_file(file: Path) -> str:
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest_stream(stream) -> str:
    digest = hashlib.sha256()
    for chunk in iter(lambda: stream.read(1024 * 1024), b""):
        digest.update(chunk)
    return digest.hexdigest()


def require_file(source: Path, relative: str) -> Path:
    file = source / relative
    if not file.is_file() or file.stat().st_size == 0:
        raise ValueError(f"Missing or empty required deliverable: {relative}")
    if not file.resolve().is_relative_to(source.resolve()):
        raise ValueError(f"Unexpected deliverable path: {relative}")
    if file.suffix.lower() == ".png":
        with file.open("rb") as stream:
            if stream.read(8) != PNG_SIGNATURE:
                raise ValueError(f"Not an actual PNG; check Git LFS: {relative}")
    return file


def validate_completion(source: Path) -> tuple[dict, dict, list[dict]]:
    catalog = read_json(require_file(source, "catalog.json"))
    progress = read_json(require_file(source, "progress.json"))
    items = catalog.get("items", [])
    ids = [item.get("id") for item in items]
    if len(ids) != len(EXPECTED_IDS) or set(ids) != set(EXPECTED_IDS):
        raise ValueError("Catalog must contain exactly the six requested weapons before packaging.")
    requested = progress.get("requested_sequence", [])
    completed = progress.get("completed", [])
    if len(requested) != 6 or set(requested) != set(EXPECTED_IDS):
        raise ValueError("Progress requested_sequence must identify all six weapons.")
    if len(completed) != 6 or set(completed) != set(EXPECTED_IDS) or progress.get("remaining") != []:
        raise ValueError("All six weapons must be in progress.completed, with no remaining work.")
    item_by_id = {item["id"]: item for item in items}
    verification = []
    for identifier in EXPECTED_IDS:
        item = item_by_id[identifier]
        if item.get("status") != COMPLETED:
            raise ValueError(f"Catalog item is not a completed asset prototype: {identifier}")
        manifest = read_json(require_file(source, f"{identifier}/manifest.json"))
        if manifest.get("id") != identifier or manifest.get("status") != COMPLETED:
            raise ValueError(f"Manifest completion does not match its weapon: {identifier}")
        summary = manifest.get("verification_summary", {})
        if summary.get("passed") is not True:
            raise ValueError(f"Browser verification has not passed: {identifier}")
        if summary.get("errors") or summary.get("externalRequests") or summary.get("mobileOverflow"):
            raise ValueError(f"Manifest verification contains a failure: {identifier}")
        for preview in PREVIEWS:
            require_file(source, f"{identifier}/{preview}")
        glb = require_file(source, f"{identifier}/weapon.glb")
        with glb.open("rb") as stream:
            header = stream.read(12)
        if len(header) != 12 or struct.unpack("<III", header) != (0x46546C67, 2, glb.stat().st_size):
            raise ValueError(f"Not a complete binary glTF 2.0 model: {identifier}")
        actual_hash = digest_file(glb)
        if manifest.get("sha256") != actual_hash or manifest.get("model_bytes") != glb.stat().st_size:
            raise ValueError(f"Model differs from the verified manifest: {identifier}")
        verification.append({"id": identifier, "status": COMPLETED, "browser_verification_passed": True, "preview_count": 4, "model_sha256": actual_hash})
    return catalog, progress, verification


def package(source: Path, output: Path) -> dict:
    source = source.resolve()
    output = output.resolve()
    _, _, verification = validate_completion(source)
    # Explicit allowlist: no state.json, meshy_output, raw API response, work,
    # credentials, cache or unrelated source file can enter this archive.
    relative_files = list(ROOT_REQUIRED)
    if (source / "overview.png").is_file():
        relative_files.append("overview.png")
    for identifier in EXPECTED_IDS:
        relative_files.extend(f"{identifier}/{name}" for name in WEAPON_REQUIRED)
        optional = f"{identifier}/reference-cleanup-prompt.txt"
        if (source / optional).is_file():
            relative_files.append(optional)
    snapshots = []
    for relative in relative_files:
        file = require_file(source, relative)
        snapshots.append({"path": relative, "bytes": file.stat().st_size, "sha256": digest_file(file)})
    # This manifest is not published until the archive has passed its read-back
    # check. It cannot recursively list its own SHA-256, but its bytes are also
    # hashed and compared with the ZIP entry below.
    manifest = {
        "schema_version": 1,
        "game_title": "Cloudstitch",
        "package": output.name,
        "weapon_count": 6,
        "weapons": verification,
        "entries": snapshots,
        "package_manifest_entry": "package-manifest.json",
        "self_manifest_note": "Included verbatim. Its SHA-256 is checked during packaging, without a recursive self-hash field.",
        "verification": {
            "all_six_completed": True,
            "all_weapon_browser_verification_passed": True,
            "four_previews_per_weapon": True,
            "zip_entries_match_source_sha256": True,
            "excluded_generation_state_and_raw_responses": True,
        },
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    expected = {item["path"]: item for item in snapshots}
    expected["package-manifest.json"] = {
        "path": "package-manifest.json", "bytes": len(manifest_bytes),
        "sha256": hashlib.sha256(manifest_bytes).hexdigest(),
    }
    work = REPO_ROOT / "work" / "weapon-package"
    work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="verified-", dir=work) as temporary:
        temporary = Path(temporary)
        archive_path = temporary / output.name
        with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for record in snapshots:
                archive.write(source / record["path"], arcname=record["path"])
            archive.writestr("package-manifest.json", manifest_bytes)
        with zipfile.ZipFile(archive_path, "r") as archive:
            names = archive.namelist()
            if len(names) != len(expected) or set(names) != set(expected):
                raise ValueError("ZIP contains an unexpected, duplicate or missing entry.")
            if archive.testzip() is not None:
                raise ValueError("ZIP CRC validation failed.")
            for name, record in expected.items():
                info = archive.getinfo(name)
                with archive.open(name, "r") as stream:
                    actual_hash = digest_stream(stream)
                if info.file_size != record["bytes"] or actual_hash != record["sha256"]:
                    raise ValueError(f"ZIP byte verification failed: {name}")
                if name != "package-manifest.json" and digest_file(source / name) != record["sha256"]:
                    raise ValueError(f"Source changed while packaging: {name}")
        temporary_manifest = temporary / "package-manifest.json"
        temporary_manifest.write_bytes(manifest_bytes)
        output.parent.mkdir(parents=True, exist_ok=True)
        os.replace(temporary_manifest, source / "package-manifest.json")
        os.replace(archive_path, output)
    if digest_file(source / "package-manifest.json") != expected["package-manifest.json"]["sha256"]:
        raise ValueError("Published package manifest bytes differ from the verified ZIP.")
    return {
        "package": output.relative_to(REPO_ROOT).as_posix() if output.is_relative_to(REPO_ROOT) else output.name,
        "package_manifest": "outputs/weapon-modules/package-manifest.json" if source == (REPO_ROOT / "outputs/weapon-modules").resolve() else "package-manifest.json",
        "weapon_count": 6,
        "entry_count": len(expected),
        "zip_bytes": output.stat().st_size,
        "zip_sha256": digest_file(output),
        "all_entry_byte_hashes_match_source": True,
        "source_assets_unchanged": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=REPO_ROOT / "outputs/weapon-modules")
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    output = args.output or args.source / "Cloudstitch-weapons-6.zip"
    print(json.dumps(package(args.source, output), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as error:
        raise SystemExit(f"Packaging stopped: {error}") from error
