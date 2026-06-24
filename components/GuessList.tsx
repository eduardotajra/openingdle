"use client";

import { Check, CircleHelp, X } from "lucide-react";
import type { GuessResult } from "@/lib/matching";

/** Cada palpite carrega o texto e o resultado avaliado. */
export interface GuessEntry {
  text: string;
  result: GuessResult;
}

interface Props {
  guesses: GuessEntry[];
}

export default function GuessList({ guesses }: Props) {
  if (guesses.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {guesses.map((g, i) => {
        const styles = STYLES[g.result];
        const Icon = styles.Icon;
        return (
          <li
            key={`${g.text}-${i}`}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${styles.row}`}
          >
            <span
              className={`grid h-5 w-5 place-items-center rounded-full ${styles.iconBg}`}
            >
              <Icon
                className={`h-3 w-3 ${styles.iconColor}`}
                strokeWidth={3}
              />
            </span>
            <span className="flex-1 text-[var(--color-sand)]">{g.text}</span>
            {styles.tag && (
              <span className={`text-xs font-medium ${styles.tagColor}`}>
                {styles.tag}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const STYLES: Record<
  GuessResult,
  {
    row: string;
    iconBg: string;
    iconColor: string;
    Icon: typeof Check;
    tag: string | null;
    tagColor: string;
  }
> = {
  exact: {
    row: "border-[var(--color-gold)]/55 bg-[var(--color-gold)]/15",
    iconBg: "bg-[var(--color-gold)]/25",
    iconColor: "text-[var(--color-gold)]",
    Icon: Check,
    tag: null,
    tagColor: "",
  },
  anime: {
    row: "border-amber-400/40 bg-amber-400/10",
    iconBg: "bg-amber-400/25",
    iconColor: "text-amber-300",
    Icon: CircleHelp,
    tag: "Anime correto, opening errada",
    tagColor: "text-amber-300",
  },
  wrong: {
    row: "border-[var(--color-crimson)]/30 bg-[var(--color-crimson)]/10",
    iconBg: "bg-[var(--color-crimson)]/25",
    iconColor: "text-[var(--color-crimson)]",
    Icon: X,
    tag: null,
    tagColor: "",
  },
};
