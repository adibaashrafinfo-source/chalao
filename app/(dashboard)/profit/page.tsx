import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Topbar } from "@/components/dashboard/topbar";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { getProductProfit, getProfitSummary, periodRange, type PeriodKey } from "@/lib/profit/queries";
import { getMembership } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const t = getMessages("en");

export const metadata: Metadata = { title: t.profit.title };

const PERIODS: PeriodKey[] = ["this_month", "last_month", "last_30"];

/** One line of the sum, so the total is never a number without a reason. */
function Line({
  label,
  hint,
  amount,
  tone = "normal",
}: {
  label: string;
  hint?: string;
  amount: string;
  tone?: "normal" | "cost" | "total";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-2 py-3",
        tone === "total" && "border-t border-border-subtle pt-4",
      )}
    >
      <div className="flex flex-col">
        <span className={cn("text-sm", tone === "total" ? "font-display font-semibold text-brand-dark" : "text-text-primary")}>
          {label}
        </span>
        {hint ? <span className="text-xs text-text-muted">{hint}</span> : null}
      </div>
      <span
        className={cn(
          "tabular-nums",
          tone === "total" ? "font-display text-lg font-bold text-brand-dark" : "text-sm",
          tone === "cost" && "text-danger",
        )}
      >
        {amount}
      </span>
    </div>
  );
}

export default async function ProfitPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = (PERIODS.includes(periodParam as PeriodKey) ? periodParam : "this_month") as PeriodKey;

  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const { from, to } = periodRange(period);

  const [initials, summary, products] = await Promise.all([
    getUserInitials(),
    getProfitSummary(membership.organizationId, from, to),
    getProductProfit(membership.organizationId, from, to),
  ]);

  const positive = summary.netProfit >= 0;

  return (
    <>
      <Topbar title={t.profit.title} subtitle={t.profit.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((value) => (
            <Link
              key={value}
              href={`/profit?period=${value}`}
              aria-current={value === period ? "true" : undefined}
              className={cn(
                "rounded-full px-4 py-2 font-display text-xs font-semibold transition-colors",
                value === period
                  ? "bg-brand-dark text-white"
                  : "bg-surface text-text-secondary hover:text-brand-dark",
              )}
            >
              {t.profit.periods[value]}
            </Link>
          ))}
        </div>

        {summary.deliveredOrders === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <h2 className="font-display text-lg font-semibold text-brand-dark">{t.profit.empty.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.profit.empty.body}</p>
          </div>
        ) : (
          <>
            <div className={cn("flex flex-col gap-1.5 rounded-xl p-6 shadow-xs", positive ? "bg-brand-lime" : "bg-danger-tint")}>
              <p className={cn("text-xs", positive ? "text-brand-dark/70" : "text-danger/80")}>{t.profit.net}</p>
              <p className={cn("font-display text-4xl font-bold tabular-nums", positive ? "text-brand-dark" : "text-danger")}>
                {formatBDT(summary.netProfit)}
              </p>
              <p className={cn("text-xs", positive ? "text-brand-dark/60" : "text-danger/70")}>
                {t.profit.margin.replace("{margin}", String(summary.margin))}
              </p>
            </div>

            <section className="flex flex-col rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="pb-2 font-display text-base font-semibold text-brand-dark">
                {t.profit.breakdown.title}
              </h2>

              <Line
                label={t.profit.breakdown.revenue}
                hint={t.profit.breakdown.revenueHint.replace("{count}", formatCount(summary.deliveredOrders))}
                amount={formatBDT(summary.revenue)}
              />
              <Line
                label={t.profit.breakdown.cogs}
                amount={`− ${formatBDT(summary.cogs)}`}
                tone="cost"
              />
              <Line label={t.profit.breakdown.gross} amount={formatBDT(summary.grossProfit)} tone="total" />

              <Line
                label={t.profit.breakdown.courier}
                hint={t.profit.breakdown.courierHint}
                amount={`− ${formatBDT(summary.courierCharges)}`}
                tone="cost"
              />
              <Line
                label={t.profit.breakdown.returns}
                hint={t.profit.breakdown.returnsHint.replace("{count}", formatCount(summary.returnedOrders))}
                amount={`− ${formatBDT(summary.returnCharges)}`}
                tone="cost"
              />
              <Line
                label={t.profit.breakdown.codDifference}
                hint={
                  summary.codDifference === 0
                    ? t.profit.breakdown.codNone
                    : summary.codDifference < 0
                      ? t.profit.breakdown.codShort
                      : t.profit.breakdown.codOver
                }
                amount={formatBDT(summary.codDifference)}
                tone={summary.codDifference < 0 ? "cost" : "normal"}
              />

              <Line label={t.profit.breakdown.net} amount={formatBDT(summary.netProfit)} tone="total" />

              <p className="pt-4 text-xs leading-relaxed text-text-muted">{t.profit.note}</p>
            </section>

            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="font-display text-base font-semibold text-brand-dark">{t.profit.products.title}</h2>

              {products.length === 0 ? (
                <p className="text-sm text-text-secondary">{t.profit.products.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                        <th className="py-3 pr-4 font-medium">{t.profit.products.product}</th>
                        <th className="py-3 pr-4 text-right font-medium">{t.profit.products.quantity}</th>
                        <th className="py-3 pr-4 text-right font-medium">{t.profit.products.revenue}</th>
                        <th className="py-3 pr-4 text-right font-medium">{t.profit.products.cost}</th>
                        <th className="py-3 text-right font-medium">{t.profit.products.profit}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((row) => (
                        <tr
                          key={`${row.productName}-${row.variantName ?? ""}`}
                          className="border-b border-border-subtle last:border-b-0"
                        >
                          <td className="py-3 pr-4">
                            {row.productName}
                            {row.variantName ? (
                              <span className="text-text-muted"> · {row.variantName}</span>
                            ) : null}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatCount(row.quantity)}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(row.revenue)}</td>
                          <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">
                            {formatBDT(row.cost)}
                          </td>
                          <td
                            className={cn(
                              "py-3 text-right font-medium tabular-nums",
                              row.profit >= 0 ? "text-brand-dark" : "text-danger",
                            )}
                          >
                            {formatBDT(row.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
