import type { Metadata } from "next";
import { Geist, Geist_Mono, Pirata_One } from "next/font/google";
import Link from "next/link";
import { Compass } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Pirata_One({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Animedle — Adivinhe a abertura de anime",
  description:
    "Jogo diário: ouça e veja um trecho de uma abertura de anime e tente adivinhar de qual anime é.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://v.animethemes.moe" />
        <link rel="preconnect" href="https://a.animethemes.moe" />
        <link rel="dns-prefetch" href="https://v.animethemes.moe" />
        <link rel="dns-prefetch" href="https://a.animethemes.moe" />
      </head>
      <body className="min-h-full flex flex-col text-foreground">
        {/* Onda decorativa atrás do header */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-48 opacity-60"
        >
          <svg
            viewBox="0 0 1440 320"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <path
              fill="rgba(244, 197, 66, 0.06)"
              d="M0,224L60,213.3C120,203,240,181,360,176C480,171,600,181,720,202.7C840,224,960,256,1080,250.7C1200,245,1320,203,1380,181.3L1440,160L1440,0L0,0Z"
            />
            <path
              fill="rgba(30, 58, 95, 0.4)"
              d="M0,288L80,266.7C160,245,320,203,480,197.3C640,192,800,224,960,229.3C1120,235,1280,213,1360,202.7L1440,192L1440,320L0,320Z"
            />
          </svg>
        </div>

        <header className="sticky top-0 z-30 border-b border-gold/20 bg-ocean-deep/85 backdrop-blur-md">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link
              href="/"
              className="group flex items-center gap-2.5 text-lg tracking-tight"
            >
              <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-[var(--color-gold)]/60 bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] shadow-lg shadow-[var(--color-crimson)]/30">
                <Compass
                  className="h-5 w-5 text-[var(--color-gold)] compass-spin"
                  strokeWidth={2}
                />
              </span>
              <span className="font-display text-2xl text-[var(--color-gold)] drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
                Animedle
              </span>
            </Link>
            <div className="flex gap-1 text-sm">
              <NavLink href="/">Diário</NavLink>
              <NavLink href="/livre">Livre</NavLink>
              <NavLink href="/fases">Fases</NavLink>
            </div>
          </nav>
          <div className="rope-divider" />
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-gold/15 bg-ocean-deep/40 py-4 text-center text-xs text-[var(--color-sand-muted)]">
          Áudio e vídeo via{" "}
          <a
            href="https://animethemes.moe"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-gold)]/80 underline decoration-[var(--color-gold)]/40 underline-offset-2 hover:text-[var(--color-gold)]"
          >
            AnimeThemes.moe
          </a>
          . Projeto de fãs, sem fins lucrativos.
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-1.5 text-[var(--color-sand)]/75 transition hover:bg-[var(--color-gold)]/10 hover:text-[var(--color-gold)]"
    >
      {children}
    </Link>
  );
}
