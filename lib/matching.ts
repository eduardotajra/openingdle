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

/** Igualdade tolerante: idêntico ou 1 letra de diferença em palavras de 5+. */
function looseEq(a: string, b: string): boolean {
  if (a === b) return true;
  const minLen = Math.min(a.length, b.length);
  return minLen >= 5 && levenshtein(a, b) <= 1;
}

export type GuessResult =
  | "exact" // anime + opening corretos
  | "anime" // anime correto, opening errada
  | "wrong"; // não bateu nada

/** Sugestão de autocomplete: uma entrada por opening do dataset. */
export interface OpeningSuggestion {
  /** texto exibido e usado como guess. Ex: "Naruto - Rocks" */
  label: string;
  /** opening por trás dessa sugestão */
  opening: Opening;
}

/** Nome da música canônico para uso no label. Fallback para themeSlug. */
function displaySongTitle(o: Opening): string {
  const t = (o.songTitle ?? "").trim();
  return t.length > 0 ? t : o.themeSlug;
}

/** Constrói o pool de sugestões — uma entrada por opening. */
export function buildSuggestionPool(openings: Opening[]): OpeningSuggestion[] {
  return openings.map((o) => ({
    label: `${o.animeName} - ${displaySongTitle(o)}`,
    opening: o,
  }));
}

/**
 * Avalia um palpite. Aceita várias formas:
 *   - "Naruto - Rocks" / "Naruto Rocks"         → compara anime + música
 *   - "Naruto OP1" / "Naruto opening 1"          → compara anime + slug
 *   - "Naruto"                                    → só anime → "anime"
 *
 * Retorna "exact" se o anime e a opening (música OU slug) batem.
 * "anime" se acerta o anime mas a opening jogada é outra.
 * "wrong" se nem o anime bate.
 */
export function evaluateGuess(guess: string, correct: Opening): GuessResult {
  const g = normalize(guess);
  if (!g) return "wrong";

  // Lista de aliases do anime correto (já normalizada).
  const animeNames = [correct.animeName, ...correct.aliases].map(normalize);

  // Encontra qual candidato de anime cabe no início do palpite (maior match
  // primeiro, para não cortar prefixos curtos por engano).
  const candidates = animeNames
    .slice()
    .sort((a, b) => b.length - a.length);
  let animeMatch: string | null = null;
  let rest = "";
  for (const name of candidates) {
    if (g === name) {
      animeMatch = name;
      rest = "";
      break;
    }
    if (g.startsWith(name + " ")) {
      animeMatch = name;
      rest = g.slice(name.length + 1).trim();
      break;
    }
  }

  // Fallback: aceita typo no nome do anime quando o palpite tem só uma "parte"
  // (sem música). Casa "Naruto Shippudden" → "Naruto Shippuuden".
  if (!animeMatch) {
    for (const name of candidates) {
      if (looseEq(name, g)) {
        animeMatch = name;
        rest = "";
        break;
      }
    }
  }

  if (!animeMatch) return "wrong";

  // Sem "resto" → só o anime: anime certo, opening não especificada.
  if (!rest) return "anime";

  // Resto pode ser: slug (OP1/ED2/opening 1) ou nome da música.
  // (1) Slug?
  const slugMatch = rest.match(/^(op|opening|ed|ending)\s*(\d+)$/);
  if (slugMatch) {
    const kind =
      slugMatch[1] === "ed" || slugMatch[1] === "ending" ? "ED" : "OP";
    const guessedSlug = `${kind}${slugMatch[2]}`;
    return normalize(guessedSlug) === normalize(correct.themeSlug)
      ? "exact"
      : "anime";
  }

  // (2) Nome da música?
  const song = normalize(correct.songTitle ?? "");
  if (song && looseEq(song, rest)) return "exact";

  // Não bateu nem slug, nem música — anime certo, opening errada.
  return "anime";
}

/** Sugestões de autocomplete. Busca por anime ou nome da música. */
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
    const songNorm = normalize(item.opening.songTitle ?? "");
    let best = Infinity;
    if (labelNorm === q || songNorm === q) best = 0;
    else if (animeNorm === q) best = 1;
    else if (animeNorm.startsWith(q)) best = 2;
    else if (songNorm && songNorm.startsWith(q)) best = 3;
    else if (labelNorm.startsWith(q)) best = 4;
    else if (
      animeNorm.includes(q) ||
      labelNorm.includes(q) ||
      (songNorm && songNorm.includes(q))
    )
      best = 5;
    if (best < Infinity) {
      scored.push({ item, score: best, tie: item.label });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score || a.tie.localeCompare(b.tie))
    .slice(0, limit)
    .map((s) => s.item);
}
