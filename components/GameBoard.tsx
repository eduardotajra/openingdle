"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Opening } from "@/lib/types";
import { MAX_ATTEMPTS, clipDuration } from "@/lib/game";
import { isCorrect } from "@/lib/matching";
import { ANIME_LIST } from "@/lib/animeList";
import {
  loadDailyState,
  saveDailyState,
  loadStats,
  recordResult,
  type GameStatus,
  type Stats,
} from "@/lib/storage";
import { Eye, Shuffle } from "lucide-react";
import OpeningPlayer, { type PlayMode } from "./OpeningPlayer";
import GuessInput from "./GuessInput";
import GuessList from "./GuessList";
import HintBar from "./HintBar";
import ResultModal from "./ResultModal";

const SKIP = "(pulou)";

interface Props {
  opening: Opening;
  startFraction: number;
  mode: "daily" | "free";
  /** modo de apresentação (vídeo+áudio, só áudio, etc.) */
  playMode?: PlayMode;
  /** nº do puzzle (modo diário) */
  puzzle?: number;
  /** modo livre: sortear próxima abertura */
  onNext?: () => void;
  /**
   * Player customizado (ex: modo Fases). Recebe a tentativa atual (nº de erros)
   * e se o jogo acabou. Se omitido, usa o OpeningPlayer padrão.
   */
  renderPlayer?: (ctx: { attempt: number; gameOver: boolean }) => ReactNode;
}

export default function GameBoard({
  opening,
  startFraction,
  mode,
  playMode = "standard",
  puzzle,
  onNext,
  renderPlayer,
}: Props) {
  const [guesses, setGuesses] = useState<string[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const recorded = useRef(false);

  // Hidrata estado salvo (modo diário) — só no cliente.
  useEffect(() => {
    recorded.current = false;
    if (mode === "daily" && puzzle !== undefined) {
      const saved = loadDailyState(puzzle);
      setGuesses(saved.guesses);
      setStatus(saved.status);
      setStats(loadStats());
      if (saved.status !== "playing") {
        recorded.current = true; // já contabilizado em sessão anterior
        setShowModal(false);
      }
    } else {
      setGuesses([]);
      setStatus("playing");
      setShowModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, puzzle, opening.id]);

  const wrongGuesses = status === "won" ? guesses.length - 1 : guesses.length;
  const gameOver = status !== "playing";

  function finish(nextStatus: GameStatus, nextGuesses: string[]) {
    setStatus(nextStatus);
    if (mode === "daily" && puzzle !== undefined) {
      saveDailyState({ puzzle, status: nextStatus, guesses: nextGuesses });
      if (!recorded.current) {
        recorded.current = true;
        const s = recordResult(
          puzzle,
          nextStatus === "won",
          nextGuesses.length,
        );
        setStats(s);
      }
    }
    setTimeout(() => setShowModal(true), 600);
  }

  function applyGuess(text: string, correct: boolean) {
    if (gameOver) return;
    const next = [...guesses, text];
    setGuesses(next);
    if (mode === "daily" && puzzle !== undefined) {
      saveDailyState({ puzzle, status: "playing", guesses: next });
    }
    if (correct) {
      finish("won", next);
    } else if (next.length >= MAX_ATTEMPTS) {
      finish("lost", next);
    }
  }

  function handleGuess(name: string) {
    applyGuess(name, isCorrect(name, opening));
  }

  function handleSkip() {
    applyGuess(SKIP, false);
  }

  const attempts = guesses.length;

  return (
    <div className="space-y-5">
      {renderPlayer ? (
        renderPlayer({ attempt: wrongGuesses, gameOver })
      ) : (
        <OpeningPlayer
          opening={opening}
          playMode={playMode}
          attempt={wrongGuesses}
          clipSeconds={clipDuration(wrongGuesses)}
          startFraction={startFraction}
          revealFull={gameOver}
        />
      )}

      {!gameOver && (
        <>
          <HintBar opening={opening} wrongGuesses={wrongGuesses} />
          <GuessInput
            animeList={ANIME_LIST}
            onGuess={handleGuess}
            onSkip={handleSkip}
            disabled={gameOver}
          />
        </>
      )}

      <GuessList
        guesses={guesses}
        correctAnswer={status === "won" ? guesses[guesses.length - 1] : undefined}
      />

      {gameOver && !showModal && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/40 px-4 py-2.5 font-medium text-[var(--color-sand)]/85 transition hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-ocean)]/60"
          >
            <Eye className="h-4 w-4" />
            <span>Ver resultado</span>
          </button>
          {mode === "free" && onNext && (
            <button
              onClick={onNext}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-4 py-2.5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/25 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)]"
            >
              <Shuffle className="h-4 w-4" />
              <span>Jogar outra</span>
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ResultModal
          opening={opening}
          won={status === "won"}
          attempts={attempts}
          daily={
            mode === "daily" && puzzle !== undefined && stats
              ? { puzzle, stats }
              : undefined
          }
          onClose={() => setShowModal(false)}
          onNext={mode === "free" ? onNext : undefined}
          nextLabel="Jogar outra"
        />
      )}
    </div>
  );
}
