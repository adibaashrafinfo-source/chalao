"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/lib/i18n";
import { orderStatusLabel, type OrderStatus } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const statuses: OrderStatus[] = [
  "new",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "refunded",
];

export function OrderFilters({ orders }: { orders: Messages["orders"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  const selected = (searchParams.get("status") ?? "").split(",").filter(Boolean);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const hasFilters = selected.length > 0 || Boolean(from) || Boolean(to) || Boolean(searchParams.get("q"));

  const push = (params: URLSearchParams) => {
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    push(params);
  };

  // Debounced free-text search, so each keystroke doesn't hit the database.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (term === current) return;
    const timer = setTimeout(() => setParam("q", term.trim()), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const toggleStatus = (status: string) => {
    const next = selected.includes(status)
      ? selected.filter((value) => value !== status)
      : [...selected, status];
    setParam("status", next.join(","));
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-xs">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            aria-label={orders.filters.searchLabel}
            placeholder={orders.filters.search}
            className="rounded-full pl-11"
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="text-xs font-medium text-text-secondary">
              {orders.filters.from}
            </label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(event) => setParam("from", event.target.value)}
              className="w-[150px]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="text-xs font-medium text-text-secondary">
              {orders.filters.to}
            </label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(event) => setParam("to", event.target.value)}
              className="w-[150px]"
            />
          </div>
        </div>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setTerm("");
              push(new URLSearchParams());
            }}
          >
            <X />
            {orders.filters.clear}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {statuses.map((status) => {
          const active = selected.includes(status);
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-brand-dark text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-border-subtle hover:text-brand-dark",
              )}
            >
              {orderStatusLabel(status)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
