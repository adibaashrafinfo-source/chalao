"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n";

// Debounced URL-driven search, so the list stays a Server Component.
export function CustomerSearch({ customers }: { customers: Messages["customers"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);

    return () => clearTimeout(timer);
  }, [value, searchParams, pathname, router]);

  return (
    <div className="relative max-w-sm">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={customers.searchLabel}
        placeholder={customers.searchPlaceholder}
        className="rounded-full pl-11 pr-10"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label={customers.actions.cancel}
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:bg-border-subtle hover:text-brand-dark"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
