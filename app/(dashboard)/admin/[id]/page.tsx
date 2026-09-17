import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

import { AdminTabs, StateBadgeTone } from "@/components/admin/admin-shell";
import { SubscriptionActions, type PlanOption } from "@/components/admin/subscription-actions";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import {
  getOrganizationDetail,
  listOrganizationEvents,
  listOrganizationPayments,
} from "@/lib/admin/queries";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";
import { createClient } from "@/lib/supabase/server";

const t = getMessages("en");

export const metadata: Metadata = { title: t.admin.title };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initials = await getUserInitials();

  if (!(await isPlatformAdmin())) notFound();

  const organization = await getOrganizationDetail(id);
  if (!organization) notFound();

  const supabase = await createClient();
  const [payments, events, { data: planRows }] = await Promise.all([
    listOrganizationPayments(id),
    listOrganizationEvents(id),
    supabase
      .from("subscription_plans")
      .select("code, name, monthly_price")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const plans = (planRows ?? []) as PlanOption[];

  const states = t.admin.states as Record<string, string>;
  const usage = [
    {
      label: t.admin.detail.orders,
      value: formatCount(organization.orders_this_month),
      hint:
        organization.order_limit === null
          ? t.admin.detail.noLimit
          : t.admin.detail.ofLimit.replace("{limit}", formatCount(organization.order_limit)),
    },
    { label: t.admin.detail.products, value: formatCount(organization.product_count) },
    { label: t.admin.detail.customers, value: formatCount(organization.customer_count) },
    { label: t.admin.detail.couriers, value: formatCount(organization.courier_count) },
  ];

  return (
    <>
      <Topbar
        title={organization.name}
        subtitle={t.admin.detail.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <AdminTabs admin={t.admin} active="organizations" />

        <Link
          href="/admin"
          className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t.admin.detail.back}
        </Link>

        {/* ---- subscription ---- */}
        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-brand-dark">{t.admin.detail.subscription}</h2>
            <Badge variant={StateBadgeTone(organization.state)}>
              {states[organization.state] ?? organization.state}
            </Badge>
          </div>

          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div className="flex flex-col">
              <dt className="text-text-secondary">{t.admin.columns.plan}</dt>
              <dd className="font-medium text-text-primary">
                {organization.plan_name}
                {Number(organization.monthly_price) > 0 && (
                  <span className="font-normal text-text-muted"> · {formatBDT(organization.monthly_price)}</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-text-secondary">{t.admin.columns.periodEnd}</dt>
              <dd className="text-text-primary">
                {organization.period_end
                  ? dateFormatter.format(new Date(organization.period_end))
                  : t.admin.noExpiry}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-text-secondary">{t.admin.columns.owner}</dt>
              <dd className="truncate text-text-primary">{organization.owner_email ?? "—"}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-text-secondary">{t.admin.columns.joined}</dt>
              <dd className="text-text-primary">{dateFormatter.format(new Date(organization.created_at))}</dd>
            </div>
          </dl>

          {organization.members.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
              <span className="text-sm text-text-secondary">{t.admin.detail.members}:</span>
              {organization.members.map((member) => (
                <span
                  key={member.email}
                  className="rounded-full bg-surface-alt px-3 py-1 text-xs text-text-primary"
                >
                  {member.email} · <span className="capitalize text-text-muted">{member.role}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        <SubscriptionActions
          admin={t.admin}
          organizationId={organization.organization_id}
          planCode={organization.plan_code}
          suspended={organization.status === "suspended"}
          periodEnd={organization.period_end}
          plans={plans}
        />

        {/* ---- usage ---- */}
        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="font-display text-base font-semibold text-brand-dark">{t.admin.detail.usage}</h2>

          <div className="grid gap-4 sm:grid-cols-4">
            {usage.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 rounded-lg bg-surface-alt p-4">
                <p className="text-xs text-text-secondary">{item.label}</p>
                <p className="font-display text-xl font-bold tabular-nums text-brand-dark">{item.value}</p>
                {item.hint && <p className="text-xs text-text-muted">{item.hint}</p>}
              </div>
            ))}
          </div>

          <p className="text-xs text-text-secondary">
            {t.admin.detail.lastOrder}:{" "}
            {organization.last_order_at
              ? dateTimeFormatter.format(new Date(organization.last_order_at))
              : t.admin.never}
          </p>

          <p className="flex items-start gap-2 rounded-lg bg-surface-alt px-4 py-3 text-xs text-text-secondary">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t.admin.detail.privacyNote}
          </p>
        </section>

        {/* ---- payments ---- */}
        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="font-display text-base font-semibold text-brand-dark">
            {t.admin.detail.paymentHistory}
          </h2>

          {payments.length === 0 ? (
            <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-text-secondary">
              {t.admin.detail.noPayments}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                    <th className="py-3 pr-4 font-medium">{t.admin.payments.columns.submitted}</th>
                    <th className="py-3 pr-4 font-medium">{t.admin.payments.columns.plan}</th>
                    <th className="py-3 pr-4 text-right font-medium">{t.admin.payments.columns.amount}</th>
                    <th className="py-3 pr-4 font-medium">{t.admin.payments.columns.method}</th>
                    <th className="py-3 font-medium">{t.admin.payments.columns.trx}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id as string} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 pr-4 text-text-secondary">
                        {dateFormatter.format(new Date(payment.created_at as string))}
                      </td>
                      <td className="py-3 pr-4 capitalize text-text-primary">
                        {payment.plan_code as string}
                        <span className="text-text-muted"> · {formatCount(payment.months as number)}m</span>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(payment.amount as number)}</td>
                      <td className="py-3 pr-4 uppercase text-text-secondary">{payment.method as string}</td>
                      <td className="py-3 tabular-nums text-text-secondary">
                        {(payment.transaction_id as string | null) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- activity ---- */}
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="font-display text-base font-semibold text-brand-dark">{t.admin.detail.history}</h2>

          {events.length === 0 ? (
            <p className="text-sm text-text-secondary">{t.admin.detail.noHistory}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {events.map((event) => (
                <li key={event.id as string} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="tabular-nums text-text-muted">
                    {dateTimeFormatter.format(new Date(event.created_at as string))}
                  </span>
                  <Badge variant="neutral">{(event.event_type as string).replace(/_/g, " ")}</Badge>
                  {event.note ? <span className="text-text-secondary">· {event.note as string}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
