import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleAlert, Info } from "lucide-react";

import { PaymentForm, type PayablePlan } from "@/components/billing/payment-form";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { paymentNumber } from "@/lib/billing";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const t = getMessages("en");

export const metadata: Metadata = { title: t.billing.title };

type Overview = {
  plan_code: string;
  plan_name: string;
  monthly_price: number;
  order_limit: number | null;
  user_limit: number | null;
  status: string;
  state: "active" | "grace" | "expired" | "suspended";
  period_start: string | null;
  period_end: string | null;
  grace_days: number;
  orders_this_month: number;
};

type Submission = {
  id: string;
  plan_code: string;
  months: number;
  amount: number;
  method: string;
  transaction_id: string;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export default async function BillingPage() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();
  const initials = await getUserInitials();

  const [{ data: overviewData }, { data: planRows }, { data: submissionRows }] = await Promise.all([
    supabase.rpc("subscription_overview", { p_organization_id: membership.organizationId }),
    supabase
      .from("subscription_plans")
      .select("code, name, monthly_price")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("payment_submissions")
      .select("id, plan_code, months, amount, method, transaction_id, status, review_note, created_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const overview = overviewData as Overview | null;
  const plans = (planRows ?? []) as PayablePlan[];
  const submissions = (submissionRows ?? []) as Submission[];

  const copy = t.billing;
  const state = overview?.state ?? "active";
  const periodEnd = overview?.period_end ? new Date(overview.period_end) : null;
  const graceUntil = periodEnd ? addDays(periodEnd, overview?.grace_days ?? 3) : null;
  const daysLeft = periodEnd ? Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000) : null;

  const limit = overview?.order_limit ?? null;
  const used = overview?.orders_this_month ?? 0;
  const percent = limit && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const ordersLeft = limit === null ? null : Math.max(0, limit - used);

  const pending = submissions.find((submission) => submission.status === "pending");
  const lastRejected = submissions.find((submission) => submission.status === "rejected");

  return (
    <>
      <Topbar title={copy.title} subtitle={copy.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* ---- current plan ---- */}
          <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-brand-dark">{copy.current.title}</h2>
              <Badge
                variant={state === "active" ? "success" : state === "grace" ? "warning" : "danger"}
              >
                {copy.current.state[state]}
              </Badge>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-2xl font-bold text-brand-dark">
                {overview?.plan_name ?? "Free"}
              </span>
              {Number(overview?.monthly_price ?? 0) > 0 && (
                <span className="text-sm text-text-secondary">
                  {formatBDT(overview?.monthly_price ?? 0)}
                  {t.marketing.pricing.perMonth}
                </span>
              )}
            </div>

            <p className="text-sm text-text-secondary">
              {periodEnd
                ? `${copy.current.renews} ${dateFormatter.format(periodEnd)}`
                : copy.current.noExpiry}
            </p>

            {state === "grace" && periodEnd && graceUntil && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-tint px-4 py-3 text-sm text-warning">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.current.graceNotice
                  .replace("{date}", dateFormatter.format(periodEnd))
                  .replace("{until}", dateFormatter.format(graceUntil))}
              </p>
            )}

            {state === "expired" && periodEnd && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.current.expiredNotice.replace("{date}", dateFormatter.format(periodEnd))}
              </p>
            )}

            {state === "suspended" && (
              <p className="flex items-start gap-2 rounded-lg bg-danger-tint px-4 py-3 text-sm text-danger">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {copy.current.suspendedNotice}
              </p>
            )}

            {state === "active" && daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && (
              <p className="text-sm text-text-secondary">
                {copy.current.endingSoon.replace("{days}", String(daysLeft))}
              </p>
            )}
          </section>

          {/* ---- usage ---- */}
          <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="font-display text-base font-semibold text-brand-dark">{copy.usage.title}</h2>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-text-secondary">{copy.usage.orders}</span>
              <span className="font-display text-xl font-bold tabular-nums text-brand-dark">
                {formatCount(used)}
                {limit !== null && (
                  <span className="text-sm font-normal text-text-muted">
                    {" "}
                    {copy.usage.of.replace("{limit}", formatCount(limit))}
                  </span>
                )}
              </span>
            </div>

            {limit === null ? (
              <p className="text-sm text-text-secondary">{copy.usage.unlimited}</p>
            ) : (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      percent >= 100 ? "bg-danger" : percent >= 80 ? "bg-warning" : "bg-brand-lime",
                    )}
                    style={{ width: `${Math.max(2, percent)}%` }}
                  />
                </div>
                {ordersLeft === 0 ? (
                  <p className="text-sm text-danger">{copy.usage.full}</p>
                ) : ordersLeft !== null && ordersLeft <= 10 ? (
                  <p className="text-sm text-warning">
                    {copy.usage.nearlyFull.replace("{left}", formatCount(ordersLeft))}
                  </p>
                ) : null}
              </>
            )}
          </section>

          {pending && (
            <p className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-xs">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              {copy.submissions.pendingNotice}
            </p>
          )}

          {!pending && lastRejected?.review_note && (
            <p className="flex items-start gap-2 rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {copy.submissions.rejectedNotice.replace("{note}", lastRejected.review_note)}
            </p>
          )}

          <PaymentForm
            billing={copy}
            plans={plans}
            currentPlan={overview?.plan_code ?? "free"}
            paymentNumber={paymentNumber}
          />

          {/* ---- history ---- */}
          <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="font-display text-base font-semibold text-brand-dark">{copy.submissions.title}</h2>

            {submissions.length === 0 ? (
              <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-text-secondary">
                {copy.submissions.empty}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                      <th className="py-3 pr-4 font-medium">{copy.submissions.columns.date}</th>
                      <th className="py-3 pr-4 font-medium">{copy.submissions.columns.plan}</th>
                      <th className="py-3 pr-4 text-right font-medium">{copy.submissions.columns.amount}</th>
                      <th className="py-3 pr-4 font-medium">{copy.submissions.columns.trx}</th>
                      <th className="py-3 font-medium">{copy.submissions.columns.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="py-3 pr-4 text-text-secondary">
                          {dateFormatter.format(new Date(submission.created_at))}
                        </td>
                        <td className="py-3 pr-4 capitalize text-text-primary">
                          {submission.plan_code}
                          <span className="text-text-muted"> · {formatCount(submission.months)}m</span>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(submission.amount)}</td>
                        <td className="py-3 pr-4 tabular-nums text-text-secondary">{submission.transaction_id}</td>
                        <td className="py-3">
                          <Badge
                            variant={
                              submission.status === "approved"
                                ? "success"
                                : submission.status === "rejected"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {copy.submissions[submission.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
