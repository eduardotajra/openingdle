"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Shuffle } from "lucide-react";
import { OPENINGS } from "@/lib/data";
import { MAX_ATTEMPTS, clipDuration } from "@/lib/game";
import { evaluateGuess } from "@/lib/matching";
import {
  loadDailyState,
  saveDailyState,
  loadStats,
  loadHistory,
  recordResult,
  recordHistory,
  type GameStatus,
  type Stats,
} from "@/lib/storage";
import type { Opening } from "@/lib/types";
import OpeningPlayer, { type PlayMode } from "./OpeningPlayer";
import GuessInput from "./GuessInput";
import GuessList, { type GuessEntry } from "./GuessList";
import HintBar from "./HintBar";
import ResultModal from "./ResultModal";

const SKIP: GuessEntry = { text: "(pulou)", result: "wrong" };

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
  /** rótulo amigável do modo livre (livre/fases/...) p/ o histórico */
  freeModeLabel?: string;
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
  freeModeLabel,
  renderPlayer,
}: Props) {
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
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
        // Auto-recupera histórico de partidas finalizadas antes do fix:
        // se o jogo está como won/lost mas não há entrada no histórico
        // para este puzzle, registra agora. `recordHistory` dedupa por
        // puzzle, então não cria duplicata.
        const hasEntry = loadHistory().some(
          (e) => e.mode === "daily" && e.puzzle === puzzle,
        );
        if (!hasEntry) {
          recordHistory({
            timestamp: Date.now(),
            mode: "daily",
            puzzle,
            animeName: opening.animeName,
            themeSlug: opening.themeSlug,
            songTitle: opening.songTitle,
            won: saved.status === "won",
            attempts: saved.guesses.length,
          });
        }
      }
    } else {
      setGuesses([]);
      setStatus("playing");
      setShowModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, puzzle, opening.id]);

  const wrongGuesses =
    status === "won" ? guesses.length - 1 : guesses.length;
  const gameOver = status !== "playing";

  function finish(nextStatus: GameStatus, nextGuesses: GuessEntry[]) {
    setStatus(nextStatus);
    const isWin = nextStatus === "won";

    // Stats e estado salvo (modo diário): idempotente por puzzle.
    if (mode === "daily" && puzzle !== undefined && !recorded.current) {
      saveDailyState({ puzzle, status: nextStatus, guesses: nextGuesses });
      recorded.current = true;
      const s = recordResult(puzzle, isWin, nextGuesses.length);
      setStats(s);
    } else if (mode === "daily" && puzzle !== undefined) {
      // Já contabilizado, mas ainda atualiza o estado salvo.
      saveDailyState({ puzzle, status: nextStatus, guesses: nextGuesses });
    }

    // Histórico unificado — todos os modos. `recordHistory` dedupa por puzzle
    // no modo daily, então rejogar o mesmo dia não cria duplicata.
    recordHistory({
      timestamp: Date.now(),
      mode: mode === "daily" ? "daily" : (freeModeLabel ?? "free"),
      puzzle: mode === "daily" ? puzzle : undefined,
      animeName: opening.animeName,
      themeSlug: opening.themeSlug,
      won: isWin,
      attempts: nextGuesses.length,
    });

    setTimeout(() => setShowModal(true), 600);
  }

  function applyGuess(entry: GuessEntry) {
    if (gameOver) return;
    const next = [...guesses, entry];
    setGuesses(next);
    if (mode === "daily" && puzzle !== undefined) {
      saveDailyState({ puzzle, status: "playing", guesses: next });
    }
    if (entry.result === "exact") {
      finish("won", next);
    } else if (next.length >= MAX_ATTEMPTS) {
      finish("lost", next);
    }
  }

  function handleGuess(label: string) {
    const result = evaluateGuess(label, opening);
    applyGuess({ text: label, result });
  }

  function handleSkip() {
    applyGuess(SKIP);
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
            openings={OPENINGS}
            onGuess={handleGuess}
            onSkip={handleSkip}
            disabled={gameOver}
          />
        </>
      )}

      <GuessList guesses={guesses} />

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
