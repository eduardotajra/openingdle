// Acesso ao manifesto de faixas separadas (modo Fases).
import stemsJson from "@/data/stems.json";
import { OPENINGS } from "./data";
import type { Opening, StemsEntry } from "./types";

export const STEMS: StemsEntry[] = stemsJson as StemsEntry[];

const byId = new Map(STEMS.map((s) => [s.id, s]));
const openingById = new Map(OPENINGS.map((o) => [o.id, o]));

export interface StemRound {
  opening: Opening;
  entry: StemsEntry;
}

/** Aberturas que possuem faixas separadas disponíveis. */
export function stemRounds(): StemRound[] {
  const rounds: StemRound[] = [];
  for (const entry of STEMS) {
    const opening = openingById.get(entry.id);
    if (opening) rounds.push({ opening, entry });
  }
  return rounds;
}

export function hasStems(): boolean {
  return stemRounds().length > 0;
}

export function getStems(id: string): StemsEntry | undefined {
  return byId.get(id);
}

/** Rodada aleatória entre as aberturas com faixas. */
export function randomStemRound(): StemRound | null {
  const rounds = stemRounds();
  if (rounds.length === 0) return null;
  return rounds[Math.floor(Math.random() * rounds.length)];
}
