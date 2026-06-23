#!/usr/bin/env python3
"""
Reescreve data/stems.json para apontar dos paths locais (/stems/<id>/<stem>.ogg)
para as URLs do GitHub Release. Cada tipo de stem fica numa release separada
(limite do GitHub: 1000 assets por release; temos 309 por tipo).

USO:
  python scripts/point_stems_to_release.py
  python scripts/point_stems_to_release.py --repo eduardotajra/openingdle
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
STEMS_FILE = ROOT / "data" / "stems.json"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="eduardotajra/openingdle")
    args = ap.parse_args()

    base = f"https://github.com/{args.repo}/releases/download"
    data = json.loads(STEMS_FILE.read_text(encoding="utf-8"))

    n = 0
    for entry in data:
        if entry.get("demo"):
            continue
        oid = entry["id"]
        for stem in list(entry["stems"].keys()):
            # release dedicada por tipo de stem (bass/drums/other/vocals)
            entry["stems"][stem] = f"{base}/stems-{stem}/{oid}__{stem}.ogg"
            n += 1

    STEMS_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"OK: {n} URLs reescritas em {STEMS_FILE}")
    print(f"   Base: {base}/stems-<stem>/")


if __name__ == "__main__":
    main()
