import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PackageX } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { getReturnsSummary, listReturns } from "@/lib/returns/queries";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.returns.title };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function ReturnsPage() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const [initials, summary, rows] = await Promise.all([
    getUserInitials(),
    getReturnsSummary(membership.organizationId),
    listReturns(membership.organizationId),
  ]);

  return (
    <>
      <Topbar title={t.returns.title} subtitle={t.returns.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-5 shadow-xs">
            <p className="text-xs text-text-secondary">{t.returns.stats.count}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
              {formatCount(summary.count)}
            </p>
            <p className="text-xs text-text-muted">
              {t.returns.stats.countHint.replace("{delivered}", formatCount(summary.delivered))}
            </p>
          </div>

          {/* The number that matters: money paid out for parcels that sold nothing. */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-danger-tint p-5 shadow-xs">
            <p className="text-xs text-danger/80">{t.returns.stats.charges}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-danger">
              {formatBDT(summary.charges)}
            </p>
            <p className="text-xs text-danger/70">{t.returns.stats.chargesHint}</p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-5 shadow-xs">
            <p className="text-xs text-text-secondary">{t.returns.stats.value}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
              {formatBDT(summary.orderValue)}
            </p>
            <p className="text-xs text-text-muted">
              {summary.unsellable > 0
                ? t.returns.stats.unsellable.replace("{count}", formatCount(summary.unsellable))
                : t.returns.stats.allSellable}
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="font-display text-base font-semibold text-brand-dark">{t.returns.list.title}</h2>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                <PackageX className="size-5" aria-hidden="true" />
              </span>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.returns.list.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                    <th className="py-3 pr-4 font-medium">{t.returns.list.order}</th>
                    <th className="py-3 pr-4 font-medium">{t.returns.list.customer}</th>
                    <th className="py-3 pr-4 font-medium">{t.returns.list.reason}</th>
                    <th className="py-3 pr-4 font-medium">{t.returns.list.stock}</th>
                    <th className="py-3 pr-4 text-right font-medium">{t.returns.list.value}</th>
                    <th className="py-3 pr-4 text-right font-medium">{t.returns.list.charge}</th>
                    <th className="py-3 font-medium">{t.returns.list.date}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/orders/${row.orderId}`}
                          className="font-medium tabular-nums text-brand-dark hover:underline"
                        >
                          #{row.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{row.customerName ?? "—"}</td>
                      <td className="py-3 pr-4 text-text-secondary">{t.returns.reasons[row.reason]}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={row.restocked ? "success" : "danger"}>
                          {row.restocked ? t.returns.list.restocked : t.returns.list.unsellable}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(row.total)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums text-danger">
                        {formatBDT(row.returnCharge)}
                      </td>
                      <td className="py-3 text-text-secondary">
                        {dateFormatter.format(new Date(row.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
