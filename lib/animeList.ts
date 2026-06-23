// Lista de nomes para o autocomplete (arquivo pequeno, ~19KB).
// Mantido separado de data.ts para a página diária não carregar o pool inteiro
// de aberturas (openings.json) no bundle do cliente.
import animeListJson from "@/data/anime-list.json";
import type { AnimeListItem } from "./types";

export const ANIME_LIST = animeListJson as AnimeListItem[];
