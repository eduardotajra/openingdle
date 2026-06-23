"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Check,
  Eye,
  Share2,
  Shuffle,
  XCircle,
} from "lucide-react";
import type { Opening } from "@/lib/types";
import type { Stats } from "@/lib/storage";
import { MAX_ATTEMPTS } from "@/lib/game";
import { buildShareText } from "@/lib/share";

interface Props {
  opening: Opening;
  won: boolean;
  attempts: number;
  /** Dados de compartilhamento/streak (só no modo diário). */
  daily?: { puzzle: number; stats: Stats };
  onClose: () => void;
  /** Ação do botão primário (ex: "Jogar outra" no modo livre). */
  onNext?: () => void;
  nextLabel?: string;
}

export default function ResultModal({
  opening,
  won,
  attempts,
  daily,
  onClose,
  onNext,
  nextLabel,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!daily) return;
    const text = buildShareText({ puzzle: daily.puzzle, won, attempts });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignora */
    }
  }

  const stats = daily?.stats;
  const winRate = stats && stats.played > 0
    ? Math.round((stats.wins / stats.played) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-gold)]/30 bg-gradient-to-b from-[var(--color-ocean)]/95 to-[var(--color-ocean-deep)]/95 p-6 shadow-2xl">
        <div className="flex flex-col items-center">
          {won ? (
            <CheckCircle2
              className="h-12 w-12 text-[var(--color-gold)]"
              strokeWidth={1.75}
            />
          ) : (
            <XCircle
              className="h-12 w-12 text-[var(--color-crimson)]"
              strokeWidth={1.75}
            />
          )}
          <h2
            className={`font-display mt-3 text-center text-3xl ${
              won ? "text-[var(--color-gold)]" : "text-[var(--color-crimson)]"
            }`}
          >
            {won ? "Tesouro encontrado!" : "Pista perdida no mar"}
          </h2>
        </div>

        <p className="mt-4 text-center text-[var(--color-sand)]/85">
          A resposta era{" "}
          <strong className="text-[var(--color-sand)]">
            {opening.animeName}
          </strong>
          {opening.songTitle && (
            <>
              {" "}—{" "}
              <em className="not-italic text-[var(--color-sand)]/70">
                {opening.songTitle}
              </em>{" "}
              <span className="text-[var(--color-sand)]/50">
                ({opening.themeSlug})
              </span>
            </>
          )}
          .
        </p>

        {won && (
          <p className="mt-1 text-center text-sm text-[var(--color-sand)]/65">
            Em {attempts} de {MAX_ATTEMPTS} tentativas.
          </p>
        )}

        {stats && (
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            <Stat label="Jogos" value={stats.played} />
            <Stat label="% Vitória" value={winRate} />
            <Stat label="Sequência" value={stats.currentStreak} />
            <Stat label="Recorde" value={stats.maxStreak} />
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {daily && (
            <button
              onClick={share}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--color-gold-soft)] to-[var(--color-gold)] px-4 py-2.5 font-semibold text-[var(--color-ocean-deep)] shadow-lg shadow-[var(--color-gold)]/30 transition hover:from-[var(--color-gold)] hover:to-[var(--color-gold-soft)]"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span>Compartilhar resultado</span>
                </>
              )}
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-4 py-2.5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/25 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)]"
            >
              <Shuffle className="h-4 w-4" />
              <span>{nextLabel ?? "Jogar outra"}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/40 px-4 py-2.5 font-medium text-[var(--color-sand)]/85 transition hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-ocean)]/60"
          >
            <Eye className="h-4 w-4" />
            <span>Ver abertura completa</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-ocean-deep)]/40 py-2.5">
      <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-gold)]">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-sand)]/55">
        {label}
      </div>
    </div>
  );
}
