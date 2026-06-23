import { ScrollText } from "lucide-react";
import GameBoard from "@/components/GameBoard";
import { dailyOpening } from "@/lib/data";
import { puzzleNumber, dailyStartFraction } from "@/lib/dailySeed";

// Renderiza por requisição (o desafio depende da data atual).
export const dynamic = "force-dynamic";

export default function DailyPage() {
  const now = new Date();
  const opening = dailyOpening(now);
  const puzzle = puzzleNumber(now);
  const startFraction = dailyStartFraction(now);

  return (
    <div>
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--color-gold)]/50 bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-crimson)]/20 shadow-lg shadow-[var(--color-gold)]/10">
          <ScrollText className="h-5 w-5 text-[var(--color-gold)]" strokeWidth={2} />
        </div>
        <h1 className="font-display text-4xl text-[var(--color-gold)]">
          Pergaminho do Dia
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand)]/70">
          Travessia{" "}
          <span className="font-mono text-[var(--color-sand)]">#{puzzle}</span>{" "}
          • Toque o trecho e desvende a abertura
        </p>
      </header>

      <GameBoard
        mode="daily"
        opening={opening}
        puzzle={puzzle}
        startFraction={startFraction}
      />
    </div>
  );
}
