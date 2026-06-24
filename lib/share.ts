// Geração do texto de compartilhamento (estilo Wordle).
import { MAX_ATTEMPTS } from "./game";

interface ShareInput {
  puzzle: number;
  won: boolean;
  /** nº de palpites usados (inclui o certo, se houve) */
  attempts: number;
}

export function buildShareText({ puzzle, won, attempts }: ShareInput): string {
  const wrong = won ? attempts - 1 : attempts;
  const squares =
    "🟥".repeat(wrong) +
    (won ? "🟩" : "") +
    "⬛".repeat(Math.max(0, MAX_ATTEMPTS - wrong - (won ? 1 : 0)));
  const score = won ? `${attempts}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
  return `Openingdle #${puzzle} ${score}\n${squares}`;
}
