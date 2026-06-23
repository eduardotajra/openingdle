"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Drum,
  Guitar,
  Lock,
  Mic,
  Pause,
  Piano,
  Play,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Opening, StemsEntry } from "@/lib/types";

// Ordem de revelação: da faixa mais difícil de reconhecer à mais fácil.
const STEM_DEFS: { key: "bass" | "drums" | "other" | "vocals"; label: string; Icon: LucideIcon }[] = [
  { key: "bass", label: "Baixo", Icon: Guitar },
  { key: "drums", label: "Bateria", Icon: Drum },
  { key: "other", label: "Melodia", Icon: Piano },
  { key: "vocals", label: "Vocal", Icon: Mic },
];

interface Props {
  opening: Opening;
  entry: StemsEntry;
  /** nº de palpites errados (controla quantas faixas estão liberadas) */
  attempt: number;
  /** fim de jogo: libera todas as faixas */
  gameOver?: boolean;
}

export default function StemsPlayer({ entry, attempt, gameOver = false }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlay = useRef(false);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);

  const unlocked = gameOver ? STEM_DEFS.length : Math.min(attempt + 1, STEM_DEFS.length);
  const selectedKey = STEM_DEFS[selected].key;
  const src = entry.stems[selectedKey];

  const safePlay = useCallback((el: HTMLAudioElement) => {
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  // Troca de faixa selecionada → reseta a mídia (e toca, se foi pedido).
  useEffect(() => {
    setDuration(0);
    setElapsed(0);
    setBuffering(false);
    setError(false);
    const el = audioRef.current;
    if (el && pendingPlay.current) {
      pendingPlay.current = false;
      try {
        el.currentTime = 0;
      } catch {
        /* metadata ainda não pronta; play() carrega assim mesmo */
      }
      safePlay(el);
      setPlaying(true);
    } else {
      setPlaying(false);
    }
  }, [src, safePlay]);

  // Quando uma faixa nova é liberada, move a seleção para ela.
  useEffect(() => {
    setSelected(unlocked - 1);
  }, [unlocked]);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration || 0);
  }, []);

  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) setElapsed(audioRef.current.currentTime);
  }, []);

  function selectStem(i: number) {
    if (i >= unlocked) return;
    if (i === selected) {
      togglePlay();
      return;
    }
    // marca p/ tocar quando o efeito de troca de src rodar (DOM já atualizado)
    pendingPlay.current = true;
    setSelected(i);
  }

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      safePlay(el);
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="w-full space-y-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setError(true)}
      />

      {entry.demo && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 px-3 py-2 text-xs text-[var(--color-gold)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Faixas de <strong className="font-semibold">demonstração</strong>{" "}
            (apenas tons) — rode o pipeline Demucs para faixas reais.
          </span>
        </div>
      )}

      {/* Seletor de faixas */}
      <div className="grid grid-cols-4 gap-2">
        {STEM_DEFS.map((s, i) => {
          const isUnlocked = i < unlocked;
          const isActive = i === selected;
          const Icon = isUnlocked ? s.Icon : Lock;
          return (
            <button
              key={s.key}
              onClick={() => selectStem(i)}
              disabled={!isUnlocked}
              className={`group flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 transition ${
                isActive
                  ? "border-[var(--color-gold)]/60 bg-gradient-to-br from-[var(--color-gold)]/15 to-[var(--color-crimson)]/15 shadow-lg shadow-[var(--color-gold)]/10"
                  : isUnlocked
                    ? "border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/30 hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-ocean)]/50"
                    : "border-[var(--color-gold)]/5 bg-[var(--color-ocean)]/15 opacity-40"
              }`}
            >
              <Icon
                className={`h-6 w-6 transition ${
                  isActive
                    ? "text-[var(--color-gold)]"
                    : isUnlocked
                      ? "text-[var(--color-sand)]/70 group-hover:text-[var(--color-gold)]"
                      : "text-[var(--color-sand)]/40"
                }`}
                strokeWidth={1.75}
              />
              <span
                className={`text-xs font-medium ${
                  isActive
                    ? "text-[var(--color-sand)]"
                    : "text-[var(--color-sand)]/75"
                }`}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Player da faixa selecionada */}
      <div className="rounded-xl border border-[var(--color-gold)]/20 bg-gradient-to-b from-[var(--color-ocean)]/50 to-[var(--color-ocean-deep)]/80 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-[var(--color-sand)]">
            {(() => {
              const Icon = STEM_DEFS[selected].Icon;
              return <Icon className="h-4 w-4 text-[var(--color-gold)]" strokeWidth={2} />;
            })()}
            <span>{STEM_DEFS[selected].label}</span>
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-gold)]/70">
            {error ? "—" : `${fmt(elapsed)} / ${duration ? fmt(duration) : "…"}`}
          </span>
        </div>

        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-ocean-deep)] ring-1 ring-[var(--color-gold)]/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold-soft)] to-[var(--color-gold)] transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        {error ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-[var(--color-sand)]/70">
            <AlertCircle className="h-4 w-4 text-[var(--color-crimson)]" />
            Não foi possível carregar esta faixa.
          </p>
        ) : (
          <button
            onClick={togglePlay}
            disabled={duration === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-6 py-2.5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/30 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)] disabled:opacity-40 disabled:shadow-none"
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
                <span>Tocar faixa</span>
              </>
            )}
          </button>
        )}
      </div>

      <p className="text-center text-xs text-[var(--color-sand)]/55">
        {unlocked < STEM_DEFS.length
          ? `Erre ou pule para liberar a próxima faixa (${unlocked}/${STEM_DEFS.length}).`
          : "Todas as faixas liberadas."}
      </p>
    </div>
  );
}
