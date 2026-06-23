"use client";

import { useCallback, useEffect, useState } from "react";
import { Swords } from "lucide-react";
import GameBoard from "@/components/GameBoard";
import StemsPlayer from "@/components/StemsPlayer";
import { randomStemRound, type StemRound } from "@/lib/stems";

export default function FasesPage() {
  const [round, setRound] = useState<StemRound | null>(null);
  const [ready, setReady] = useState(false);

  const shuffle = useCallback(() => {
    setRound(randomStemRound());
  }, []);

  useEffect(() => {
    shuffle();
    setReady(true);
  }, [shuffle]);

  return (
    <div>
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--color-gold)]/50 bg-gradient-to-br from-[var(--color-crimson)]/30 to-[var(--color-ocean)]/40 shadow-lg shadow-[var(--color-crimson)]/20">
          <Swords className="h-5 w-5 text-[var(--color-gold)]" strokeWidth={2} />
        </div>
        <h1 className="font-display text-4xl text-[var(--color-gold)]">
          Quatro Faixas
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-sand)]/70">
          A música separada em 4 instrumentos. Comece pelo baixo; cada erro
          revela o próximo.
        </p>
      </header>

      {!ready ? (
        <p className="text-center text-[var(--color-sand)]/60">Carregando…</p>
      ) : round ? (
        <GameBoard
          key={round.opening.id}
          mode="free"
          opening={round.opening}
          startFraction={0}
          onNext={shuffle}
          renderPlayer={({ attempt, gameOver }) => (
            <StemsPlayer
              opening={round.opening}
              entry={round.entry}
              attempt={attempt}
              gameOver={gameOver}
            />
          )}
        />
      ) : (
        <div className="rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-ocean)]/30 p-6 text-center">
          <p className="text-lg font-medium text-[var(--color-sand)]">
            Em breve
          </p>
          <p className="mt-2 text-sm text-[var(--color-sand)]/70">
            Nenhuma abertura tem faixas separadas ainda. Gere com{" "}
            <code className="text-[var(--color-gold)]">
              scripts/separate_stems.py
            </code>
            .
          </p>
        </div>
      )}
    </div>
  );
}
