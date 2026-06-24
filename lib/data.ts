// Acesso tipado ao dataset gerado pelo seed.
import openingsJson from "@/data/openings.json";
import type { Opening } from "./types";
import { hashString } from "./dailySeed";

/**
 * Sufixos do themeSlug que indicam variantes cosméticas (mesma música, vídeo
 * praticamente idêntico) — re-runs e best-of. Ex: "OP1-RepeatShow",
 * "OP1-YorinukiGintamaSan". Filtramos para não duplicar no autocomplete nem
 * sortear como resposta do jogo.
 *
 * NÃO filtramos `-en` / `-en4kids` porque são dublagens com música diferente
 * (legítimas como opções separadas).
 */
const COSMETIC_SUFFIXES = ["-repeatshow", "-yorinukigintamasan"];

function isCosmeticVariant(o: Opening): boolean {
  const id = o.id.toLowerCase();
  return COSMETIC_SUFFIXES.some((s) => id.endsWith(s));
}

const ALL_OPENINGS = openingsJson as Opening[];

/**
 * Pool exposto ao app: já sem variantes cosméticas. Diário, livre, fases,
 * autocomplete — todos usam essa lista.
 */
export const OPENINGS: Opening[] = ALL_OPENINGS.filter(
  (o) => !isCosmeticVariant(o),
);

export function getOpeningById(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id);
}

/** Abertura aleatória (modo livre). */
export function randomOpening(): Opening {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

/** Abertura determinística do dia. */
export function dailyOpening(date: Date = new Date()): Opening {
  const idx =
    hashString(`opening:${date.toISOString().slice(0, 10)}`) % OPENINGS.length;
  return OPENINGS[idx];
}
