"use client";

import { Check, X } from "lucide-react";

interface Props {
  guesses: string[];
  correctAnswer?: string; // se definido, o último palpite certo aparece em verde
}

export default function GuessList({ guesses, correctAnswer }: Props) {
  if (guesses.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {guesses.map((g, i) => {
        const isCorrect =
          correctAnswer !== undefined &&
          i === guesses.length - 1 &&
          g === correctAnswer;
        return (
          <li
            key={`${g}-${i}`}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
              isCorrect
                ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                : "border-[var(--color-crimson)]/30 bg-[var(--color-crimson)]/10 text-[var(--color-sand)]/80"
            }`}
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full ${
                isCorrect
                  ? "bg-[var(--color-gold)]/20"
                  : "bg-[var(--color-crimson)]/25"
              }`}
            >
              {isCorrect ? (
                <Check
                  className="h-3 w-3 text-[var(--color-gold)]"
                  strokeWidth={3}
                />
              ) : (
                <X
                  className="h-3 w-3 text-[var(--color-crimson)]"
                  strokeWidth={3}
                />
              )}
            </span>
            <span className="text-[var(--color-sand)]">{g}</span>
          </li>
        );
      })}
    </ul>
  );
}
