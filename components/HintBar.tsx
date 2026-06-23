"use client";

import type { Opening } from "@/lib/types";
import { HINTS, MAX_ATTEMPTS, revealedHintCount } from "@/lib/game";

interface Props {
  opening: Opening;
  /** Nº de palpites errados já feitos. */
  wrongGuesses: number;
}

export default function HintBar({ opening, wrongGuesses }: Props) {
  const revealed = revealedHintCount(wrongGuesses);
  const nextHint = revealed < HINTS.length ? HINTS[revealed] : null;

  return (
    <div className="space-y-3">
      {/* Indicador de tentativas */}
      <div className="flex items-center justify-center gap-2">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
            <span
              key={i}
              className={`h-2 w-6 rounded-full transition ${
                i < wrongGuesses
                  ? "bg-[var(--color-crimson)]"
                  : "bg-[var(--color-gold)]/20"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-[var(--color-sand)]/65">
          {MAX_ATTEMPTS - wrongGuesses} restante
          {MAX_ATTEMPTS - wrongGuesses === 1 ? "" : "s"}
        </span>
      </div>

      {/* Dicas reveladas — estilo "pista no pergaminho" */}
      {revealed > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {HINTS.slice(0, revealed).map((h) => (
            <span
              key={h.label}
              className="rounded-full border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 px-3 py-1 text-sm text-[var(--color-sand)] backdrop-blur"
            >
              <span className="text-[var(--color-gold)]/65">{h.label}</span>{" "}
              <span className="font-medium">{h.value(opening)}</span>
            </span>
          ))}
        </div>
      )}

      {nextHint && (
        <p className="text-center text-xs text-[var(--color-sand)]/55">
          Próxima pista ao errar:{" "}
          <strong className="font-medium text-[var(--color-gold)]/70">
            {nextHint.label}
          </strong>
        </p>
      )}
    </div>
  );
}
