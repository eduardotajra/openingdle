/**
 * Gera o dataset do jogo a partir da API pública da AnimeThemes.
 *
 *   npm run seed
 *
 * Lê scripts/curated-titles.txt, busca cada título na API, extrai as aberturas
 * (type "OP") com vídeo + áudio e escreve:
 *   - data/openings.json    (pool de aberturas / respostas possíveis)
 *   - data/anime-list.json  (nomes únicos p/ autocomplete de palpites)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Opening, AnimeListItem } from "../lib/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const API = "https://api.animethemes.moe";

// ---- Tipos parciais da resposta da API (só o que usamos) -------------------
interface ApiAnime {
  name: string;
  year: number | null;
  season: string | null;
  animesynonyms?: { text: string }[];
  studios?: { name: string }[];
  animethemes?: ApiTheme[];
}
interface ApiTheme {
  slug: string;
  type: string;
  song?: { title: string | null } | null;
  animethemeentries?: ApiEntry[];
}
interface ApiEntry {
  nsfw: boolean;
  spoiler: boolean;
  version: number | null;
  videos?: ApiVideo[];
}
interface ApiVideo {
  link: string;
  resolution: number | null;
  size?: number;
  overlap?: string;
  nc?: boolean;
  audio?: { link: string } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const INCLUDE =
  "animethemes.animethemeentries.videos.audio,animethemes.song,studios,animesynonyms";

async function query(params: URLSearchParams): Promise<ApiAnime[]> {
  const res = await fetch(`${API}/anime?${params.toString()}`, {
    headers: { "User-Agent": "animedle-seed/1.0 (educational project)" },
  });
  if (!res.ok) {
    console.warn(`  ! HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { anime: ApiAnime[] };
  return json.anime ?? [];
}

/** Um anime "serve" se tiver pelo menos uma OP com vídeo. */
function hasUsableOp(a: ApiAnime): boolean {
  return (a.animethemes ?? []).some(
    (t) =>
      t.type === "OP" &&
      (t.animethemeentries ?? []).some(
        (e) => !e.nsfw && !e.spoiler && (e.videos ?? []).length > 0,
      ),
  );
}

async function fetchAnime(title: string): Promise<ApiAnime | null> {
  const target = slugify(title);

  // 1) Tenta correspondência exata pelo nome.
  const exact = await query(
    new URLSearchParams({
      "filter[name]": title,
      "page[size]": "5",
      include: INCLUDE,
    }),
  );
  const exactHit = exact.find((a) => slugify(a.name) === target && hasUsableOp(a));
  if (exactHit) return exactHit;

  // 2) Fallback: busca por relevância (lida com título em inglês/sinônimos).
  await sleep(150);
  const found = await query(
    new URLSearchParams({ q: title, "page[size]": "5", include: INCLUDE }),
  );
  // Prefere um resultado que tenha OP utilizável; senão o 1º.
  return found.find(hasUsableOp) ?? found[0] ?? exact[0] ?? null;
}

/**
 * Escolhe o encode mais leve aceitável para carregar rápido: a MENOR resolução
 * que ainda seja >= 360p (e, empatando, o menor arquivo, preferindo sem overlap).
 * Se nenhum chega a 360p, usa a maior resolução disponível.
 * (Threshold baixo porque o CDN da AnimeThemes é lento — vale priorizar
 * tamanho menor; em telas pequenas 360p ainda fica aceitável para um clipe.)
 */
function pickVideo(entry: ApiEntry): ApiVideo | null {
  const videos = (entry.videos ?? []).filter((v) => v.link);
  if (videos.length === 0) return null;

  const decent = videos.filter((v) => (v.resolution ?? 0) >= 360);
  if (decent.length > 0) {
    decent.sort((a, b) => {
      const ra = a.resolution ?? 9999;
      const rb = b.resolution ?? 9999;
      if (ra !== rb) return ra - rb; // menor resolução (>=480) primeiro
      const sa = a.size ?? Infinity;
      const sb = b.size ?? Infinity;
      if (sa !== sb) return sa - sb; // menor arquivo
      return (a.overlap === "None" ? 0 : 1) - (b.overlap === "None" ? 0 : 1);
    });
    return decent[0];
  }
  // fallback: nada >=480, pega a maior resolução disponível
  return videos.slice().sort((a, b) => (b.resolution ?? 0) - (a.resolution ?? 0))[0];
}

