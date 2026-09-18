"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, Search, UserRound } from "lucide-react";

import { findCustomersByPhoneAction, type CustomerMatch } from "@/app/(dashboard)/customers/actions";
import {
  assignConversationAction,
  linkCustomerAction,
  setConversationStatusAction,
} from "@/app/(dashboard)/inbox/actions";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";

type LinkedCustomer = {
  id: string;
  name: string;
  phone: string;
  district: string | null;
  orderCount: number;
  lifetime: number;
};

const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function ContextPanel({
  inbox,
  conversationId,
  status,
  channelLabel,
  contactName,
  startedAt,
  customer,
  assignedToName,
  assignedToMe,
}: {
  inbox: Messages["inbox"];
  conversationId: string;
  status: "open" | "pending" | "snoozed" | "closed";
  channelLabel: string;
  contactName: string;
  startedAt: string;
  customer: LinkedCustomer | null;
  assignedToName: string | null;
  assignedToMe: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) return;
    const query = term.trim();
    if (query.length < 3) {
      setMatches([]);
      setSearched(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const results = await findCustomersByPhoneAction(query);
      if (!active) return;
      setMatches(results);
      setSearching(false);
      setSearched(true);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, customer]);

  const run = (work: () => Promise<{ error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (result.error) setError(result.error);
      router.refresh();
    });
  };

  return (
    <aside className="flex min-h-0 w-full flex-col gap-4 overflow-y-auto rounded-xl bg-surface p-5 shadow-xs xl:w-72 xl:shrink-0">
      <section className="flex flex-col gap-1">
        <h3 className="font-display text-sm font-semibold text-brand-dark">{inbox.context.title}</h3>
        <p className="truncate text-sm text-text-secondary">{contactName}</p>
        <p className="text-xs text-text-muted">
          {inbox.context.channel}: {channelLabel || "—"}
        </p>
        <p className="text-xs text-text-muted">
          {inbox.context.firstSeen}: {dayFormatter.format(new Date(startedAt))}
        </p>
      </section>

      {error ? <p className="rounded-lg bg-danger-tint px-3 py-2 text-xs text-danger">{error}</p> : null}

      <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <h3 className="font-display text-sm font-semibold text-brand-dark">{inbox.context.customer}</h3>

        {customer ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-brand-dark">{customer.name}</p>
            <p className="text-xs text-text-secondary">{formatPhone(customer.phone)}</p>
            {customer.district ? <p className="text-xs text-text-muted">{customer.district}</p> : null}

            <dl className="flex gap-4 pt-1">
              <div className="flex flex-col">
                <dt className="text-[11px] text-text-muted">{inbox.context.orders}</dt>
                <dd className="font-display text-sm font-semibold text-brand-dark">{customer.orderCount}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] text-text-muted">{inbox.context.lifetime}</dt>
                <dd className="font-display text-sm font-semibold text-brand-dark">
                  {formatBDT(customer.lifetime)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="outline" size="sm">
                <Link href={`/customers/${customer.id}`}>{inbox.context.openCustomer}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => linkCustomerAction(conversationId, null))}
              >
                {inbox.context.unlink}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-text-secondary">{inbox.context.notLinked}</p>

            <label className="flex h-9 items-center gap-2 rounded-full bg-surface-alt px-3 text-sm">
              <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={inbox.context.searchCustomer}
                aria-label={inbox.context.searchCustomer}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-text-muted"
              />
              {searching ? <Loader2 className="size-3.5 animate-spin text-text-muted" aria-hidden="true" /> : null}
            </label>

            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => linkCustomerAction(conversationId, match.id))}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-alt"
              >
                <UserRound className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-brand-dark">{match.name}</span>
                <span className="shrink-0 text-text-muted">{formatPhone(match.phone)}</span>
              </button>
            ))}

            {searched && matches.length === 0 && !searching ? (
              <p className="text-xs text-text-muted">{inbox.context.noMatches}</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <h3 className="font-display text-sm font-semibold text-brand-dark">{inbox.context.assignedTo}</h3>
        <p className="text-xs text-text-secondary">{assignedToName || inbox.context.nobody}</p>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => assignConversationAction(conversationId, !assignedToMe))}
          className="self-start"
        >
          {assignedToMe ? inbox.context.unassign : inbox.context.assignToMe}
        </Button>
      </section>

      <section className="flex flex-col gap-2 border-t border-border-subtle pt-4">
        <h3 className="font-display text-sm font-semibold text-brand-dark">{inbox.context.status}</h3>
        <p className="text-xs text-text-secondary">{inbox.statuses[status]}</p>

        <div className="flex flex-wrap gap-2">
          {status !== "open" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setConversationStatusAction(conversationId, "open"))}
            >
              {inbox.context.markOpen}
            </Button>
          ) : null}

          {status !== "pending" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setConversationStatusAction(conversationId, "pending"))}
            >
              {inbox.context.markPending}
            </Button>
          ) : null}

          {status !== "closed" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setConversationStatusAction(conversationId, "closed"))}
            >
              {inbox.context.markClosed}
            </Button>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
