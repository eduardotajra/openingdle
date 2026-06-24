// Acesso tipado ao dataset gerado pelo seed.
import openingsJson from "@/data/openings.json";
import type { Opening } from "./types";
import { hashString } from "./dailySeed";

/**
 * Aceita só a versão canônica de cada abertura: themeSlug do tipo `OP1`,
 * `OP12`, `ED2`. Filtra qualquer variante com sufixo:
 *   - `-EN`, `-EN4Kids`  → dublagens (poluem o autocomplete)
 *   - `-RepeatShow`      → re-exibições (música idêntica à OP original)
 *   - `-YorinukiGintamaSan` → best-of (música idêntica)
 *   - `-TV`              → "TV size" duplicada
 * O jogo fica com 1 entrada por OP/ED de cada anime, sem ruído.
 */
const CANONICAL_SLUG = /^(OP|ED)\d+$/i;

function isCosmeticVariant(o: Opening): boolean {
  return !CANONICAL_SLUG.test(o.themeSlug);
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
