"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, UserCheck } from "lucide-react";

import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationListRow = {
  id: string;
  name: string;
  preview: string | null;
  status: "open" | "pending" | "snoozed" | "closed";
  unreadCount: number;
  lastMessageAt: string | null;
  channelLabel: string;
  isLinked: boolean;
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

/** Time for today, date for anything older — the way a messaging app reads. */
function stamp(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  return sameDay ? timeFormatter.format(date) : dateFormatter.format(date);
}

export function ConversationList({
  inbox,
  rows,
  selectedId,
  status,
  query,
  className,
}: {
  inbox: Messages["inbox"];
  rows: ConversationListRow[];
  selectedId: string | null;
  status: string | null;
  query: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(query);

  // Keep the box in step when the filter links change the URL.
  useEffect(() => setTerm(query), [query]);

  useEffect(() => {
    if (term.trim() === query.trim()) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (term.trim()) params.set("q", term.trim());
      else params.delete("q");
      // A search starts from the list again.
      params.delete("c");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);

    return () => clearTimeout(timer);
  }, [term, query, pathname, router, searchParams]);

  const filterHref = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    params.delete("c");
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  const conversationHref = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("c", id);
    return `${pathname}?${params.toString()}`;
  };

  const filters: { value: string | null; label: string }[] = [
    { value: null, label: inbox.filters.all },
    { value: "open", label: inbox.filters.open },
    { value: "pending", label: inbox.filters.pending },
    { value: "closed", label: inbox.filters.closed },
  ];

  return (
    <section
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden rounded-xl bg-surface shadow-xs lg:w-80 lg:shrink-0",
        className,
      )}
    >
      <div className="flex flex-col gap-3 border-b border-border-subtle p-4">
        <label className="flex h-10 items-center gap-2 rounded-full bg-surface-alt px-4 text-sm">
          <Search className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={inbox.search}
            aria-label={inbox.search}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {filters.map((filter) => {
            const active = (filter.value ?? null) === (status ?? null);
            return (
              <Link
                key={filter.label}
                href={filterHref(filter.value)}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-display font-semibold transition-colors",
                  active
                    ? "bg-brand-dark text-white"
                    : "bg-surface-alt text-text-secondary hover:text-brand-dark",
                )}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-secondary">{inbox.list.noMessages}</p>
        ) : (
          <ul className="flex flex-col">
            {rows.map((row) => {
              const active = row.id === selectedId;
              return (
                <li key={row.id}>
                  <Link
                    href={conversationHref(row.id)}
                    scroll={false}
                    className={cn(
                      "flex flex-col gap-1 border-b border-border-subtle px-4 py-3 transition-colors",
                      active ? "bg-surface-alt" : "hover:bg-surface-alt",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          row.unreadCount > 0
                            ? "font-display font-semibold text-brand-dark"
                            : "text-brand-dark",
                        )}
                      >
                        {row.name}
                      </span>
                      {row.isLinked ? (
                        <UserCheck className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                      ) : null}
                      <span className="shrink-0 text-[11px] text-text-muted">{stamp(row.lastMessageAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs",
                          row.unreadCount > 0 ? "text-brand-dark" : "text-text-secondary",
                        )}
                      >
                        {row.preview ?? inbox.list.noMessages}
                      </span>
                      {row.unreadCount > 0 ? (
                        <span
                          className="flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-lime px-1.5 text-[11px] font-display font-semibold text-brand-dark"
                          aria-label={`${row.unreadCount} ${inbox.list.unreadLabel}`}
                        >
                          {row.unreadCount}
                        </span>
                      ) : null}
                    </div>

                    {row.channelLabel ? (
                      <span className="text-[11px] text-text-muted">{row.channelLabel}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
