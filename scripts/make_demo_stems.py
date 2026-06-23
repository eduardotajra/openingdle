#!/usr/bin/env python3
"""
Gera faixas de DEMONSTRAÇÃO (tons sintéticos) para testar o modo Fases sem
precisar do Demucs/ffmpeg. Cada faixa é um som distinto só para validar a
mecânica (seleção, desbloqueio, play/pause). NÃO é separação real de áudio.

USO:
  python scripts/make_demo_stems.py --count 3
  python scripts/make_demo_stems.py --ids naruto-op1 bleach-op1

Substitua depois pelas faixas reais com scripts/separate_stems.py.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import struct
import sys
import wave
from pathlib import Path

try:  # console do Windows costuma ser cp1252; força UTF-8 p/ não quebrar nos prints
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OPENINGS_FILE = ROOT / "data" / "openings.json"
STEMS_FILE = ROOT / "data" / "stems.json"
PUBLIC_STEMS = ROOT / "public" / "stems"

RATE = 22050
DURATION = 8.0  # segundos
AMP = 12000     # amplitude (de 32767)


def write_wav(path: Path, samples: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s)))) for s in samples
        )
        w.writeframes(frames)


def tone(freq: float, vibrato: float = 0.0) -> list[float]:
    n = int(RATE * DURATION)
    out = []
    for i in range(n):
        t = i / RATE
        f = freq + vibrato * math.sin(2 * math.pi * 5 * t)
        env = min(1.0, t * 4) * min(1.0, (DURATION - t) * 4)  # fade in/out
        out.append(AMP * env * math.sin(2 * math.pi * f * t))
    return out


def drum_pattern() -> list[float]:
    """Batidas rítmicas (ruído curto) a cada 0,5s."""
    n = int(RATE * DURATION)
    out = [0.0] * n
    step = int(RATE * 0.5)
    hit = int(RATE * 0.08)
    for start in range(0, n, step):
        for i in range(hit):
            if start + i < n:
                decay = 1.0 - i / hit
                out[start + i] = AMP * decay * (random.random() * 2 - 1)
    return out


def stems_for() -> dict[str, list[float]]:
    return {
        "bass": tone(80),            # baixo grave
        "drums": drum_pattern(),     # bateria
        "other": tone(440),          # melodia (lá)
        "vocals": tone(660, 8),      # "vocal" com vibrato
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Gera faixas de demonstração (tons).")
    ap.add_argument("--ids", nargs="*", help="ids específicos (de openings.json)")
    ap.add_argument("--count", type=int, default=3, help="qtd a gerar (padrão 3)")
    args = ap.parse_args()

    openings = json.loads(OPENINGS_FILE.read_text(encoding="utf-8"))
    by_id = {o["id"]: o for o in openings}

    if args.ids:
        targets = []
        for i in args.ids:
            if i not in by_id:
                raise SystemExit(f"id desconhecido: {i}")
            targets.append(by_id[i])
    else:
        targets = openings[: args.count]

    manifest = (
        json.loads(STEMS_FILE.read_text(encoding="utf-8"))
        if STEMS_FILE.exists()
        else []
    )
    entries = {e["id"]: e for e in manifest}

    for o in targets:
        oid = o["id"]
        print(f"• {oid} ({o['animeName']} {o['themeSlug']})")
        paths = {}
        for name, samples in stems_for().items():
            dest = PUBLIC_STEMS / oid / f"{name}.wav"
            write_wav(dest, samples)
            paths[name] = f"/stems/{oid}/{name}.wav"
        entries[oid] = {"id": oid, "demo": True, "stems": paths}

    STEMS_FILE.write_text(
        json.dumps(list(entries.values()), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\n✓ {len(targets)} demo(s) gerada(s). Manifesto: {STEMS_FILE}")


if __name__ == "__main__":
    main()
