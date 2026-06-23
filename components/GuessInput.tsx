"use client";

import { useMemo, useRef, useState } from "react";
import { SkipForward } from "lucide-react";
import type { AnimeListItem } from "@/lib/types";
import { searchAnime } from "@/lib/matching";

interface Props {
  animeList: AnimeListItem[];
  disabled?: boolean;
  onGuess: (name: string) => void;
  onSkip?: () => void;
}

export default function GuessInput({ animeList, disabled, onGuess, onSkip }: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => searchAnime(text, animeList, 8),
    [text, animeList],
  );

  function submit(name: string) {
    if (!name.trim() || disabled) return;
    onGuess(name);
    setText("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Enter" && text.trim()) submit(text);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(suggestions[active]?.name ?? text);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            disabled={disabled}
            placeholder="Digite o nome do anime…"
            autoComplete="off"
            onChange={(e) => {
              setText(e.target.value);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-ocean)]/40 px-4 py-3 text-[var(--color-sand)] placeholder:text-[var(--color-sand-muted)]/60 focus:border-[var(--color-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--color-gold)]/20 disabled:opacity-50"
          />
          {open && suggestions.length > 0 && (
            <ul className="absolute bottom-full z-10 mb-1 max-h-64 w-full overflow-auto rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-ocean-deep)]/95 shadow-2xl backdrop-blur">
              {suggestions.map((s, i) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      submit(s.name);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={`block w-full px-4 py-2 text-left text-sm transition ${
                      i === active
                        ? "bg-[var(--color-gold)]/15 text-[var(--color-gold)]"
                        : "text-[var(--color-sand)]/80 hover:bg-[var(--color-ocean)]/40"
                    }`}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          onClick={() => submit(text)}
          disabled={disabled || !text.trim()}
          className="rounded-lg bg-gradient-to-br from-[var(--color-crimson)] to-[var(--color-crimson-soft)] px-5 font-semibold text-[var(--color-sand)] shadow-lg shadow-[var(--color-crimson)]/25 ring-1 ring-[var(--color-gold)]/30 transition hover:from-[var(--color-crimson-soft)] hover:to-[var(--color-crimson)] disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-800 disabled:opacity-50 disabled:shadow-none disabled:ring-0"
        >
          Palpitar
        </button>
      </div>
      {onSkip && (
        <button
          onClick={onSkip}
          disabled={disabled}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--color-sand)]/55 transition hover:text-[var(--color-gold)] disabled:opacity-40"
        >
          <SkipForward className="h-3.5 w-3.5" />
          <span>Pular tentativa</span>
        </button>
      )}
    </div>
  );
}
