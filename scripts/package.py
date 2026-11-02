#!/usr/bin/env python3
"""Build a minimal GitHub Pages artifact (no source data, scripts or .git)."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "_site"

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copy2(ROOT / "index.html", OUT / "index.html")
    shutil.copy2(ROOT / "recipes.json", OUT / "recipes.json")
    (OUT / ".nojekyll").write_text("", encoding="utf-8")
    source_assets = ROOT / "assets"
    if source_assets.exists():
        shutil.copytree(source_assets, OUT / "assets")
    manifest = json.loads((ROOT / "data" / "generated_paths.json").read_text(encoding="utf-8"))
    for rel in manifest:
        src = ROOT / rel
        dest = OUT / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
    print("Packaged " + str(len(manifest)) + " recipe pages for GitHub Pages.")

if __name__ == "__main__":
    main()
