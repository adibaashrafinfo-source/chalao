"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Loader2, Package, Search, ShoppingBag, User } from "lucide-react";

import { globalSearchAction, type SearchHit } from "@/app/(dashboard)/search/actions";
import type { Messages } from "@/lib/i18n";

const icons = { order: ShoppingBag, customer: User, product: Package };

/**
 * Search that actually searches. This was a decorative box with a keyboard hint
 * on it for a long time, which is the worst kind of detail: it tells a new user
 * on their first day which parts of the screen are real.
 */
export function DashboardSearch({ nav }: { nav: Messages["dashboard"]["nav"] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Ctrl/Cmd+K, the shortcut people already try. (Cmd+F is the browser's own.)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A click anywhere else puts the results away.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await globalSearchAction(query);
      if (!active) return;
      setHits(results);
      setSearching(false);
      setOpen(true);
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  const go = (href: string) => {
    setOpen(false);
    setTerm("");
    router.push(href);
  };

  return (
    <div ref={containerRef} className="relative flex-1 lg:w-64 lg:flex-none">
      <label className="flex h-10 items-center gap-2 rounded-full bg-surface-alt px-4 text-sm">
        <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={nav.searchPlaceholder}
          aria-label={nav.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
        />
        {searching ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-text-muted" aria-hidden="true" />
        ) : (
          <kbd className="hidden rounded-md bg-surface px-1.5 py-0.5 text-[11px] text-text-secondary sm:block">
            Ctrl K
          </kbd>
        )}
      </label>

      {open ? (
        <div className="absolute left-0 right-0 top-12 z-40 flex max-h-80 flex-col overflow-y-auto rounded-xl bg-surface p-2 shadow-lg lg:w-80">
          {hits.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-text-secondary">
              {searching ? nav.searching : nav.noResults}
            </p>
          ) : (
            hits.map((hit) => {
              const Icon = icons[hit.kind];
              return (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  type="button"
                  onClick={() => go(hit.href)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-alt"
                >
                  <Icon className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-brand-dark">{hit.title}</span>
                    {hit.subtitle ? (
                      <span className="truncate text-xs capitalize text-text-muted">{hit.subtitle}</span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
          <p className="px-3 pb-1 pt-2 text-[11px] text-text-muted">{nav.searchHint}</p>
        </div>
      ) : null}
    </div>
  );
}
