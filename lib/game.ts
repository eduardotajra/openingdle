// Regras e configuração do jogo (compartilhadas entre modos diário e livre).
import type { Opening } from "./types";

/** Número máximo de tentativas. */
export const MAX_ATTEMPTS = 6;

/**
 * Segundos da abertura revelados em cada tentativa (índice = nº de palpites
 * já feitos). A janela cresce a cada erro. Tamanho deve ser >= MAX_ATTEMPTS.
 */
export const CLIP_WINDOWS = [1, 2, 4, 7, 11, 16];

/** Duração revelada na tentativa atual (em segundos). */
export function clipDuration(attempt: number): number {
  return CLIP_WINDOWS[Math.min(attempt, CLIP_WINDOWS.length - 1)];
}

const SEASON_PT: Record<string, string> = {
  Winter: "Inverno",
  Spring: "Primavera",
  Summer: "Verão",
  Fall: "Outono",
};

export interface Hint {
  label: string;
  value: (o: Opening) => string;
}

/**
 * Dicas progressivas. A dica de índice `i` é liberada após `i + 1` palpites
 * errados. Usamos só campos confiáveis da API (ano, temporada, título da
 * música) — estúdio costuma vir vazio na AnimeThemes.
 */
export const HINTS: Hint[] = [
  { label: "Ano", value: (o) => (o.year ? String(o.year) : "?") },
  {
    label: "Temporada",
    value: (o) => (o.season ? (SEASON_PT[o.season] ?? o.season) : "?"),
  },
  {
    label: "Palavras no título",
    value: (o) => String(o.animeName.trim().split(/\s+/).length),
  },
  { label: "Inicial", value: (o) => o.animeName.charAt(0).toUpperCase() },
  { label: "Música", value: (o) => o.songTitle ?? "?" },
];

/** Quantas dicas estão visíveis após `wrongGuesses` erros. */
export function revealedHintCount(wrongGuesses: number): number {
  return Math.min(wrongGuesses, HINTS.length);
}
