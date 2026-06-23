import { isCorrect, searchAnime } from "../lib/matching.ts";
import { dailyIndex, puzzleNumber, dailyStartFraction } from "../lib/dailySeed.ts";
import { buildShareText } from "../lib/share.ts";
import type { Opening } from "../lib/types.ts";

const op = {
  id: "x",
  animeName: "Naruto Shippuuden",
  aliases: ["Naruto Shippuden", "Naruto: Shippuuden"],
  year: 2007,
  season: "Winter",
  studio: null,
  themeSlug: "OP1",
  songTitle: "Hero's Come Back!!",
  videoUrl: "",
  audioUrl: null,
} as Opening;

console.log("matching:");
console.log("  exato:", isCorrect("Naruto Shippuuden", op));
console.log("  alias:", isCorrect("naruto shippuden", op));
console.log("  acento/caixa:", isCorrect("NARUTO  SHIPPUDEN", op));
console.log("  typo(1):", isCorrect("Naruto Shippuudenn", op));
console.log("  errado:", isCorrect("Bleach", op));

console.log("determinismo:");
const d = new Date("2026-06-23T10:00:00Z");
console.log("  idx1:", dailyIndex(314, d), "idx2:", dailyIndex(314, d));
console.log("  outro dia:", dailyIndex(314, new Date("2026-06-24T10:00:00Z")));
console.log("  puzzle#:", puzzleNumber(d), "startFrac:", dailyStartFraction(d).toFixed(3));

console.log("share:");
console.log(JSON.stringify(buildShareText({ puzzle: 905, won: true, attempts: 4 })));
console.log(JSON.stringify(buildShareText({ puzzle: 905, won: false, attempts: 6 })));

const list = [
  { name: "Naruto", aliases: ["Naruto"] },
  { name: "Naruto Shippuuden", aliases: [] },
  { name: "Bleach", aliases: [] },
];
console.log("autocomplete 'naru':", searchAnime("naru", list).map((x) => x.name));
