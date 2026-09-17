"use client";

import { CalendarClock, CreditCard, PauseCircle, PlayCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  changePlanAction,
  recordPaymentAction,
  setPeriodEndAction,
  setSuspendedAction,
} from "@/app/(dashboard)/admin/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type PlanOption = { code: string; name: string; monthly_price: number };

const methods = ["bkash", "nagad", "bank", "cash"] as const;

export function SubscriptionActions({
  admin,
  organizationId,
  planCode,
  suspended,
  periodEnd,
  plans,
}: {
  admin: Messages["admin"];
  organizationId: string;
  planCode: string;
  suspended: boolean;
  periodEnd: string | null;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const copy = admin.manage;

  const [selectedPlan, setSelectedPlan] = useState(planCode);
  const [planNote, setPlanNote] = useState("");
  const [date, setDate] = useState(periodEnd ?? "");
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  // Recording a payment moves the renewal date on the server; follow it here so the
  // field never shows a date that is no longer true.
  useEffect(() => {
    setDate(periodEnd ?? "");
  }, [periodEnd]);

  useEffect(() => {
    setSelectedPlan(planCode);
  }, [planCode]);

  const run = async (key: string, action: () => Promise<{ error?: string }>, okText: string) => {
    setPending(key);
    setMessage(null);
    const result = await action();
    setPending(null);

    if (result?.error) {
      setMessage({ tone: "error", text: result.error });
      return;
    }
    setMessage({ tone: "info", text: okText });
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-base font-semibold text-brand-dark">{copy.title}</h2>

      {/* ---- plan ---- */}
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-5">
        <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan">{copy.plan}</Label>
            <select
              id="plan"
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value)}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name}
                  {Number(plan.monthly_price) > 0 ? ` · ${formatBDT(plan.monthly_price)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-note">{copy.note}</Label>
            <Input
              id="plan-note"
              value={planNote}
              onChange={(event) => setPlanNote(event.target.value)}
              placeholder={copy.notePlaceholder}
            />
          </div>

          <Button
            disabled={pending !== null || selectedPlan === planCode}
            onClick={() =>
              run(
                "plan",
                () => changePlanAction({ organizationId, planCode: selectedPlan, note: planNote }),
                copy.planChanged,
              )
            }
          >
            {copy.changePlan}
          </Button>
        </div>
      </div>

      {/* ---- renewal date ---- */}
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-5">
        <div className="grid gap-3 sm:grid-cols-[200px_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-end">{copy.periodEnd}</Label>
            <Input
              id="period-end"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <Button
            variant="outline"
            disabled={pending !== null || !date}
            onClick={() =>
              run("date", () => setPeriodEndAction({ organizationId, periodEnd: date }), copy.dateSaved)
            }
          >
            <CalendarClock />
            {copy.setPeriodEnd}
          </Button>

          <Button
            variant="ghost"
            disabled={pending !== null}
            onClick={() =>
              run(
                "clear",
                async () => {
                  const result = await setPeriodEndAction({ organizationId, clear: true });
                  if (!result?.error) setDate("");
                  return result;
                },
                copy.dateSaved,
              )
            }
          >
            {copy.clearPeriod}
          </Button>
        </div>
      </div>

      {/* ---- payment and suspension ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <RecordPaymentDialog
          admin={admin}
          organizationId={organizationId}
          planCode={planCode}
          plans={plans}
          onDone={(text) => {
            setMessage({ tone: "info", text });
            router.refresh();
          }}
        />

        {suspended ? (
          <Button
            variant="outline"
            disabled={pending !== null}
            onClick={() => run("status", () => setSuspendedAction({ organizationId, suspend: false }), copy.activate)}
          >
            <PlayCircle />
            {copy.activate}
          </Button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="text-danger hover:bg-danger-tint">
                <PauseCircle />
                {copy.suspend}
              </Button>
            </DialogTrigger>
            <DialogContent title={copy.suspendTitle} description={copy.suspendBody}>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={pending !== null}
                  onClick={() =>
                    run("status", () => setSuspendedAction({ organizationId, suspend: true }), copy.suspend)
                  }
                >
                  {copy.suspend}
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost">{copy.cancel}</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {message && <FormNotice tone={message.tone}>{message.text}</FormNotice>}
    </section>
  );
}

function RecordPaymentDialog({
  admin,
  organizationId,
  planCode,
  plans,
  onDone,
}: {
  admin: Messages["admin"];
  organizationId: string;
  planCode: string;
  plans: PlanOption[];
  onDone: (text: string) => void;
}) {
  const copy = admin.manage;
  const firstPaidPlan = plans.find((entry) => Number(entry.monthly_price) > 0)?.code ?? planCode;
  const defaultPlan = planCode === "free" ? firstPaidPlan : planCode;

  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(defaultPlan);
  const [months, setMonths] = useState("1");
  const [method, setMethod] = useState<string>("bkash");
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedPlan = plans.find((entry) => entry.code === plan);
  // Suggested total, still editable — sellers sometimes pay a rounded amount.
  const suggested = (Number(selectedPlan?.monthly_price ?? 0) * (Number(months) || 0)).toString();
  const amountValue = amount === "" ? suggested : amount;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await recordPaymentAction({
      organizationId,
      planCode: plan,
      months: Number(months) || 1,
      amount: Number(amountValue) || 0,
      method,
      transactionId,
      note,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setTransactionId("");
    setNote("");
    setAmount("");
    onDone(copy.recorded);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Start from whatever plan the business is on right now, not from whatever was
        // selected the last time this dialog was opened.
        if (next) {
          setPlan(defaultPlan);
          setAmount("");
          setError(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CreditCard />
          {copy.recordPayment}
        </Button>
      </DialogTrigger>
      <DialogContent title={copy.recordPaymentTitle} description={copy.recordPaymentBody}>
        <form onSubmit={submit} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-plan">{copy.plan}</Label>
              <select
                id="pay-plan"
                value={plan}
                onChange={(event) => setPlan(event.target.value)}
                className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
              >
                {plans
                  .filter((entry) => Number(entry.monthly_price) > 0)
                  .map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.name} · {formatBDT(entry.monthly_price)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-months">{copy.months}</Label>
              <select
                id="pay-months"
                value={months}
                onChange={(event) => {
                  setMonths(event.target.value);
                  setAmount("");
                }}
                className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
              >
                {[1, 2, 3, 6, 12].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-amount">{copy.amount}</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                step="0.01"
                className="tabular-nums"
                value={amountValue}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pay-method">{copy.method}</Label>
              <select
                id="pay-method"
                value={method}
                onChange={(event) => setMethod(event.target.value)}
                className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
              >
                {methods.map((value) => (
                  <option key={value} value={value}>
                    {copy.methods[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pay-trx">{copy.transactionId}</Label>
              <Input
                id="pay-trx"
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
                placeholder={copy.transactionIdHint}
              />
            </div>

            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pay-note">{copy.note}</Label>
              <Input id="pay-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
          </div>

          {error && <FormNotice tone="error">{error}</FormNotice>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {copy.confirm}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {copy.cancel}
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
