// Acesso tipado ao dataset gerado pelo seed.
import openingsJson from "@/data/openings.json";
import type { Opening } from "./types";
import { hashString } from "./dailySeed";

export const OPENINGS = openingsJson as Opening[];

export function getOpeningById(id: string): Opening | undefined {
  return OPENINGS.find((o) => o.id === id);
}

/** Abertura aleatória (modo livre). */
export function randomOpening(): Opening {
  return OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
}

/** Abertura determinística do dia. */
export function dailyOpening(date: Date = new Date()): Opening {
  const idx = hashString(`opening:${date.toISOString().slice(0, 10)}`) % OPENINGS.length;
  return OPENINGS[idx];
}
