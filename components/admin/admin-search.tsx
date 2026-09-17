"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n";

export function AdminSearch({ admin }: { admin: Messages["admin"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (term === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);

    return () => clearTimeout(timer);
  }, [term, searchParams, pathname, router]);

  return (
    // No flex-1 here: inside a column layout it would stretch the box to full height.
    <div className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-label={admin.searchLabel}
        placeholder={admin.search}
        className="rounded-full bg-surface pl-11"
      />
    </div>
  );
}
