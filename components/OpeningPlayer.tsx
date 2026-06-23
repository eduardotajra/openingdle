"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Headphones,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import type { Opening } from "@/lib/types";

/**
 * standard = vídeo + áudio | audio = só som | video = animação muda
 * | frame = imagem estática (um quadro por tentativa)
 */
export type PlayMode = "standard" | "audio" | "video" | "frame";

interface Props {
  opening: Opening;
  playMode: PlayMode;
  /** nº de palpites errados (controla janela/frame revelado) */
  attempt: number;
  /** segundos da abertura liberados nesta tentativa */
  clipSeconds: number;
  /**
   * Mantido por compatibilidade. NÃO usamos mais um ponto de início aleatório:
   * tocar a partir de 0 permite streaming linear (sem seek profundo, que no
   * .webm força baixar o índice no fim do arquivo + o trecho no meio = lento).
   */
  startFraction?: number;
  /** fim de jogo: libera o vídeo inteiro com controles */
  revealFull?: boolean;
}

export default function OpeningPlayer({
  opening,
  playMode,
  attempt,
  clipSeconds,
  revealFull = false,
}: Props) {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const stopAtRef = useRef<number>(0);
  const retries = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  // Modo apenas-áudio usa o .ogg (≈3MB) em vez do vídeo, quando existir.
  const audioOnly = playMode === "audio" && !revealFull && !!opening.audioUrl;
  const showVideo = revealFull || (playMode !== "audio" && !audioOnly);
  const muted = !revealFull && (playMode === "video" || playMode === "frame");
  const isFrame = playMode === "frame" && !revealFull;

  // Sempre do começo (streaming linear = início rápido).
  const start = 0;
  // No modo frame, cada erro avança ~1,5s no quadro mostrado.
  const frameTime = Math.min(attempt * 1.5, Math.max(0, duration - 0.1));

  // Dispara play() ignorando AbortError (troca de src / pause rápido).
  const safePlay = useCallback((el: HTMLMediaElement) => {
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  // Troca de abertura ou de fonte (vídeo<->áudio) → reseta estado.
  useEffect(() => {
    setDuration(0);
    setPlaying(false);
    setElapsed(0);
    setBuffering(false);
    setError(false);
    retries.current = 0;
    if (retryTimer.current) clearTimeout(retryTimer.current);
  }, [opening.id, audioOnly]);

  // Limpa o timer de retry ao desmontar.
  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // Erro de mídia: o CDN às vezes responde 503 (rate-limit transitório).
  // Tenta recarregar algumas vezes com backoff antes de desistir.
  const onMediaError = useCallback(() => {
    if (retries.current >= 3) {
      setError(true);
      setBuffering(false);
      return;
    }
    retries.current += 1;
    setBuffering(true);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      mediaRef.current?.load();
    }, 600 * retries.current);
  }, []);

  // Modo frame: posiciona o vídeo no quadro certo (pausado).
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !isFrame || duration === 0) return;
    el.pause();
    try {
      el.currentTime = frameTime;
    } catch {
      /* ignora se ainda não pode buscar */
    }
    setPlaying(false);
  }, [isFrame, frameTime, duration]);

  const onLoadedMetadata = useCallback(() => {
    if (mediaRef.current) setDuration(mediaRef.current.duration || 0);
  }, []);

  const onTimeUpdate = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!revealFull && !isFrame && el.currentTime >= stopAtRef.current) {
      el.pause();
      setPlaying(false);
    }
    setElapsed(Math.max(0, el.currentTime - start));
  }, [revealFull, isFrame]);

  const playClip = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (revealFull) {
      safePlay(el);
      setPlaying(true);
      return;
    }
    stopAtRef.current = start + clipSeconds;
    try {
      el.currentTime = start;
    } catch {
      /* ignora */
    }
    safePlay(el);
    setPlaying(true);
  }, [revealFull, clipSeconds, safePlay]);

  const stop = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.pause();
    setPlaying(false);
  }, []);

  const progress =
    clipSeconds > 0 ? Math.min(100, (elapsed / clipSeconds) * 100) : 0;

  // preload="auto": começa a bufferizar desde o byte 0 ao montar, então o
  // "Tocar trecho" responde quase na hora (não espera o seek/buffer no clique).
  const mediaProps = {
    onLoadedMetadata,
    onTimeUpdate,
    onEnded: () => setPlaying(false),
    onWaiting: () => setBuffering(true),
    onPlaying: () => setBuffering(false),
    onCanPlay: () => setBuffering(false),
    onError: onMediaError,
    preload: "auto" as const,
  };

  return (
    <div className="w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-[var(--color-gold)]/25 shadow-2xl shadow-black/50">
        {audioOnly ? (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={opening.audioUrl ?? undefined}
            {...mediaProps}
          />
        ) : (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={opening.videoUrl}
            playsInline
            muted={muted}
            controls={revealFull}
            className={`h-full w-full object-contain transition-opacity ${
              showVideo ? "opacity-100" : "opacity-0"
            }`}
            {...mediaProps}
          />
        )}
        {!showVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[var(--color-ocean-deep)] to-black text-[var(--color-sand-muted)]">
            <Headphones className="h-14 w-14 text-[var(--color-gold)]/60" strokeWidth={1.5} />
            <span className="text-xs uppercase tracking-widest">Apenas áudio</span>
          </div>
        )}
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--color-ocean-deep)] px-4 text-center text-sm text-[var(--color-sand)]/70">
            <AlertCircle className="h-8 w-8 text-[var(--color-crimson)]" />
            <span>Não foi possível carregar esta abertura.</span>
          </div>
        ) : (
          duration === 0 && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[var(--color-sand)]/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando…</span>
            </div>
          )
        )}
      </div>

      {/* Barra de progresso do trecho (não no modo frame) */}
      {!revealFull && !isFrame && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--color-ocean)]/40 ring-1 ring-[var(--color-gold)]/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold-soft)] to-[var(--color-gold)] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Controles */}
      {!revealFull && (
        <div className="mt-3 flex items-center justify-center gap-3">
          {isFrame ? (
            <span className="text-sm text-[var(--color-sand)]/70">
              Quadro {attempt + 1} — erre para ver mais um
            </span>
          ) : (
            <>
              <button
                onClick={playing ? stop : playClip}
                disabled={(duration === 0 && !error) || error}
                className="flex items-center gap-2 rounded-full bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-6 py-2.5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/30 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)] hover:shadow-[var(--color-crimson)]/40 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-800 disabled:opacity-50 disabled:shadow-none disabled:ring-0"
              >
                {buffering ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando</span>
                  </>
                ) : playing ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Tocar trecho</span>
                  </>
                )}
              </button>
              <span className="font-mono text-sm tabular-nums text-[var(--color-gold)]/80">
                {clipSeconds}s
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
