"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { submitPaymentAction } from "@/app/(dashboard)/settings/billing/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { monthOptions, paymentMethods, type PaymentMethod } from "@/lib/billing";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type PayablePlan = { code: string; name: string; monthly_price: number };

export function PaymentForm({
  billing,
  plans,
  currentPlan,
  paymentNumber,
}: {
  billing: Messages["billing"];
  plans: PayablePlan[];
  currentPlan: string;
  paymentNumber: string;
}) {
  const router = useRouter();
  const copy = billing.pay;

  const suggestedPlan =
    plans.find((plan) => plan.code === currentPlan) ?? plans.find((plan) => plan.monthly_price > 0) ?? plans[0];

  const [planCode, setPlanCode] = useState(suggestedPlan?.code ?? "");
  const [months, setMonths] = useState("1");
  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const plan = plans.find((entry) => entry.code === planCode);
  const amount = Number(plan?.monthly_price ?? 0) * (Number(months) || 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await submitPaymentAction({
      planCode,
      months: Number(months) || 1,
      amount,
      method,
      senderNumber,
      transactionId,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setDone(true);
    setTransactionId("");
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-base font-semibold text-brand-dark">{copy.title}</h2>

      {/* ---- how to pay ---- */}
      <div className="flex flex-col gap-4 rounded-lg bg-surface-alt p-4 sm:p-5">
        <p className="font-display text-sm font-semibold text-brand-dark">{copy.howTo}</p>

        <ol className="flex flex-col gap-2 text-sm text-text-secondary">
          <li>1. {copy.step1}</li>
          <li>2. {copy.step2.replace("{number}", paymentNumber)}</li>
          <li>3. {copy.step3}</li>
          <li>4. {copy.step4}</li>
        </ol>

        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-4 py-3">
          <span className="text-sm text-text-secondary">{copy.number}</span>
          <span className="font-display text-lg font-bold tabular-nums text-brand-dark">{paymentNumber}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={async () => {
              await navigator.clipboard.writeText(paymentNumber.replace(/\D/g, ""));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? copy.copied : copy.copy}
          </Button>
        </div>
      </div>

      {/* ---- the claim ---- */}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-plan">{copy.plan}</Label>
            <select
              id="pay-plan"
              value={planCode}
              onChange={(event) => setPlanCode(event.target.value)}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {plans
                .filter((entry) => entry.monthly_price > 0)
                .map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.name} · {formatBDT(entry.monthly_price)}
                  </option>
                ))}
            </select>
            {planCode === currentPlan && <p className="text-xs text-text-muted">{copy.currentPlanNote}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-months">{copy.months}</Label>
            <select
              id="pay-months"
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {monthOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* The amount is worked out for them, so there is nothing to get wrong. */}
        <div className="flex items-center justify-between rounded-lg bg-brand-lime px-4 py-3">
          <span className="text-sm text-brand-dark/70">{copy.amount}</span>
          <span className="font-display text-xl font-bold tabular-nums text-brand-dark">{formatBDT(amount)}</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-method">{copy.method}</Label>
            <select
              id="pay-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {paymentMethods.map((value) => (
                <option key={value} value={value}>
                  {copy.methods[value]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-sender">{copy.senderNumber}</Label>
            <Input
              id="pay-sender"
              inputMode="tel"
              className="tabular-nums"
              placeholder={copy.senderHint}
              value={senderNumber}
              onChange={(event) => setSenderNumber(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pay-trx">{copy.transactionId}</Label>
            <Input
              id="pay-trx"
              placeholder={copy.transactionHint}
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
            />
          </div>
        </div>

        {error && <FormNotice tone="error">{error}</FormNotice>}
        {done && <FormNotice>{copy.sent}</FormNotice>}

        <div>
          <Button type="submit" disabled={pending || amount <= 0}>
            {pending ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}
