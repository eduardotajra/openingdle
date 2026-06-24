// Normalização de texto, verificação de acerto e busca para autocomplete.
import type { Opening } from "./types";

/** minúsculas, sem acento, sem pontuação, espaços colapsados. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Distância de Levenshtein (para tolerar pequenos erros de digitação). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Compara duas strings com tolerância a typo (1 letra de erro se >=5 chars).
 */
function looseEq(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  return minLen >= 5 && levenshtein(a, b) <= 1;
}

export type GuessResult =
  | "exact" // anime + opening corretos
  | "anime" // anime correto, opening errada
  | "wrong"; // não bateu nada

/**
 * Sugestão de autocomplete: cada abertura individual ("Naruto OP1", "Naruto
 * OP3"…). O usuário escolhe (anime, opening) na mesma string.
 */
export interface OpeningSuggestion {
  /** texto exibido e usado como guess, ex: "Naruto OP1" */
  label: string;
  /** opening por trás dessa sugestão */
  opening: Opening;
}

/**
 * Constrói o pool de sugestões a partir de todas as aberturas (uma entrada
 * por opening). Pode ser chamado uma vez e reusado.
 */
export function buildSuggestionPool(openings: Opening[]): OpeningSuggestion[] {
  return openings.map((o) => ({
    label: `${o.animeName} ${o.themeSlug}`,
    opening: o,
  }));
}

/**
 * Avalia um palpite contra a abertura correta. Aceita tanto:
 *   - "Naruto OP1"   → compara anime + slug
 *   - "Naruto"        → só anime; vira "anime" se acertar o anime e
 *                       a opening jogada for outra, senão "wrong"
 */
export function evaluateGuess(guess: string, correct: Opening): GuessResult {
  const g = normalize(guess);
  if (!g) return "wrong";

  // Extrai o slug do final do palpite, se houver (op1, op 1, opening 1…)
  const slugMatch = g.match(/\b(op|opening|ed|ending)\s*(\d+)\s*$/);
  const guessedSlug = slugMatch
    ? `${slugMatch[1] === "ed" || slugMatch[1] === "ending" ? "ED" : "OP"}${slugMatch[2]}`
    : null;
  const guessAnime = slugMatch
    ? g.slice(0, slugMatch.index).trim()
    : g;

  const animeNames = [correct.animeName, ...correct.aliases].map(normalize);
  const animeHit = animeNames.some((n) => looseEq(n, guessAnime));

  if (!animeHit) return "wrong";

  // Se a pessoa especificou OP/ED, exige bater. Senão, "anime" (sem opening).
  if (guessedSlug) {
    return normalize(guessedSlug) === normalize(correct.themeSlug)
      ? "exact"
      : "anime";
  }
  return "anime";
}

/** Sugestões de autocomplete para um query (busca por anime). */
export function searchSuggestions(
  query: string,
  pool: OpeningSuggestion[],
  limit = 8,
): OpeningSuggestion[] {
  const q = normalize(query);
  if (!q) return [];

  const scored: { item: OpeningSuggestion; score: number; tie: string }[] = [];
  for (const item of pool) {
    const labelNorm = normalize(item.label);
    const animeNorm = normalize(item.opening.animeName);
    let best = Infinity;
    if (labelNorm === q) best = 0;
    else if (animeNorm === q) best = 1;
    else if (animeNorm.startsWith(q)) best = 2;
    else if (labelNorm.startsWith(q)) best = 3;
    else if (animeNorm.includes(q) || labelNorm.includes(q)) best = 4;
    if (best < Infinity) {
      scored.push({ item, score: best, tie: item.label });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.tie.localeCompare(b.tie))
    .slice(0, limit)
    .map((s) => s.item);
}
