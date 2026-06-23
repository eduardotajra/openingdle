// Persistência de progresso e estatísticas no localStorage.
import { MAX_ATTEMPTS } from "./game";

const STATE_PREFIX = "animedle:daily:";
const STATS_KEY = "animedle:stats";

export type GameStatus = "playing" | "won" | "lost";

/** Estado do jogo diário de um dia específico. */
export interface DailyState {
  puzzle: number;
  status: GameStatus;
  guesses: string[]; // textos dos palpites (errados + o certo)
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
  if (saved && saved.puzzle === puzzle) return saved;
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
    // streak continua se o puzzle anterior foi o registrado por último
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
