"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PackageX } from "lucide-react";

import { recordReturnAction } from "@/app/(dashboard)/returns/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { returnReasons } from "@/lib/returns/types";

/**
 * Shown on an order that has come back, or is about to. Recording the return is
 * the only place the cost of it gets written down — the state machine moves the
 * stock, but it has never known what the courier charged.
 */
export function RecordReturn({
  copy,
  orderId,
  alreadyRecorded,
}: {
  copy: Messages["returns"];
  orderId: string;
  alreadyRecorded: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("refused");
  const [charge, setCharge] = useState("0");
  const [restocked, setRestocked] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (alreadyRecorded) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await recordReturnAction({
      orderId,
      reason,
      returnCharge: Number(charge) || 0,
      restocked,
      note: note.trim() || null,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-warning-tint p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-brand-dark">
          <PackageX className="size-4" aria-hidden="true" />
          {copy.form.pendingTitle}
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">{copy.form.pendingBody}</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="dark" size="sm" className="self-start">
            {copy.form.openLabel}
          </Button>
        </DialogTrigger>
        <DialogContent title={copy.form.title} description={copy.form.description}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-reason">{copy.form.reason}</Label>
              <select
                id="return-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
              >
                {returnReasons.map((value) => (
                  <option key={value} value={value}>
                    {copy.reasons[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-charge">{copy.form.charge}</Label>
              <Input
                id="return-charge"
                type="number"
                min={0}
                inputMode="decimal"
                value={charge}
                onChange={(event) => setCharge(event.target.value)}
              />
              <p className="text-xs text-text-muted">{copy.form.chargeHint}</p>
            </div>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={restocked}
                onChange={(event) => setRestocked(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-brand-dark"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-text-primary">{copy.form.restocked}</span>
                <span className="text-xs text-text-muted">{copy.form.restockedHint}</span>
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-note">{copy.form.note}</Label>
              <Input id="return-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>

            {error ? <FormNotice tone="error">{error}</FormNotice> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? copy.form.saving : copy.form.submit}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
