// Normalização de texto, verificação de acerto e busca para autocomplete.
import type { Opening, AnimeListItem } from "./types";

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

/** O palpite acerta a abertura? Compara contra nome + apelidos (tolerante). */
export function isCorrect(guess: string, opening: Opening): boolean {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [opening.animeName, ...opening.aliases].map(normalize);
  return candidates.some((c) => {
    if (c === g) return true;
    // tolera 1 erro de digitação em títulos com 5+ caracteres
    if (c.length >= 5 && levenshtein(c, g) <= 1) return true;
    return false;
  });
}

/** Sugestões de autocomplete a partir da lista de animes. */
export function searchAnime(
  query: string,
  list: AnimeListItem[],
  limit = 8,
): AnimeListItem[] {
  const q = normalize(query);
  if (!q) return [];
  const scored: { item: AnimeListItem; score: number }[] = [];
  for (const item of list) {
    const names = [item.name, ...item.aliases].map(normalize);
    let best = Infinity;
    for (const name of names) {
      if (name === q) best = Math.min(best, 0);
      else if (name.startsWith(q)) best = Math.min(best, 1);
      else if (name.includes(q)) best = Math.min(best, 2);
    }
    if (best < Infinity) scored.push({ item, score: best });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((s) => s.item);
}
