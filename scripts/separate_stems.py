#!/usr/bin/env python3
"""
Pipeline de separação de faixas (modo "Fases") usando Demucs.

Para cada abertura escolhida: baixa o .ogg da AnimeThemes, separa em 4 faixas
(baixo / bateria / melodia / vocal) com o Demucs e grava em
  public/stems/<id>/{bass,drums,other,vocals}.ogg
atualizando o manifesto data/stems.json.

Usa a API Python do Demucs + soundfile (libsndfile) para I/O de áudio, evitando
o backend torchaudio/TorchCodec (que dá problema no Windows) e o ffmpeg.

PRÉ-REQUISITOS (ver README):
  - Python 3.9–3.13  (PyTorch ainda NÃO suporta 3.14)
  - pip install demucs soundfile        (instala torch; build CUDA p/ usar a GPU)

USO:
  python scripts/separate_stems.py --count 5
  python scripts/separate_stems.py --ids naruto-op1 bleach-op1
  python scripts/separate_stems.py --ids naruto-op1 --device cuda --force

Em CPU leva alguns minutos por faixa; com a GPU (RTX 3060), segundos.
Idempotente: pula ids já processados (use --force para refazer).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
OPENINGS_FILE = ROOT / "data" / "openings.json"
STEMS_FILE = ROOT / "data" / "stems.json"
PUBLIC_STEMS = ROOT / "public" / "stems"
STEM_NAMES = ("bass", "drums", "other", "vocals")
USER_AGENT = "animedle-stems/1.0 (educational project)"


def fail(msg: str):
    print(f"\nERRO: {msg}", file=sys.stderr)
    sys.exit(1)


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def download(url: str, dest: Path) -> None:
    import shutil
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as f:
        shutil.copyfileobj(resp, f)


def write_wav_stdlib(path: Path, audio, sr: int) -> None:
    """Grava WAV 16-bit estéreo via stdlib `wave` — robusto e sem dependência
    de libsndfile (que está crashando ao encodar OGG nesta build do Windows)."""
    import numpy as np
    if audio.ndim == 1:
        audio = audio[:, None]
    # (canais, amostras) -> (amostras, canais)
    if audio.shape[0] in (1, 2) and audio.shape[1] > audio.shape[0]:
        audio = audio.T
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    clipped = np.clip(audio, -1.0, 1.0)
    pcm = (clipped * 32767.0).astype("<i2", copy=False)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(int(pcm.shape[1]))
        w.setsampwidth(2)
        w.setframerate(int(sr))
        w.writeframes(pcm.tobytes())


def encode_to_ogg(ffmpeg: str, wav_path: Path, ogg_path: Path, bitrate_k: int) -> None:
    """Encoda WAV -> OGG/Vorbis via ffmpeg (binário externo, sem libsndfile)."""
    cmd = [
        ffmpeg, "-y", "-loglevel", "error",
        "-i", str(wav_path),
        "-c:a", "libvorbis", "-b:a", f"{bitrate_k}k",
        str(ogg_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        msg = (proc.stderr or proc.stdout or "").strip().splitlines()[-5:]
        raise RuntimeError("ffmpeg falhou:\n" + "\n".join(msg))


def select_openings(args, openings, done_ids) -> list[dict]:
    by_id = {o["id"]: o for o in openings}
    if args.ids:
        chosen = []
        for i in args.ids:
            if i not in by_id:
                fail(f"id desconhecido: {i}")
            chosen.append(by_id[i])
        return chosen
    pending = [o for o in openings if o.get("audioUrl") and o["id"] not in done_ids]
    return pending[: args.count]


def main() -> None:
    ap = argparse.ArgumentParser(description="Separa aberturas em 4 faixas (Demucs).")
    ap.add_argument("--ids", nargs="*", help="ids específicos (de openings.json)")
    ap.add_argument("--count", type=int, default=5, help="qtd a processar (padrão 5)")
    ap.add_argument("--model", default="htdemucs", help="modelo Demucs (padrão htdemucs)")
    ap.add_argument("--device", choices=["cpu", "cuda"], default="cpu", help="dispositivo")
    ap.add_argument("--bitrate", type=int, default=96, help="bitrate OGG kbps (padrão 96)")
    ap.add_argument("--force", action="store_true", help="reprocessar ids já feitos")
    args = ap.parse_args()

    # Localiza um ffmpeg (env FFMPEG > imageio-ffmpeg embarcado > PATH).
    ffmpeg = os.environ.get("FFMPEG")
    if not ffmpeg:
        try:
            import imageio_ffmpeg
            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            ffmpeg = "ffmpeg"
    try:
        subprocess.run([ffmpeg, "-version"], capture_output=True, check=False)
    except FileNotFoundError:
        fail(f"ffmpeg não encontrado em '{ffmpeg}'. Rode `pip install imageio-ffmpeg`"
             f" no venv ou aponte a env FFMPEG p/ o binário.")

    # imports pesados só agora (mensagem clara se faltar dependência)
    try:
        import numpy as np
        import soundfile as sf
        import torch
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
    except ImportError as e:
        fail(f"dependência ausente ({e}). Rode: pip install demucs soundfile")

    openings = load_json(OPENINGS_FILE, [])
    if not openings:
        fail("data/openings.json vazio — rode `npm run seed` antes.")

    manifest = [e for e in load_json(STEMS_FILE, []) if not e.get("demo")]
    done_ids = {e["id"] for e in manifest}
    targets = select_openings(args, openings, set() if args.force else done_ids)
    if not targets:
        print("Nada a fazer (todos já processados). Use --force para refazer.")
        return

    print(f"Carregando modelo {args.model} (device={args.device})…")
    model = get_model(args.model)
    model.to(args.device).eval()
    sr_model = model.samplerate  # 44100
    print(f"Modelo ok. Faixas: {list(model.sources)}")

    print(f"\nProcessando {len(targets)} abertura(s)…")
    by_id = {e["id"]: e for e in manifest}
    ok = 0
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for opening in targets:
            oid = opening["id"]
            print(f"\n• {oid}  ({opening['animeName']} {opening['themeSlug']})")
            try:
                ogg = tmp / f"{oid}.ogg"
                print("  ↓ baixando áudio…")
                download(opening["audioUrl"], ogg)

                # lê via libsndfile (decodifica OGG/Vorbis sem ffmpeg).
                # ascontiguousarray: o .T gera view não-contígua, que pode
                # quebrar ops nativas do torch.
                data, sr = sf.read(str(ogg), dtype="float32", always_2d=True)
                wav = torch.from_numpy(np.ascontiguousarray(data.T))  # (canais, amostras)
                if wav.shape[0] == 1:
                    wav = wav.repeat(2, 1).contiguous()
                elif wav.shape[0] > 2:
                    wav = wav[:2].contiguous()
                if sr != sr_model:
                    # julius (dep do demucs) resampleia em torch puro — evita o
                    # backend torchaudio/TorchCodec, que crasha nesta build.
                    import julius
                    wav = julius.resample_frac(wav, sr, sr_model).contiguous()

                # normalização como o demucs.separate faz
                ref = wav.mean(0)
                mean, std = ref.mean(), ref.std()
                wav = (wav - mean) / (std + 1e-8)

                print("  ⚙ separando faixas (Demucs)… pode demorar")
                with torch.no_grad():
                    out = apply_model(
                        model, wav[None].to(args.device),
                        split=True, overlap=0.25, progress=False,
                    )[0]
                out = out * std + mean  # desnormaliza

                dest_dir = PUBLIC_STEMS / oid
                dest_dir.mkdir(parents=True, exist_ok=True)
                stems: dict[str, str] = {}
                src_by_name = dict(zip(model.sources, out))
                # WAV stdlib + ffmpeg p/ OGG (libsndfile crasha encodando OGG
                # nesta build do Windows — stack overflow).
                for name in STEM_NAMES:
                    audio = src_by_name[name].cpu().numpy()  # (canais, amostras)
                    wav_tmp = tmp / f"{oid}-{name}.wav"
                    write_wav_stdlib(wav_tmp, audio, sr_model)
                    dest = dest_dir / f"{name}.ogg"
                    encode_to_ogg(ffmpeg, wav_tmp, dest, args.bitrate)
                    wav_tmp.unlink(missing_ok=True)
                    stems[name] = f"/stems/{oid}/{name}.ogg"
                print("  ✓ faixas gravadas em", dest_dir)

                by_id[oid] = {"id": oid, "stems": stems}
                ok += 1
                STEMS_FILE.write_text(
                    json.dumps(list(by_id.values()), indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
            except Exception as e:  # noqa: BLE001
                print(f"  ! falhou: {type(e).__name__}: {e}", file=sys.stderr)

    print(f"\n✓ {ok}/{len(targets)} processada(s). Manifesto: {STEMS_FILE}")


if __name__ == "__main__":
    main()
