"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

import { deletePayoutAction } from "@/app/(dashboard)/cod/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Payout } from "@/lib/cod/types";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function PayoutCard({ copy, payout }: { copy: Messages["cod"]; payout: Payout }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Money is never "nearly" equal, but it is stored as a decimal, so compare
  // against half a poisha rather than zero.
  const balanced = Math.abs(payout.difference) < 0.005;

  const remove = async () => {
    setPending(true);
    setError(null);
    const result = await deletePayoutAction(payout.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <article className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-display text-base font-semibold text-brand-dark">
            {dateFormatter.format(new Date(payout.paidOn))}
            {payout.courierLabel ? ` · ${payout.courierLabel}` : ""}
          </p>
          <p className="text-xs text-text-muted">
            {payout.parcelCount} {copy.payouts.parcels.toLowerCase()}
            {payout.reference ? ` · ${copy.payouts.reference}: ${payout.reference}` : ""} ·{" "}
            {copy.methods[payout.method as keyof typeof copy.methods] ?? payout.method}
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
              <Trash2 />
            </Button>
          </DialogTrigger>
          <DialogContent title={copy.payouts.removeTitle} description={copy.payouts.removeBody}>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {copy.payouts.removeConfirm}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col">
          <dt className="text-xs text-text-secondary">{copy.payouts.expected}</dt>
          <dd className="font-display text-lg font-semibold tabular-nums text-brand-dark">
            {formatBDT(payout.expected)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-text-secondary">{copy.payouts.received}</dt>
          <dd className="font-display text-lg font-semibold tabular-nums text-brand-dark">
            {formatBDT(payout.amountReceived)}
          </dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-text-secondary">{copy.payouts.difference}</dt>
          <dd
            className={`font-display text-lg font-semibold tabular-nums ${
              balanced ? "text-success" : "text-danger"
            }`}
          >
            {formatBDT(payout.difference)}
          </dd>
        </div>
      </dl>

      {payout.note ? <p className="text-sm text-text-secondary">{payout.note}</p> : null}

      <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen((value) => !value)}>
        {open ? <ChevronUp /> : <ChevronDown />}
        {open ? copy.payouts.hide : copy.payouts.show}
      </Button>

      {open ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                <th className="py-2 pr-4 font-medium">{copy.unsettled.order}</th>
                <th className="py-2 pr-4 font-medium">{copy.unsettled.recipient}</th>
                <th className="py-2 pr-4 text-right font-medium">{copy.unsettled.cod}</th>
                <th className="py-2 pr-4 text-right font-medium">{copy.form.deliveryCharge}</th>
                <th className="py-2 pr-4 text-right font-medium">{copy.form.codFee}</th>
                <th className="py-2 text-right font-medium">{copy.payouts.expected}</th>
              </tr>
            </thead>
            <tbody>
              {payout.items.map((item) => (
                <tr key={item.id} className="border-b border-border-subtle last:border-b-0">
                  <td className="py-2 pr-4 tabular-nums">#{item.orderNumber ?? "—"}</td>
                  <td className="py-2 pr-4 text-text-secondary">{item.recipientName ?? "—"}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatBDT(item.codAmount)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-text-secondary">
                    {formatBDT(item.deliveryCharge)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-text-secondary">
                    {formatBDT(item.codFee)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatBDT(item.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
