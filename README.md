# Openingdle

> **Play:** [openingdle.vercel.app](https://openingdle.vercel.app)

Jogo diário no estilo *Wordle / onepiecedle*, focado em **aberturas de anime**.
Você ouve e vê um trecho curto de uma abertura e tenta adivinhar de qual anime
é. A cada erro, o trecho aumenta e uma nova dica é revelada (6 tentativas).

Áudio e vídeo vêm da base comunitária
[AnimeThemes.moe](https://animethemes.moe) (não hospedamos nada). As faixas
separadas do modo Fases (geradas pelo Demucs) ficam num GitHub Release deste
repositório. Projeto de fãs, sem fins lucrativos.

## Modos

- **Diário** (`/`): uma abertura por dia, igual para todos (seed determinístico
  pela data), no formato Padrão (vídeo + áudio). Guarda progresso, sequência
  (streak) e estatísticas no navegador.
- **Modo livre** (`/livre`): aberturas aleatórias ilimitadas, com 4 formatos de
  apresentação selecionáveis:
  - **Padrão** — vídeo + áudio.
  - **Apenas áudio** — só a música, sem imagem.
  - **Apenas imagem** — animação muda (sem som).
  - **Frame estático** — uma imagem parada por tentativa (revela um quadro novo
    a cada erro).
- **Fases** (`/fases`): a música separada em 4 faixas (baixo → bateria → melodia
  → vocal). Começa só com o baixo; cada erro libera a próxima faixa. Requer
  pré-processamento (ver [Modo Fases](#modo-fases-demucs)).

## Como rodar

```bash
npm install
npm run seed     # gera data/openings.json e data/anime-list.json (precisa de internet)
npm run dev      # http://localhost:3000
```

> O `npm run seed` busca os títulos de `scripts/curated-titles.txt` na API da
> AnimeThemes. Edite esse arquivo (um título por linha) para incluir/remover
> animes do jogo e rode o seed de novo.

Outros comandos: `npm run build` (produção), `npm start`, `npx tsx scripts/verify.ts`
(smoke test da lógica), `python scripts/check_urls.py` (valida saúde da API e das
URLs de vídeo/áudio do dataset).

> **Carregamento das mídias** (o CDN da AnimeThemes é gratuito e pode ser lento):
> - O trecho sempre toca **a partir do começo** do arquivo → *streaming linear*,
>   sem seek profundo (no `.webm` um seek força baixar o índice no fim do arquivo
>   + o trecho no meio, o que é lento).
> - `preload="auto"` + `preconnect` aos CDNs → o buffer começa no carregamento da
>   página e a conexão TLS é aberta antes do primeiro pedido.
> - O seed escolhe o encode mais leve aceitável (menor resolução **≥ 480p**).
> - Modo "apenas áudio" usa o `.ogg` (~3 MB) em vez do vídeo.
> - Retry automático com backoff em 503 transitório do CDN.
> - O jogo **não** chama a API em runtime — só o CDN de mídia.

## Arquitetura

```
scripts/seed.ts        # monta o dataset a partir da API da AnimeThemes
data/openings.json     # pool de aberturas (respostas possíveis)
data/anime-list.json   # nomes únicos p/ o autocomplete
lib/
  types.ts             # tipos compartilhados
  data.ts              # acesso tipado ao dataset (+ sorteio diário/aleatório)
  dailySeed.ts         # data -> índice/offset determinístico
  matching.ts          # normalização, acerto (tolerante a typo), autocomplete
  game.ts              # tentativas, janelas de tempo do trecho, dicas
  storage.ts           # progresso/streak/estatísticas no localStorage
  share.ts             # texto de compartilhamento (emoji)
components/
  GameBoard.tsx        # orquestra o jogo (usado pelos dois modos)
  OpeningPlayer.tsx    # <video> tocando só a janela de tempo da tentativa
  GuessInput.tsx       # input com autocomplete
  GuessList.tsx, HintBar.tsx, ResultModal.tsx
  StemsPlayer.tsx      # modo Fases: 4 faixas desbloqueáveis
app/
  page.tsx             # modo diário
  livre/page.tsx       # modo livre
  fases/page.tsx       # modo Fases
data/stems.json        # manifesto das faixas separadas (gerado)
scripts/separate_stems.py   # pipeline Demucs (faixas reais)
scripts/make_demo_stems.py  # faixas de demonstração (tons, sem deps)
scripts/check_urls.py       # valida API + URLs do dataset (links mortos/latência)
```

> O `GameBoard` aceita um `renderPlayer` opcional, então o modo Fases reaproveita
> toda a lógica de palpites/dicas/estatísticas trocando só o player.

**Dicas progressivas** (liberadas a cada erro): Ano → Temporada → nº de palavras
do título → inicial do nome → título da música. (Estúdio foi descartado porque a
AnimeThemes raramente preenche esse campo.)

## Modo Fases (Demucs)

As 4 faixas de cada abertura são geradas **offline** e ficam em
`public/stems/<id>/{bass,drums,other,vocals}.mp3` (listadas em
`data/stems.json`). A pasta `public/stems/` é ignorada pelo git (artefato pesado).

### Faixas de demonstração (rápido, sem dependências)

Só para testar a mecânica do modo Fases (gera tons sintéticos, não é separação
real):

```bash
python scripts/make_demo_stems.py --ids naruto-op1 bleach-op1
```

### Faixas reais (Demucs)

Pré-requisitos:

- **Python 3.9–3.13** — atenção: o PyTorch ainda **não** suporta o 3.14.
- `pip install demucs soundfile imageio-ffmpeg` (o `imageio-ffmpeg` embarca o
  binário ffmpeg, então não precisa instalá-lo no sistema). Para usar a GPU,
  instale a build CUDA do torch.

```bash
# venv isolado (recomendado p/ não conflitar com Python do sistema):
pip install uv
uv venv .venv-demucs --python 3.13
uv pip install --python .venv-demucs demucs soundfile imageio-ffmpeg

# rodar:
.venv-demucs/Scripts/python.exe scripts/separate_stems.py --ids naruto-op1
.venv-demucs/Scripts/python.exe scripts/separate_stems.py --count 5 --device cuda
```

O script baixa o `.ogg` da AnimeThemes, decodifica via libsndfile, separa com
o Demucs (`htdemucs`), grava WAV temporário e encoda em OGG/Vorbis via ffmpeg.
Idempotente (pula ids já feitos).

**Notas técnicas (Windows):** o pipeline evita `torchaudio.load` (precisa de
TorchCodec, problemático no Windows) e `soundfile.write` para OGG (estoura a
pilha do libsndfile). Em vez disso usa `julius` para resample (torch puro) e
`wave` da stdlib + ffmpeg para encodar.

## Ideias futuras (já previstas)

- Tornar o modo Fases também **diário** (hoje é livre, entre as aberturas com
  faixas geradas).
- Validação do palpite 100% no servidor (anti-trapaça) e contas de usuário.

## Créditos

Conteúdo de áudio/vídeo: [AnimeThemes.moe](https://animethemes.moe).
