"use client";

import { useEffect, useState } from "react";
import { Calendar, Check, History, Trophy, X } from "lucide-react";
import {
  loadHistory,
  loadStats,
  scoreFor,
  totalScore,
  type HistoryEntry,
  type Stats,
} from "@/lib/storage";

const MODE_LABEL: Record<string, string> = {
  daily: "Diário",
  free: "Livre",
  audio: "Apenas áudio",
  video: "Apenas imagem",
  frame: "Frame estático",
  fases: "Fases",
};

export default function HistoricoPage() {
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setStats(loadStats());
  }, []);

  if (history === null || stats === null) {
    return (
      <p className="text-center text-[var(--color-sand)]/60">Carregando…</p>
    );
  }

  const total = totalScore(history);
  const wins = history.filter((h) => h.won).length;

  return (
    <div>
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--color-gold)]/50 bg-gradient-to-br from-[var(--color-gold)]/20 to-[var(--color-crimson)]/20 shadow-lg shadow-[var(--color-gold)]/10">
          <History
            className="h-5 w-5 text-[var(--color-gold)]"
            strokeWidth={2}
          />
        </div>
        <h1 className="font-display text-4xl text-[var(--color-gold)]">
          Diário de Bordo
        </h1>
        <p className="mt-1 text-sm text-[var(--color-sand)]/70">
          Suas últimas travessias e o tesouro acumulado.
        </p>
      </header>

      {/* Painel de pontuação total + estatísticas diárias */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat
          label="Pontos"
          value={total.toLocaleString("pt-BR")}
          accent
        />
        <BigStat label="Partidas" value={history.length} />
        <BigStat label="Vitórias" value={wins} />
        <BigStat label="Sequência" value={stats.currentStreak} />
      </section>

      {/* Lista */}
      {history.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/30 p-8 text-center">
          <Trophy
            className="mx-auto mb-3 h-8 w-8 text-[var(--color-gold)]/40"
            strokeWidth={1.5}
          />
          <p className="font-medium text-[var(--color-sand)]">
            Nenhuma partida ainda
          </p>
          <p className="mt-1 text-sm text-[var(--color-sand)]/60">
            Jogue o diário ou o modo livre para começar a registrar.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {history.map((h, i) => (
            <li key={`${h.timestamp}-${i}`}>
              <Row entry={h} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        accent
          ? "border-[var(--color-gold)]/50 bg-gradient-to-br from-[var(--color-gold)]/15 to-[var(--color-crimson)]/10"
          : "border-[var(--color-gold)]/15 bg-[var(--color-ocean-deep)]/40"
      }`}
    >
      <div
        className={`font-mono text-2xl font-bold tabular-nums ${
          accent ? "text-[var(--color-gold)]" : "text-[var(--color-sand)]"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--color-sand)]/60">
        {label}
      </div>
    </div>
  );
}

function Row({ entry }: { entry: HistoryEntry }) {
  const date = new Date(entry.timestamp);
  const score = scoreFor(entry);
  const modeLabel = MODE_LABEL[entry.mode] ?? entry.mode;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-ocean)]/30 px-3 py-2.5 text-sm">
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          entry.won
            ? "bg-[var(--color-gold)]/25"
            : "bg-[var(--color-crimson)]/25"
        }`}
      >
        {entry.won ? (
          <Check
            className="h-3.5 w-3.5 text-[var(--color-gold)]"
            strokeWidth={3}
          />
        ) : (
          <X
            className="h-3.5 w-3.5 text-[var(--color-crimson)]"
            strokeWidth={3}
          />
        )}
      </span>

      <div className="flex-1 min-w-0">
        <div className="truncate text-[var(--color-sand)]">
          {entry.animeName}
          {entry.songTitle?.trim() ? (
            <>
              {" "}
              <span className="italic text-[var(--color-sand)]/70">
                — {entry.songTitle}
              </span>{" "}
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-gold)]/60">
                {entry.themeSlug}
              </span>
            </>
          ) : (
            <>
              {" "}
              <span className="font-mono text-xs text-[var(--color-gold)]/70">
                {entry.themeSlug}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-sand)]/55">
          <span className="rounded-full bg-[var(--color-ocean-deep)]/60 px-2 py-0.5">
            {modeLabel}
          </span>
          {entry.puzzle !== undefined && (
            <span className="font-mono">#{entry.puzzle}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {date.toLocaleDateString("pt-BR")}
          </span>
          <span>•</span>
          <span>
            {entry.attempts} tentativa{entry.attempts === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="font-mono text-base font-bold tabular-nums text-[var(--color-gold)]">
          {score > 0 ? `+${score}` : "—"}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-sand)]/45">
          pts
        </div>
      </div>
    </div>
  );
}