async function fetchAllAnimes(): Promise<ApiAnime[]> {
  // Pagina /anime?include=...&page[size]=100. AnimeThemes tem ~12 mil animes
  // mas a maioria não tem OP utilizável; o filtro acontece depois.
  const all: ApiAnime[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    const params = new URLSearchParams({
      "page[number]": String(page),
      "page[size]": String(pageSize),
      include: INCLUDE,
    });
    const url = `${API}/anime?${params.toString()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "animedle-seed/1.0 (educational project)" },
    });
    if (!res.ok) {
      console.warn(`  ! HTTP ${res.status} na página ${page}`);
      break;
    }
    const json = (await res.json()) as { anime: ApiAnime[]; meta?: { last_page?: number } };
    const list = json.anime ?? [];
    all.push(...list);
    const lastPage = json.meta?.last_page;
    process.stdout.write(`\r  paginando ${page}${lastPage ? `/${lastPage}` : ""}  ${all.length} animes`);
    if (list.length < pageSize) break;
    if (lastPage && page >= lastPage) break;
    page++;
    await sleep(200);
  }
  console.log();
  return all;
}

function extractOpenings(
  anime: ApiAnime,
  title: string | null,
  openings: Opening[],
  animeMap: Map<string, AnimeListItem>,
  seenIds: Set<string>,
): number {
  const aliases = [
    anime.name,
    ...(title ? [title] : []),
    ...(anime.animesynonyms ?? []).map((s) => s.text),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const studio = anime.studios?.[0]?.name ?? null;

  let count = 0;
  for (const theme of anime.animethemes ?? []) {
    if (theme.type !== "OP") continue;
    const entry = (theme.animethemeentries ?? []).find(
      (e) => !e.nsfw && !e.spoiler && (e.videos ?? []).length > 0,
    );
    if (!entry) continue;
    const video = pickVideo(entry);
    if (!video?.link) continue;

    const id = `${slugify(anime.name)}-${theme.slug.toLowerCase()}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    openings.push({
      id,
      animeName: anime.name,
      aliases,
      year: anime.year,
      season: anime.season,
      studio,
      resolution: video.resolution,
      themeSlug: theme.slug,
      songTitle: theme.song?.title ?? null,
      videoUrl: video.link,
      audioUrl: video.audio?.link ?? null,
    });
    count++;
  }

  if (count > 0) animeMap.set(anime.name, { name: anime.name, aliases });
  return count;
}

async function main() {
  const all = process.argv.includes("--all");
  const openings: Opening[] = [];
  const animeMap = new Map<string, AnimeListItem>();
  const seenIds = new Set<string>();
  let missing = 0;

  if (all) {
    console.log("Modo --all: paginando TODA a API da AnimeThemes…");
    const animes = await fetchAllAnimes();
    console.log(`\nFiltrando ${animes.length} animes por OP utilizável…`);
    let withOp = 0;
    for (const anime of animes) {
      const c = extractOpenings(anime, null, openings, animeMap, seenIds);
      if (c > 0) withOp++;
    }
    console.log(
      `  → ${withOp} animes com OP, ${animes.length - withOp} descartados.`,
    );
    finishWrite(openings, animeMap, missing);
    return;
  }

  // Modo curado (padrão).
  const titlesFile = resolve(ROOT, "scripts/curated-titles.txt");
  const titles = readFileSync(titlesFile, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  console.log(`Buscando ${titles.length} títulos na AnimeThemes...\n`);

  for (const title of titles) {
    process.stdout.write(`• ${title} ... `);
    let anime: ApiAnime | null = null;
    try {
      anime = await fetchAnime(title);
    } catch (e) {
      console.log(`erro (${(e as Error).message})`);
      await sleep(300);
      continue;
    }
    if (!anime) {
      console.log("não encontrado");
      missing++;
      await sleep(250);
      continue;
    }

    const count = extractOpenings(anime, title, openings, animeMap, seenIds);
    if (count > 0) console.log(`${count} OP(s)`);
    else {
      console.log("sem OP utilizável");
      missing++;
    }
    await sleep(250); // educado com a API
  }

  finishWrite(openings, animeMap, missing);
}

function finishWrite(
  openings: Opening[],
  animeMap: Map<string, AnimeListItem>,
  missing: number,
) {
  const animeList = Array.from(animeMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  mkdirSync(resolve(ROOT, "data"), { recursive: true });
  writeFileSync(
    resolve(ROOT, "data/openings.json"),
    JSON.stringify(openings, null, 2),
  );
  writeFileSync(
    resolve(ROOT, "data/anime-list.json"),
    JSON.stringify(animeList, null, 2),
  );

  console.log(
    `\n✓ ${openings.length} aberturas de ${animeList.length} animes.` +
      ` ${missing} título(s) sem resultado.`,
  );
  console.log("  → data/openings.json");
  console.log("  → data/anime-list.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
