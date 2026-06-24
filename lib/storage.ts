// Persistência de progresso, estatísticas, histórico e pontuação no localStorage.
import { MAX_ATTEMPTS } from "./game";
import type { GuessEntry } from "@/components/GuessList";

const STATE_PREFIX = "openingdle:daily:";
const STATS_KEY = "openingdle:stats";
const HISTORY_KEY = "openingdle:history";

/** Quantos jogos guardar no histórico. */
export const HISTORY_LIMIT = 100;

export type GameStatus = "playing" | "won" | "lost";

/** Estado do jogo diário de um dia específico. */
export interface DailyState {
  puzzle: number;
  status: GameStatus;
  guesses: GuessEntry[];
}

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  /** distribuição de vitórias por nº de tentativas (índice 1..MAX_ATTEMPTS) */
  distribution: number[];
  lastRecordedPuzzle: number | null;
}

/** Entrada do histórico (cross-mode). */
export interface HistoryEntry {
  /** ms desde epoch */
  timestamp: number;
  /** "daily" | "free" | "fases" | "audio" | "video" | "frame"... */
  mode: string;
  /** nº do puzzle diário (só no modo daily) */
  puzzle?: number;
  /** anime da resposta */
  animeName: string;
  /** OP1, OP2... */
  themeSlug: string;
  /** Nome da música (preferido na exibição quando disponível) */
  songTitle?: string | null;
  /** ganhou ou perdeu */
  won: boolean;
  /** nº de palpites usados */
  attempts: number;
}

const isBrowser = typeof window !== "undefined";

function read<T>(key: string): T | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/privado: ignora */
  }
}

// ---- Estado diário ---------------------------------------------------------

export function loadDailyState(puzzle: number): DailyState {
  const saved = read<DailyState>(STATE_PREFIX + puzzle);
  if (saved && saved.puzzle === puzzle) {
    // Compatibilidade com versões antigas que salvavam guesses: string[].
    if (saved.guesses.length > 0 && typeof saved.guesses[0] === "string") {
      const upgraded = (saved.guesses as unknown as string[]).map<GuessEntry>(
        (t) => ({ text: t, result: "wrong" }),
      );
      return { ...saved, guesses: upgraded };
    }
    return saved;
  }
  return { puzzle, status: "playing", guesses: [] };
}

export function saveDailyState(state: DailyState): void {
  write(STATE_PREFIX + state.puzzle, state);
}

// ---- Estatísticas ----------------------------------------------------------

export function loadStats(): Stats {
  return (
    read<Stats>(STATS_KEY) ?? {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: new Array(MAX_ATTEMPTS + 1).fill(0),
      lastRecordedPuzzle: null,
    }
  );
}

/**
 * Registra o resultado de um puzzle diário (idempotente por puzzle).
 * `attempts` = número de palpites usados (relevante só em vitória).
 */
export function recordResult(
  puzzle: number,
  won: boolean,
  attempts: number,
): Stats {
  const stats = loadStats();
  if (stats.lastRecordedPuzzle === puzzle) return stats; // já contabilizado

  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak =
      stats.lastRecordedPuzzle === puzzle - 1 ? stats.currentStreak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    if (attempts >= 1 && attempts <= MAX_ATTEMPTS) {
      stats.distribution[attempts] += 1;
    }
  } else {
    stats.currentStreak = 0;
  }
  stats.lastRecordedPuzzle = puzzle;
  write(STATS_KEY, stats);
  return stats;
}

// ---- Histórico (cross-mode) -----------------------------------------------

export function loadHistory(): HistoryEntry[] {
  const arr = read<HistoryEntry[]>(HISTORY_KEY);
  return Array.isArray(arr) ? arr : [];
}

/**
 * Insere uma entrada no histórico (mais recente primeiro). Trunca em
 * HISTORY_LIMIT entradas para não estourar a quota.
 */
export function recordHistory(entry: HistoryEntry): HistoryEntry[] {
  const list = loadHistory();
  // Evita duplicar o mesmo puzzle diário em sessões repetidas.
  if (entry.puzzle !== undefined) {
    const i = list.findIndex(
      (e) => e.mode === "daily" && e.puzzle === entry.puzzle,
    );
    if (i >= 0) list.splice(i, 1);
  }
  list.unshift(entry);
  while (list.length > HISTORY_LIMIT) list.pop();
  write(HISTORY_KEY, list);
  return list;
}

// ---- Pontuação ------------------------------------------------------------

/**
 * Pontos por partida. Lost = 0. Win = base 100 que decresce a cada tentativa.
 * Tabela: 1 tentativa → 100, 2 → 80, 3 → 60, 4 → 45, 5 → 30, 6 → 15.
 */
export function scoreFor(entry: HistoryEntry): number {
  if (!entry.won) return 0;
  const TABLE = [0, 100, 80, 60, 45, 30, 15];
  return TABLE[entry.attempts] ?? 10;
}

/** Pontuação total (soma todos os jogos do histórico). */
export function totalScore(history: HistoryEntry[] = loadHistory()): number {
  return history.reduce((sum, e) => sum + scoreFor(e), 0);
}
