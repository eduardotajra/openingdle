// Escolha determinística do desafio do dia.
// O mesmo dia (UTC) gera o mesmo índice para todos os jogadores.

/** Data de início do jogo (puzzle #0). */
const EPOCH = Date.UTC(2024, 0, 1); // 2024-01-01
const DAY_MS = 86_400_000;

/** Chave do dia atual, ex: "2026-06-23" (em UTC). */
export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Número sequencial do puzzle do dia (0 = EPOCH). */
export function puzzleNumber(date: Date = new Date()): number {
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return Math.floor((today - EPOCH) / DAY_MS);
}

/** Hash estável (FNV-1a) de uma string → inteiro sem sinal de 32 bits. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Índice determinístico no pool para a data informada. */
export function dailyIndex(poolLength: number, date: Date = new Date()): number {
  if (poolLength <= 0) return 0;
  return hashString(`opening:${todayKey(date)}`) % poolLength;
}

/**
 * Fração 0..1 determinística usada para escolher de onde começa o trecho
 * (calculada com a duração real do vídeo no cliente).
 */
export function dailyStartFraction(date: Date = new Date()): number {
  return (hashString(`start:${todayKey(date)}`) % 1000) / 1000;
}
