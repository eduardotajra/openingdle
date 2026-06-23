#!/usr/bin/env python3
"""
Valida a saúde da API da AnimeThemes e de TODAS as URLs de vídeo/áudio do
dataset (data/openings.json). Útil para achar links mortos (a base remove
arquivos com o tempo) e medir latência.

USO:
  python scripts/check_urls.py            # checa vídeo + áudio
  python scripts/check_urls.py --audio    # só áudio
  python scripts/check_urls.py --prune    # remove do dataset as aberturas com vídeo morto

A checagem usa GET com Range: bytes=0-1 (o CDN bloqueia HEAD com 403), então
baixa só ~2 bytes por arquivo.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OPENINGS_FILE = ROOT / "data" / "openings.json"
API = "https://api.animethemes.moe"
UA = "animedle-check/1.0 (educational project)"
TIMEOUT = 20


def probe_once(url: str) -> tuple[int, float]:
    """Retorna (status_http, segundos). status 0 = falha de conexão."""
    req = urllib.request.Request(
        url, headers={"User-Agent": UA, "Range": "bytes=0-1"}
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            r.read(2)
            return r.status, time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        return e.code, time.perf_counter() - t0
    except Exception:
        return 0, time.perf_counter() - t0


def probe(url: str) -> tuple[int, float]:
    """Como probe_once, mas com retry/backoff em 503/falha (o CDN de vídeo
    limita rajadas; 503 é transitório, não link morto)."""
    delay = 0.8
    last = (0, 0.0)
    for attempt in range(4):
        st, dt = probe_once(url)
        if st in (200, 206) or st == 404:
            return st, dt  # sucesso ou ausência definitiva
        last = (st, dt)
        time.sleep(delay)
        delay *= 1.8
    return last


def check_api() -> bool:
    print("== API health ==")
    url = f"{API}/anime?page%5Bsize%5D=1&fields%5Banime%5D=name"
    st, dt = probe(url)
    ok = st in (200, 206)
    print(f"  GET /anime -> {st} em {dt*1000:.0f}ms  {'OK' if ok else 'FALHA'}")
    return ok


def check_all(openings: list[dict], kind: str, workers: int) -> dict[str, tuple[int, float]]:
    field = "videoUrl" if kind == "video" else "audioUrl"
    items = [(o["id"], o[field]) for o in openings if o.get(field)]
    print(f"\n== Checando {len(items)} URLs de {kind} (workers={workers}) ==")
    results: dict[str, tuple[int, float]] = {}
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(probe, url): oid for oid, url in items}
        for fut in as_completed(futs):
            oid = futs[fut]
            results[oid] = fut.result()
            done += 1
            if done % 50 == 0:
                print(f"  ... {done}/{len(items)}")
    return results


def summarize(results: dict[str, tuple[int, float]], kind: str) -> list[str]:
    ok = [r for r in results.values() if r[0] in (200, 206)]
    dead = {oid: r for oid, r in results.items() if r[0] not in (200, 206)}
    times = sorted(dt for st, dt in ok)
    n = len(times)
    print(f"\n== Resumo {kind} ==")
    print(f"  OK: {len(ok)}/{len(results)}   mortas: {len(dead)}")
    if n:
        p50 = times[n // 2]
        p90 = times[min(n - 1, int(n * 0.9))]
        print(f"  latência (1ª resposta): mediana {p50*1000:.0f}ms | "
              f"p90 {p90*1000:.0f}ms | máx {times[-1]*1000:.0f}ms")
    if dead:
        print("  IDs com problema:")
        for oid, (st, dt) in sorted(dead.items()):
            print(f"    {oid}: status {st}")
    return list(dead.keys())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", action="store_true", help="checar também o áudio")
    ap.add_argument("--only-audio", action="store_true", help="checar só o áudio")
    ap.add_argument("--prune", action="store_true",
                    help="remover do dataset aberturas com vídeo morto")
    ap.add_argument("--workers", type=int, default=4,
                    help="conexões simultâneas (padrão 4; o CDN de vídeo limita rajadas)")
    ap.add_argument("--limit", type=int, default=0,
                    help="checar só as N primeiras (amostra)")
    args = ap.parse_args()

    openings = json.loads(OPENINGS_FILE.read_text(encoding="utf-8"))
    if args.limit:
        openings = openings[: args.limit]
    check_api()

    dead_video: list[str] = []
    if not args.only_audio:
        rv = check_all(openings, "video", args.workers)
        dead_video = summarize(rv, "video")
    if args.audio or args.only_audio:
        ra = check_all(openings, "audio", args.workers)
        summarize(ra, "audio")

    if args.prune and dead_video:
        before = len(openings)
        keep = [o for o in openings if o["id"] not in set(dead_video)]
        OPENINGS_FILE.write_text(
            json.dumps(keep, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"\n✂  Removidas {before - len(keep)} aberturas com vídeo morto. "
              f"Agora: {len(keep)}.")
        print("   (Rode `npm run seed` para reconstruir do zero, se preferir.)")


if __name__ == "__main__":
    main()
