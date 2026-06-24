"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AlertCircle,
  AudioLines,
  Drum,
  Guitar,
  Loader2,
  Lock,
  Mic,
  Pause,
  Piano,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Opening, StemsEntry } from "@/lib/types";

// Ordem de revelação: da faixa mais difícil de reconhecer à mais fácil.
const STEM_DEFS: {
  key: "bass" | "drums" | "other" | "vocals";
  label: string;
  Icon: LucideIcon;
}[] = [
  { key: "bass", label: "Baixo", Icon: Guitar },
  { key: "drums", label: "Bateria", Icon: Drum },
  { key: "other", label: "Melodia", Icon: Piano },
  { key: "vocals", label: "Vocal", Icon: Mic },
];

/** Índice virtual usado quando "música completa" está selecionada. */
const FULL_INDEX = STEM_DEFS.length; // = 4
const FULL_LABEL = "Completa";

const VOLUME_KEY = "openingdle:volume";

interface Props {
  opening: Opening;
  entry: StemsEntry;
  /** nº de palpites errados (controla quantas faixas estão liberadas) */
  attempt: number;
  /** fim de jogo: libera todas as faixas */
  gameOver?: boolean;
}

export default function StemsPlayer({
  opening,
  entry,
  attempt,
  gameOver = false,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Tempo a aplicar assim que a próxima faixa carregar (continuidade ao trocar). */
  const pendingSeek = useRef<number | null>(null);
  /** Marca que o usuário pediu para tocar; aplicado após troca de src. */
  const pendingPlay = useRef(false);
  const seekBarRef = useRef<HTMLDivElement | null>(null);

  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);

  const unlocked = gameOver
    ? STEM_DEFS.length
    : Math.min(attempt + 1, STEM_DEFS.length);
  const isFull = selected === FULL_INDEX;
  const fullAvailable = gameOver && !!opening.audioUrl;
  // Quando a música completa está selecionada, usamos o .ogg original do
  // anime (vem da AnimeThemes). As 4 faixas continuam disponíveis.
  const src = isFull
    ? (opening.audioUrl ?? "")
    : entry.stems[STEM_DEFS[selected].key];

  const safePlay = useCallback((el: HTMLAudioElement) => {
    const p = el.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, []);

  // Hidrata volume salvo na primeira montagem.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { v: number; m: boolean };
        if (typeof saved.v === "number") setVolume(saved.v);
        if (typeof saved.m === "boolean") setMuted(saved.m);
      } catch {
        /* ignora */
      }
    }
  }, []);

  // Sincroniza volume/mute com o elemento e persiste.
  useEffect(() => {
    const el = audioRef.current;
    if (el) {
      el.volume = volume;
      el.muted = muted;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        VOLUME_KEY,
        JSON.stringify({ v: volume, m: muted }),
      );
    }
  }, [volume, muted]);

  // Troca de src (faixa) → restaura o tempo e o estado de tocar.
  useEffect(() => {
    setDuration(0);
    setBuffering(false);
    setError(false);
    // elapsed só é resetado se NÃO há seek pendente (mantém HUD coerente
    // durante a troca de faixa).
    if (pendingSeek.current === null) setElapsed(0);
  }, [src]);

  // Quando uma faixa nova é liberada por erro, move a seleção para ela e
  // continua tocando se já estava tocando.
  useEffect(() => {
    if (unlocked - 1 === selected) return;
    pendingSeek.current = audioRef.current?.currentTime ?? null;
    if (playing) pendingPlay.current = true;
    setSelected(unlocked - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  // Quando o jogo acaba, abre direto na música completa (mas só uma vez,
  // pra não roubar a faixa se o usuário escolher outra depois).
  const autoSwitchedToFull = useRef(false);
  useEffect(() => {
    if (gameOver && fullAvailable && !autoSwitchedToFull.current) {
      autoSwitchedToFull.current = true;
      pendingSeek.current = 0; // recomeça do zero pra ouvir tudo
      pendingPlay.current = false; // não toca automaticamente
      setSelected(FULL_INDEX);
    }
    if (!gameOver) autoSwitchedToFull.current = false;
  }, [gameOver, fullAvailable]);

  const onLoadedMetadata = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setDuration(el.duration || 0);
    // Restaura tempo se houver seek pendente (troca de faixa).
    if (pendingSeek.current !== null) {
      try {
        el.currentTime = Math.min(pendingSeek.current, (el.duration || 0) - 0.1);
      } catch {
        /* ignora */
      }
      pendingSeek.current = null;
    }
    if (pendingPlay.current) {
      pendingPlay.current = false;
      safePlay(el);
      setPlaying(true);
    }
  }, [safePlay]);

  const onTimeUpdate = useCallback(() => {
    if (audioRef.current) setElapsed(audioRef.current.currentTime);
  }, []);

  function selectStem(i: number) {
    // Música completa: disponível só após gameOver. Stems: respeitam unlocked.
    if (i === FULL_INDEX ? !fullAvailable : i >= unlocked) return;
    if (i === selected) {
      togglePlay();
      return;
    }
    // Continuidade: ao trocar entre stems, mantém o tempo atual. Mas ao
    // entrar/sair da música completa, recomeça do zero (durações diferentes).
    const switchingToFull = i === FULL_INDEX;
    const switchingFromFull = selected === FULL_INDEX;
    pendingSeek.current =
      switchingToFull || switchingFromFull
        ? 0
        : (audioRef.current?.currentTime ?? null);
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

  // Seek na barra de progresso (click + drag).
  const seekTo = useCallback((clientX: number) => {
    const bar = seekBarRef.current;
    const el = audioRef.current;
    if (!bar || !el || duration === 0) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    try {
      el.currentTime = ratio * duration;
      setElapsed(el.currentTime);
    } catch {
      /* ignora */
    }
  }, [duration]);

  function onSeekPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    seekTo(e.clientX);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    function move(ev: PointerEvent) {
      seekTo(ev.clientX);
    }
    function up(ev: PointerEvent) {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
  }

  function toggleMute() {
    setMuted((m) => !m);
  }

  const progress = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="w-full space-y-4">
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
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

      {/* Seletor de faixas: 4 stems + (após o jogo) música completa */}
      <div
        className={`grid gap-2 ${
          fullAvailable ? "grid-cols-5" : "grid-cols-4"
        }`}
      >
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
        {fullAvailable && (
          <button
            onClick={() => selectStem(FULL_INDEX)}
            className={`group flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 transition ${
              isFull
                ? "border-[var(--color-gold)]/70 bg-gradient-to-br from-[var(--color-gold)]/25 to-[var(--color-crimson)]/15 shadow-lg shadow-[var(--color-gold)]/20"
                : "border-[var(--color-gold)]/25 bg-gradient-to-br from-[var(--color-gold)]/8 to-transparent hover:border-[var(--color-gold)]/45 hover:from-[var(--color-gold)]/15"
            }`}
          >
            <AudioLines
              className={`h-6 w-6 transition ${
                isFull
                  ? "text-[var(--color-gold)]"
                  : "text-[var(--color-gold)]/75 group-hover:text-[var(--color-gold)]"
              }`}
              strokeWidth={1.75}
            />
            <span
              className={`text-xs font-medium ${
                isFull ? "text-[var(--color-sand)]" : "text-[var(--color-sand)]/85"
              }`}
            >
              {FULL_LABEL}
            </span>
          </button>
        )}
      </div>

      {/* Player da faixa selecionada */}
      <div className="rounded-xl border border-[var(--color-gold)]/20 bg-gradient-to-b from-[var(--color-ocean)]/50 to-[var(--color-ocean-deep)]/80 p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium text-[var(--color-sand)]">
            {isFull ? (
              <>
                <AudioLines
                  className="h-4 w-4 text-[var(--color-gold)]"
                  strokeWidth={2}
                />
                <span>Música completa</span>
              </>
            ) : (
              <>
                {(() => {
                  const Icon = STEM_DEFS[selected].Icon;
                  return (
                    <Icon
                      className="h-4 w-4 text-[var(--color-gold)]"
                      strokeWidth={2}
                    />
                  );
                })()}
                <span>{STEM_DEFS[selected].label}</span>
              </>
            )}
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--color-gold)]/70">
            {error ? "—" : `${fmt(elapsed)} / ${duration ? fmt(duration) : "…"}`}
          </span>
        </div>

        {/* Barra de progresso clicável (estilo YouTube). Área de clique
            generosa (py-2) mas barra fina (h-1.5). */}
        <div
          ref={seekBarRef}
          onPointerDown={duration > 0 ? onSeekPointerDown : undefined}
          className={`group relative mb-4 py-2 ${
            duration > 0 ? "cursor-pointer" : "cursor-not-allowed"
          }`}
          role="slider"
          aria-label="Posição na faixa"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={elapsed}
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-ocean-deep)] ring-1 ring-[var(--color-gold)]/10 transition group-hover:h-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold-soft)] to-[var(--color-gold)] transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Bolinha do scrubber, visível ao hover/drag */}
          {duration > 0 && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-gold)] opacity-0 shadow-md transition group-hover:opacity-100"
              style={{ left: `${progress}%` }}
            />
          )}
        </div>

        {error ? (
          <p className="flex items-center justify-center gap-2 text-center text-sm text-[var(--color-sand)]/70">
            <AlertCircle className="h-4 w-4 text-[var(--color-crimson)]" />
            Não foi possível carregar esta faixa.
          </p>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              disabled={duration === 0}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-6 py-2.5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/30 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)] disabled:opacity-40 disabled:shadow-none"
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
                  <span>{isFull ? "Tocar abertura" : "Tocar faixa"}</span>
                </>
              )}
            </button>

            {/* Controle de volume */}
            <div className="flex items-center gap-2 rounded-full border border-[var(--color-gold)]/20 bg-[var(--color-ocean-deep)]/50 px-3 py-2">
              <button
                onClick={toggleMute}
                aria-label={muted ? "Ativar som" : "Silenciar"}
                className="text-[var(--color-sand)]/70 transition hover:text-[var(--color-gold)]"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (muted) setMuted(false);
                }}
                aria-label="Volume"
                className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-[var(--color-ocean-deep)] outline-none accent-[var(--color-gold)]"
              />
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[var(--color-sand)]/55">
        {unlocked < STEM_DEFS.length
          ? `Erre ou pule para liberar a próxima faixa (${unlocked}/${STEM_DEFS.length}).`
          : fullAvailable
            ? "Todas as faixas liberadas — agora pode ouvir a abertura completa."
            : "Todas as faixas liberadas."}
      </p>
    </div>
  );
}
