"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { saveConfirmationRulesAction } from "@/app/(dashboard)/settings/orders/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import type { ConfirmationRules } from "@/lib/orders/confirmation-types";

export function ConfirmationRulesForm({
  copy,
  defaults,
  canEdit,
}: {
  copy: Messages["confirmation"];
  defaults: ConfirmationRules;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [autoConfirm, setAutoConfirm] = useState(defaults.autoConfirmEnabled);
  const [maxTotal, setMaxTotal] = useState(
    defaults.autoConfirmMaxTotal === null ? "" : String(defaults.autoConfirmMaxTotal),
  );
  const [newCustomers, setNewCustomers] = useState(defaults.autoConfirmNewCustomers);
  const [advanceAbove, setAdvanceAbove] = useState(
    defaults.advancePaymentAbove === null ? "" : String(defaults.advancePaymentAbove),
  );
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setNotice(null);

    const result = await saveConfirmationRulesAction({
      autoConfirmEnabled: autoConfirm,
      autoConfirmMaxTotal: maxTotal,
      autoConfirmNewCustomers: newCustomers,
      advancePaymentAbove: advanceAbove,
    });

    setPending(false);
    if (result?.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    setNotice({ tone: "info", text: copy.saved });
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.heading}</h2>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={autoConfirm}
            disabled={!canEdit}
            onChange={(event) => setAutoConfirm(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-brand-dark"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-text-primary">{copy.autoConfirm}</span>
            <span className="text-xs text-text-muted">{copy.autoConfirmHelp}</span>
          </span>
        </label>

        <div className="flex flex-col gap-2">
          <Label htmlFor="max-total">{copy.maxTotal}</Label>
          <Input
            id="max-total"
            type="number"
            min={0}
            inputMode="decimal"
            value={maxTotal}
            disabled={!canEdit || !autoConfirm}
            onChange={(event) => setMaxTotal(event.target.value)}
          />
          <p className="text-xs text-text-muted">{copy.maxTotalHelp}</p>
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={newCustomers}
            disabled={!canEdit || !autoConfirm}
            onChange={(event) => setNewCustomers(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-brand-dark"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm text-text-primary">{copy.newCustomers}</span>
            <span className="text-xs text-text-muted">{copy.newCustomersHelp}</span>
          </span>
        </label>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.advanceHeading}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="advance-above">{copy.advanceAbove}</Label>
          <Input
            id="advance-above"
            type="number"
            min={0}
            inputMode="decimal"
            value={advanceAbove}
            disabled={!canEdit}
            onChange={(event) => setAdvanceAbove(event.target.value)}
          />
          <p className="text-xs text-text-muted">{copy.advanceAboveHelp}</p>
        </div>
      </section>

      {notice ? <FormNotice tone={notice.tone}>{notice.text}</FormNotice> : null}
      {!canEdit ? <FormNotice>{copy.ownerOnly}</FormNotice> : null}

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? copy.saving : copy.save}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
