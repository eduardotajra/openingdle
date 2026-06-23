// Tipos compartilhados entre o script de seed e o app.

export interface Opening {
  /** id único, ex: "bleach-op1" */
  id: string;
  /** Nome canônico do anime (a resposta) */
  animeName: string;
  /** Nomes alternativos aceitos no palpite */
  aliases: string[];
  /** Ano de lançamento */
  year: number | null;
  /** Temporada (Winter/Spring/Summer/Fall) */
  season: string | null;
  /** Estúdio principal */
  studio: string | null;
  /** Resolução vertical do encode escolhido (diagnóstico) */
  resolution?: number | null;
  /** Slug do tema, ex: "OP1" */
  themeSlug: string;
  /** Título da música da abertura */
  songTitle: string | null;
  /** URL do vídeo (.webm) no CDN da AnimeThemes */
  videoUrl: string;
  /** URL do áudio (.ogg) no CDN da AnimeThemes */
  audioUrl: string | null;
}

/** Entrada do autocomplete: um anime único e seus apelidos. */
export interface AnimeListItem {
  name: string;
  aliases: string[];
}

/** As 4 faixas separadas de uma abertura (caminhos públicos). */
export interface StemSet {
  bass: string;
  drums: string;
  other: string;
  vocals: string;
}

/** Entrada do manifesto de faixas (data/stems.json), casada por `id`. */
export interface StemsEntry {
  id: string;
  /** true se forem faixas de demonstração (placeholder), não Demucs real */
  demo?: boolean;
  stems: StemSet;
}
