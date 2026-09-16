"use client";

import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { findCustomersByPhoneAction, type CustomerMatch } from "@/app/(dashboard)/customers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";

export type NewCustomerDraft = { name: string; phone: string; address: string; district: string };

// Brief §6.3: look the customer up by phone as you type; if there's no match,
// inline "create new customer" fields appear.
export function CustomerPicker({
  orders,
  selected,
  onSelect,
  draft,
  onDraftChange,
  errors,
}: {
  orders: Messages["orders"];
  selected: CustomerMatch | null;
  onSelect: (customer: CustomerMatch | null) => void;
  draft: NewCustomerDraft;
  onDraftChange: (draft: NewCustomerDraft) => void;
  errors?: { customer?: string };
}) {
  const [term, setTerm] = useState("");
  const [matches, setMatches] = useState<CustomerMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (selected) return;
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
  }, [term, selected]);

  if (selected) {
    return (
      <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="font-display text-base font-semibold text-brand-dark">{orders.customer.title}</h2>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-alt px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-lime text-brand-dark">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col">
              <span className="font-medium text-text-primary">{selected.name}</span>
              <span className="text-sm tabular-nums text-text-secondary">{formatPhone(selected.phone)}</span>
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null);
              setTerm("");
              setSearched(false);
            }}
          >
            {orders.customer.change}
          </Button>
        </div>
      </section>
    );
  }

  const showNewFields = searched && matches.length === 0;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-base font-semibold text-brand-dark">{orders.customer.title}</h2>

      <div className="flex flex-col gap-2">
        <Label htmlFor="customer-lookup">{orders.customer.lookupLabel}</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
          <Input
            id="customer-lookup"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              onDraftChange({ ...draft, phone: event.target.value });
            }}
            placeholder={orders.customer.lookupPlaceholder}
            className="h-11 pl-11"
            autoComplete="off"
          />
          {searching && (
            <Loader2
              className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-muted"
              aria-hidden="true"
            />
          )}
        </div>
        {errors?.customer && <p className="text-xs text-danger">{errors.customer}</p>}
      </div>

      {matches.length > 0 && (
        <ul className="flex flex-col gap-1">
          {matches.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                onClick={() => onSelect(match)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-surface-alt"
              >
                <span className="flex flex-col">
                  <span className="font-medium text-text-primary">{match.name}</span>
                  {match.district && <span className="text-xs text-text-muted">{match.district}</span>}
                </span>
                <span className="text-sm tabular-nums text-text-secondary">{formatPhone(match.phone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNewFields && (
        <div className="flex flex-col gap-4 rounded-lg bg-surface-alt p-4">
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <UserPlus className="size-4 shrink-0" aria-hidden="true" />
            {orders.customer.noMatch}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-customer-name">{orders.customer.name}</Label>
              <Input
                id="new-customer-name"
                className="bg-surface"
                value={draft.name}
                onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-customer-phone">{orders.customer.phone}</Label>
              <Input
                id="new-customer-phone"
                inputMode="tel"
                className="bg-surface tabular-nums"
                value={draft.phone}
                onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="new-customer-address">{orders.customer.address}</Label>
              <Input
                id="new-customer-address"
                className="bg-surface"
                value={draft.address}
                onChange={(event) => onDraftChange({ ...draft, address: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-customer-district">{orders.customer.district}</Label>
              <Input
                id="new-customer-district"
                className="bg-surface"
                value={draft.district}
                onChange={(event) => onDraftChange({ ...draft, district: event.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
