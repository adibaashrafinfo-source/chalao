"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function StockFilters({ inventory }: { inventory: Messages["inventory"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const lowOnly = searchParams.get("low") === "1";

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (term === current) return;
    const timer = setTimeout(() => setParam("q", term.trim()), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label={inventory.levels.searchLabel}
          placeholder={inventory.levels.searchPlaceholder}
          className="rounded-full bg-surface pl-11"
        />
      </div>

      <button
        type="button"
        aria-pressed={lowOnly}
        onClick={() => setParam("low", lowOnly ? "" : "1")}
        className={cn(
          "rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
          lowOnly ? "bg-danger text-white" : "bg-surface text-text-secondary hover:text-brand-dark",
        )}
      >
        {inventory.levels.lowOnly}
      </button>
    </div>
  );
}
