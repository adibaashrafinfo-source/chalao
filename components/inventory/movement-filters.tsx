"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const movementTypes = ["purchase", "order_out", "order_return", "manual_adjustment", "damage"] as const;

export function MovementFilters({ inventory }: { inventory: Messages["inventory"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const selected = (searchParams.get("type") ?? "").split(",").filter(Boolean);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasFilters = selected.length > 0 || Boolean(from) || Boolean(to);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  const toggleType = (type: string) => {
    const next = selected.includes(type) ? selected.filter((value) => value !== type) : [...selected, type];
    setParam("type", next.join(","));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-xs">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="from" className="text-xs font-medium text-text-secondary">
            {inventory.movements.columns.date}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(event) => setParam("from", event.target.value)}
              className="w-[150px]"
            />
            <span className="text-text-muted">–</span>
            <Input
              type="date"
              value={to}
              onChange={(event) => setParam("to", event.target.value)}
              className="w-[150px]"
              aria-label={inventory.movements.columns.date}
            />
          </div>
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("tab", "movements");
              startTransition(() => router.replace(`${pathname}?${params.toString()}`));
            }}
          >
            <X />
            {inventory.movements.allTypes}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {movementTypes.map((type) => {
          const active = selected.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(type)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand-dark text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-border-subtle hover:text-brand-dark",
              )}
            >
              {inventory.types[type]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
