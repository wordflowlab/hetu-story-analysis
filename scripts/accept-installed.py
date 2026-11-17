#!/usr/bin/env python3
"""固定公开制品的安装版验收；不构建或替换发行包。"""
from pathlib import Path
import hashlib
import json
import os
import struct
import subprocess
import tarfile

ROOT = Path.cwd()
HOST_SHA = "3d929978419b8b230aee5fa2f9aed83614d4e2dd"
ZIP_SHA = "94fcbc55dc0dcdc9e7edce5ec82812760a15aef80a3907a9eed1dc8bba66b3ec"
PACKAGES = {
    "story-research": ("0.1.0", "5adeffdf4bfe4f71ac614204bfe77825747164fa4705f6b9ec52a1d908b5bf9f"),
    "character-lab": ("0.1.0", "d3404b533b5e8a03e45e84eb23f5d4a99209568a0d8e09e03b13a0b05d6a4944"),
    "story-analysis": ("0.1.0", "fb117ee372a4fce7cde8cb1afd997f3d0b168066af2b1334171e721dfcd21009"),
    "novel-planner": ("0.2.0", "2e05158d8ee1076370e3d186491fdc83083cb3a19e8f66ff6ef3452aacadd1e9"),
    "novel-review": ("0.1.0", "bb7078c860d39ee684d0b028c9db4ddd55db3182574e55f7a72608b9b31c2bb9"),
}
EVIDENCE = ROOT / "installed-acceptance"
DOWNLOADS = ROOT / "downloads"
EVIDENCE.mkdir()
DOWNLOADS.mkdir()


def run(args, **kwargs):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, **kwargs).strip()


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def package_sha256(directory):
    digest = hashlib.sha256()
    for file in sorted(directory.rglob("*"), key=lambda p: p.relative_to(directory).as_posix().encode()):
        assert not file.is_symlink(), "拒绝符号链接"
        if file.is_file():
            name, data = file.relative_to(directory).as_posix().encode(), file.read_bytes()
            digest.update(struct.pack(">IQ", len(name), len(data)) + name + data)
    return digest.hexdigest()


run(["gh", "release", "download", "v0.11.7", "--repo", "limecloud/hetu",
     "--pattern", "Hetu-0.11.7-macos-arm64.zip", "--pattern", "release-manifest.json", "--dir", str(DOWNLOADS)])
archive = DOWNLOADS / "Hetu-0.11.7-macos-arm64.zip"
assert sha256(archive) == ZIP_SHA
manifest = json.loads((DOWNLOADS / "release-manifest.json").read_text())
assert manifest["git_sha"] == HOST_SHA and manifest["version"] == "0.11.7"
assert manifest["notarization_status"] == "Accepted" and manifest["signing"] == "developer-id"
run(["ditto", "-x", "-k", str(archive), str(DOWNLOADS / "expanded")])
app = Path("/Applications/Hetu.app")
assert not app.exists(), "只在干净的CI系统安装，不覆盖未知应用"
run(["ditto", str(DOWNLOADS / "expanded/Hetu.app"), str(app)])
run(["codesign", "--verify", "--deep", "--strict", str(app)])
signature = run(["codesign", "--display", "--verbose=4", str(app)])
assert "TeamIdentifier=" + manifest["team_id"] in signature
gatekeeper = run(["spctl", "--assess", "--type", "execute", "--verbose=2", str(app)])
staple = run(["xcrun", "stapler", "validate", str(app)])
bin_dir = app / "Contents/Resources/bin"
assert run([str(bin_dir / "hetu"), "--version"]) == "hetu 0.11.7"
(EVIDENCE / "host.json").write_text(json.dumps({
    "source_build": False, "version": "hetu 0.11.7", "git_sha": HOST_SHA,
    "archive_sha256": ZIP_SHA, "signature_verified": True, "gatekeeper": gatekeeper,
    "staple": staple, "application_path": str(app),
}, ensure_ascii=False, indent=2) + "\n")

for slug, (version, expected) in PACKAGES.items():
    package = ROOT / "plugins" / ("hetu-" + slug) / "dist"
    package.mkdir()
    download = DOWNLOADS / slug
    download.mkdir()
    name = f"org.wordflowlab.{slug}-{version}.tgz"
    run(["gh", "release", "download", "v" + version, "--repo", "wordflowlab/hetu-" + slug,
         "--pattern", name, "--pattern", "release-integrity.json", "--dir", str(download)])
    integrity = json.loads((download / "release-integrity.json").read_text())
    assert sha256(download / name) == integrity["archive_sha256"]
    assert integrity["package_sha256"] == expected
    with tarfile.open(download / name) as source:
        for member in source.getmembers():
            assert not member.issym() and not member.islnk()
            assert (package / member.name).resolve().is_relative_to(package)
        source.extractall(package, filter="data")
    assert package_sha256(package) == expected

env = {**os.environ, "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
       "HETU_PACKAGED_APP": str(app / "Contents/MacOS/Hetu"),
       "HETU_TEST_BIN": str(bin_dir), "HETU_SOURCE": str(ROOT / "host"),
       "HETU_TEST_HOST_COMMIT": HOST_SHA, "HETU_CROSS_ROOT": str(ROOT / "plugins")}
results = []
for slug in ["story-research", "character-lab", "story-analysis"]:
    repo = ROOT / "plugins" / ("hetu-" + slug)
    receipt = EVIDENCE / slug
    receipt.mkdir()
    current = {**env, "HETU_TEST_PACKAGE": str(repo / "dist"), "HETU_RECEIPT_DIRECTORY": str(receipt)}
    for test in ["machine", "ui"] + (["cross"] if slug == "story-analysis" else []):
        command = ([str(bin_dir / "node"), "node_modules/@playwright/test/cli.js", "test"] if test == "ui" else
                   [str(bin_dir / "node"), "--experimental-strip-types", "--test", f"tests/{test}.integration.ts"])
        with (receipt / (test + ".log")).open("w") as log:
            result = subprocess.run(command, cwd=repo, env=current, stdout=log, stderr=subprocess.STDOUT, timeout=900)
        results.append({"slug": slug, "test": test, "exit_code": result.returncode})
        (EVIDENCE / "results.json").write_text(json.dumps(results, indent=2) + "\n")
        print(json.dumps(results[-1]), flush=True)
        assert result.returncode == 0, "保留失败回执，先定位并回读原操作"
