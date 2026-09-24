import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Clock, PackageX, TriangleAlert, Truck, type LucideIcon } from "lucide-react";

import { LimitNotice } from "@/components/billing/limit-notice";
import { MorningBrief } from "@/components/dashboard/morning-brief";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Topbar } from "@/components/dashboard/topbar";
import { getAlerts, getDashboardData, getMorningBrief, type AlertItem, type Range } from "@/lib/dashboard/metrics";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { getOrderGate } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { cn } from "@/lib/utils";

const t = getMessages("en");

export const metadata: Metadata = { title: t.dashboard.nav.dashboard };

const ranges: { key: Range; label: string }[] = [
  { key: "today", label: t.dashboard.home.chart.today },
  { key: "7d", label: t.dashboard.home.chart.week },
  { key: "30d", label: t.dashboard.home.chart.month },
];

const alertIcons: Record<AlertItem["kind"], LucideIcon> = {
  out_of_stock: PackageX,
  low_stock: TriangleAlert,
  stuck_order: Clock,
  stale_shipment: Truck,
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: Range = rangeParam === "today" || rangeParam === "30d" ? rangeParam : "7d";

  const membership = await getMembership();
  const organizationId = membership?.organizationId ?? "";
  const initials = await getUserInitials();

  const supabase = await createClient();
  const [{ stats, chart }, alerts, brief, gate, { data: subscription }] = await Promise.all([
    getDashboardData(organizationId, range),
    getAlerts(organizationId),
    getMorningBrief(organizationId),
    getOrderGate(organizationId),
    supabase
      .from("organization_subscriptions")
      .select("current_period_end")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  const home = t.dashboard.home;

  return (
    <>
      <Topbar
        title={t.dashboard.nav.dashboard}
        subtitle={t.dashboard.pages.dashboardSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <LimitNotice
          limits={t.limits}
          gate={gate}
          periodEnd={(subscription?.current_period_end as string | null) ?? null}
        />

        {/* ---- what needs doing today, before any numbers ---- */}
        <MorningBrief copy={home.brief} brief={brief} />

        {/* ---- stat cards ---- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            hero
            label={home.stats.revenue}
            hint={home.stats.revenueHint}
            value={formatBDT(stats.revenueToday)}
            today={stats.revenueToday}
            yesterday={stats.revenueYesterday}
            stats={home.stats}
          />
          <StatCard
            label={home.stats.orders}
            hint={home.stats.ordersHint}
            value={formatCount(stats.ordersToday)}
            today={stats.ordersToday}
            yesterday={stats.ordersYesterday}
            stats={home.stats}
          />
          <StatCard
            label={home.stats.delivered}
            hint={home.stats.deliveredHint}
            value={formatCount(stats.deliveredToday)}
            today={stats.deliveredToday}
            yesterday={stats.deliveredYesterday}
            stats={home.stats}
          />
          <StatCard
            label={home.stats.pending}
            hint={home.stats.pendingHint}
            value={formatCount(stats.pending)}
            stats={home.stats}
          />
        </div>

        {/* ---- chart ---- */}
        <section className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-brand-dark">{home.chart.title}</h2>
            <div className="flex items-center gap-1 rounded-full bg-surface-alt p-1">
              {ranges.map((option) => (
                <Link
                  key={option.key}
                  href={`/dashboard?range=${option.key}`}
                  aria-current={range === option.key ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    range === option.key
                      ? "bg-brand-lime font-semibold text-brand-dark"
                      : "text-text-secondary hover:text-brand-dark",
                  )}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <RevenueChart chart={home.chart} data={chart} />

          <div className="flex items-center gap-4 border-t border-border-subtle pt-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-dark" /> {home.chart.revenue}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-lime" /> {home.chart.orders}
            </span>
          </div>
        </section>

        {/* ---- alerts ---- */}
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-brand-dark">{home.alerts.title}</h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-danger-tint px-2.5 py-0.5 text-xs font-semibold text-danger">
                {formatCount(alerts.length)}
              </span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-surface-alt px-6 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-lime text-brand-dark">
                <CircleCheck className="size-5" aria-hidden="true" />
              </span>
              <p className="font-display font-semibold text-brand-dark">{home.alerts.allClear}</p>
              <p className="max-w-sm text-sm text-text-secondary">{home.alerts.allClearBody}</p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {alerts.map((alert, index) => {
                const Icon = alertIcons[alert.kind];
                const isDanger = alert.kind === "out_of_stock" || alert.kind === "low_stock";

                const heading =
                  alert.kind === "out_of_stock"
                    ? home.alerts.outOfStock
                    : alert.kind === "low_stock"
                      ? home.alerts.lowStock
                      : alert.kind === "stuck_order"
                        ? home.alerts.stuckOrder
                        : home.alerts.staleShipment;

                const detail =
                  alert.kind === "low_stock"
                    ? home.alerts.lowStockDetail
                        .replace("{count}", formatCount(alert.count ?? 0))
                        .replace("{threshold}", formatCount(alert.threshold ?? 0))
                    : alert.kind === "stuck_order"
                      ? home.alerts.stuckOrderDetail.replace("{hours}", String(alert.hours ?? 0))
                      : alert.kind === "stale_shipment"
                        ? home.alerts.staleShipmentDetail.replace("{hours}", String(alert.hours ?? 0))
                        : "";

                return (
                  <li
                    key={`${alert.kind}-${alert.href}-${index}`}
                    className="flex items-center gap-3 border-b border-border-subtle py-3 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full",
                        isDanger ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning",
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium text-text-primary">{alert.title}</span>
                      <span className="truncate text-xs text-text-secondary">
                        {heading}
                        {detail && ` · ${detail}`}
                      </span>
                    </span>

                    <Link
                      href={alert.href}
                      className="shrink-0 rounded-full bg-surface-alt px-3 py-1.5 font-display text-xs font-semibold text-brand-dark hover:bg-border-subtle"
                    >
                      {home.alerts.view}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
