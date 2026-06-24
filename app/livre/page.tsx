"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Anchor, Film, Headphones, Image, Map, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import GameBoard from "@/components/GameBoard";
import type { PlayMode } from "@/components/OpeningPlayer";
import { randomOpening } from "@/lib/data";
import type { Opening } from "@/lib/types";

const MODES: { id: PlayMode; label: string; desc: string; Icon: LucideIcon }[] = [
  { id: "standard", label: "Padrão", desc: "Vídeo + áudio", Icon: Film },
  { id: "audio", label: "Apenas áudio", desc: "Só a música", Icon: Headphones },
  { id: "video", label: "Apenas imagem", desc: "Animação muda", Icon: Video },
  { id: "frame", label: "Frame estático", desc: "Uma imagem por tentativa", Icon: Image },
];

export default function FreePage() {
  const [opening, setOpening] = useState<Opening | null>(null);
  const [startFraction, setStartFraction] = useState(0);
  const [playMode, setPlayMode] = useState<PlayMode>("standard");
  /** Próxima abertura, sorteada cedo e pré-carregada em background. */
  const [nextOpening, setNextOpening] = useState<Opening | null>(null);

  const shuffle = useCallback(() => {
    setOpening((prev) => {
      // Se já temos uma "próxima" pré-carregada, usa ela direto.
      if (nextOpening && nextOpening.id !== prev?.id) {
        return nextOpening;
      }
      return randomOpening();
    });
    setStartFraction(Math.random());
    // Sorteia a próxima depois, no useEffect [opening].
    setNextOpening(null);
  }, [nextOpening]);

  // Sorteia a primeira opening no client.
  useEffect(() => {
    setOpening(randomOpening());
    setStartFraction(Math.random());
  }, []);

  // Quando a opening atual muda, sorteia uma "próxima" e pré-fetcha.
  useEffect(() => {
    if (!opening) return;
    let candidate = randomOpening();
    // Evita repetir a atual no pré-fetch.
    for (let i = 0; i < 5 && candidate.id === opening.id; i++) {
      candidate = randomOpening();
    }
    setNextOpening(candidate);
  }, [opening]);

  function changeMode(m: PlayMode) {
    setPlayMode(m);
    shuffle();
  }

  return (
    <div>
      <header className="mb-5 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--color-gold)]/50 bg-gradient-to-br from-[var(--color-ocean)]/40 to-[var(--color-crimson)]/20 shadow-lg shadow-[var(--color-gold)]/10">
          <Map className="h-5 w-5 text-[var(--color-gold)]" strokeWidth={2} />
        </div>
        <h1 className="font-display text-4xl text-[var(--color-gold)]">
          Mar Aberto
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand)]/70">
          Aberturas aleatórias, sem limite. Escolha sua bandeira.
        </p>
      </header>

      {/* Seletor de modo */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {MODES.map((m) => {
          const isActive = playMode === m.id;
          const Icon = m.Icon;
          return (
            <button
              key={m.id}
              onClick={() => changeMode(m.id)}
              className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
                isActive
                  ? "border-[var(--color-gold)]/60 bg-gradient-to-br from-[var(--color-gold)]/10 to-[var(--color-crimson)]/10 shadow-lg shadow-[var(--color-gold)]/10"
                  : "border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/30 hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-ocean)]/50"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition ${
                  isActive
                    ? "text-[var(--color-gold)]"
                    : "text-[var(--color-sand)]/60 group-hover:text-[var(--color-gold)]"
                }`}
                strokeWidth={1.75}
              />
              <div>
                <div
                  className={`text-sm font-medium ${
                    isActive ? "text-[var(--color-sand)]" : "text-[var(--color-sand)]/85"
                  }`}
                >
                  {m.label}
                </div>
                <div className="text-[11px] text-[var(--color-sand-muted)]">
                  {m.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {opening ? (
        <GameBoard
          key={`${opening.id}-${playMode}`}
          mode="free"
          playMode={playMode}
          freeModeLabel={playMode === "standard" ? "free" : playMode}
          opening={opening}
          startFraction={startFraction}
          onNext={shuffle}
        />
      ) : (
        <p className="flex items-center justify-center gap-2 text-center text-[var(--color-sand)]/60">
          <Anchor className="h-4 w-4" />
          Içando velas…
        </p>
      )}

      {/* Pré-fetch invisível da próxima abertura. Browser começa a baixar em
          background; quando o usuário clica em "Jogar outra", o vídeo já está
          em cache (CDN da AnimeThemes é lento). */}
      {nextOpening && nextOpening.id !== opening?.id && (
        <PreloadMedia opening={nextOpening} playMode={playMode} />
      )}
    </div>
  );
}

/** Componente invisível que solicita os bytes iniciais do próximo media. */
function PreloadMedia({
  opening,
  playMode,
}: {
  opening: Opening;
  playMode: PlayMode;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  // Se o modo é "apenas áudio", pré-carrega o .ogg (mais leve).
  const useAudio = playMode === "audio" && !!opening.audioUrl;
  return (
    <div aria-hidden className="absolute h-0 w-0 overflow-hidden">
      {useAudio ? (
        <audio
          ref={ref as React.RefObject<HTMLAudioElement>}
          src={opening.audioUrl ?? undefined}
          preload="auto"
          muted
        />
      ) : (
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          src={opening.videoUrl}
          preload="auto"
          muted
          playsInline
        />
      )}
    </div>
  );
}
