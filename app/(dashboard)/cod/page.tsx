import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote } from "lucide-react";

import { PayoutCard } from "@/components/cod/payout-card";
import { RecordPayout } from "@/components/cod/record-payout";
import { Topbar } from "@/components/dashboard/topbar";
import { getCodSummary, listPayouts, listUnsettledShipments } from "@/lib/cod/queries";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.cod.title };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function CodPage() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  const organizationId = membership.organizationId;

  const supabase = await createClient();

  const [initials, summary, unsettled, payouts, { data: courierRows }] = await Promise.all([
    getUserInitials(),
    getCodSummary(organizationId),
    listUnsettledShipments(organizationId),
    listPayouts(organizationId),
    supabase
      .from("courier_accounts")
      .select("id, label, provider")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
  ]);

  const couriers = (courierRows ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    provider: row.provider as string,
  }));

  const balanced = Math.abs(summary.difference) < 0.005;

  return (
    <>
      <Topbar title={t.cod.title} subtitle={t.cod.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5 rounded-xl bg-brand-lime p-5 shadow-xs">
            <p className="text-xs text-brand-dark/70">{t.cod.stats.outstanding}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
              {formatBDT(summary.outstandingAmount)}
            </p>
            <p className="text-xs text-brand-dark/60">
              {t.cod.stats.outstandingHint.replace("{count}", formatCount(summary.outstandingCount))}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-5 shadow-xs">
            <p className="text-xs text-text-secondary">{t.cod.stats.received}</p>
            <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
              {formatBDT(summary.receivedTotal)}
            </p>
            <p className="text-xs text-text-muted">
              {t.cod.stats.receivedHint.replace("{count}", formatCount(payouts.length))}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl bg-surface p-5 shadow-xs">
            <p className="text-xs text-text-secondary">{t.cod.stats.difference}</p>
            <p
              className={`font-display text-2xl font-bold tabular-nums ${
                balanced ? "text-brand-dark" : "text-danger"
              }`}
            >
              {formatBDT(summary.difference)}
            </p>
            <p className="text-xs text-text-muted">
              {balanced
                ? t.cod.stats.settled
                : `${formatBDT(Math.abs(summary.difference))} ${
                    summary.difference < 0 ? t.cod.stats.short : t.cod.stats.over
                  }`}
            </p>
          </div>
        </div>

        {/* ---- what the courier still owes ---- */}
        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-brand-dark">{t.cod.unsettled.title}</h2>
            <RecordPayout canManage={can(membership.role, "manage_cod")} copy={t.cod} shipments={unsettled} couriers={couriers} />
          </div>

          {unsettled.length === 0 ? (
            <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-text-secondary">
              {t.cod.unsettled.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
                    <th className="py-3 pr-4 font-medium">{t.cod.unsettled.order}</th>
                    <th className="py-3 pr-4 font-medium">{t.cod.unsettled.recipient}</th>
                    <th className="py-3 pr-4 font-medium">{t.cod.unsettled.district}</th>
                    <th className="py-3 pr-4 font-medium">{t.cod.unsettled.delivered}</th>
                    <th className="py-3 text-right font-medium">{t.cod.unsettled.cod}</th>
                  </tr>
                </thead>
                <tbody>
                  {unsettled.map((shipment) => (
                    <tr key={shipment.shipmentId} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/orders/${shipment.orderId}`}
                          className="font-medium tabular-nums text-brand-dark hover:underline"
                        >
                          #{shipment.orderNumber}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{shipment.recipientName}</td>
                      <td className="py-3 pr-4 text-text-secondary">{shipment.district ?? "—"}</td>
                      <td className="py-3 pr-4 text-text-secondary">
                        {shipment.deliveredAt ? dateFormatter.format(new Date(shipment.deliveredAt)) : "—"}
                      </td>
                      <td className="py-3 text-right tabular-nums">{formatBDT(shipment.codAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-subtle">
                    <td className="py-3 pr-4 font-display font-semibold" colSpan={4}>
                      {t.cod.unsettled.total}
                    </td>
                    <td className="py-3 text-right font-display font-semibold tabular-nums">
                      {formatBDT(summary.outstandingAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ---- what has actually arrived ---- */}
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-base font-semibold text-brand-dark">{t.cod.payouts.title}</h2>

          {payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-16 text-center shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                <Banknote className="size-5" aria-hidden="true" />
              </span>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.cod.payouts.empty}</p>
            </div>
          ) : (
            payouts.map((payout) => <PayoutCard key={payout.id} canManage={can(membership.role, "manage_cod")} copy={t.cod} payout={payout} />)
          )}
        </section>
      </main>
    </>
  );
}
