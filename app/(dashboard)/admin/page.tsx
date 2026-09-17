import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";

import { AdminSearch } from "@/components/admin/admin-search";
import { AdminTabs, StateBadgeTone } from "@/components/admin/admin-shell";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { listOrganizations, listSubmissions } from "@/lib/admin/queries";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";

const t = getMessages("en");

export const metadata: Metadata = { title: t.admin.title };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const initials = await getUserInitials();
  const admin = await isPlatformAdmin();

  if (!admin) {
    return (
      <>
        <Topbar title={t.admin.title} subtitle={t.admin.subtitle} nav={t.dashboard.nav} userInitials={initials} />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl bg-surface px-6 py-16 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <ShieldAlert className="size-5" aria-hidden="true" />
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">{t.admin.adminOnly}</p>
          </div>
        </main>
      </>
    );
  }

  const [organizations, pending] = await Promise.all([listOrganizations(q), listSubmissions("pending")]);

  const paying = organizations.filter((org) => Number(org.monthly_price) > 0).length;
  const expiringSoon = organizations.filter((org) => {
    if (!org.period_end) return false;
    const days = (new Date(org.period_end).getTime() - Date.now()) / 86_400_000;
    return days >= 0 && days <= 7;
  }).length;

  const stats = [
    { label: t.admin.stats.businesses, value: formatCount(organizations.length), hero: true },
    { label: t.admin.stats.paying, value: formatCount(paying) },
    { label: t.admin.stats.pendingPayments, value: formatCount(pending.length) },
    { label: t.admin.stats.expiring, value: formatCount(expiringSoon) },
  ];

  return (
    <>
      <Topbar title={t.admin.title} subtitle={t.admin.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <AdminTabs admin={t.admin} active="organizations" pendingCount={pending.length} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`flex flex-col gap-1.5 rounded-xl p-5 shadow-xs ${stat.hero ? "bg-brand-lime" : "bg-surface"}`}
            >
              <p className={`text-xs ${stat.hero ? "text-brand-dark/70" : "text-text-secondary"}`}>{stat.label}</p>
              <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{stat.value}</p>
            </div>
          ))}
        </div>

        <AdminSearch admin={t.admin} />

        {organizations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <Building2 className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{q ? t.admin.empty.noResults : t.admin.empty.title}</h2>
            {!q && <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.admin.empty.body}</p>}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                  <th className="px-5 py-4 font-medium">{t.admin.columns.business}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.columns.owner}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.columns.plan}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.columns.state}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.columns.periodEnd}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.admin.columns.ordersThisMonth}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.columns.joined}</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const states = t.admin.states as Record<string, string>;
                  const overLimit =
                    org.order_limit !== null && org.orders_this_month >= org.order_limit;

                  return (
                    <tr
                      key={org.organization_id}
                      className="border-b border-border-subtle last:border-b-0 hover:bg-surface-alt"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/admin/${org.organization_id}`}
                          className="font-medium text-brand-dark hover:underline"
                        >
                          {org.name}
                        </Link>
                        {org.pending_submissions > 0 && (
                          <span className="ml-2 rounded-full bg-danger-tint px-2 py-0.5 text-[10px] font-semibold text-danger">
                            {formatCount(org.pending_submissions)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-text-secondary">{org.owner_email ?? "—"}</td>
                      <td className="px-5 py-4">
                        <span className="text-text-primary">{org.plan_name}</span>
                        {Number(org.monthly_price) > 0 && (
                          <span className="text-text-muted"> · {formatBDT(org.monthly_price)}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={StateBadgeTone(org.state)}>{states[org.state] ?? org.state}</Badge>
                      </td>
                      <td className="px-5 py-4 text-text-secondary">
                        {org.period_end ? dateFormatter.format(new Date(org.period_end)) : t.admin.noExpiry}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className={overLimit ? "font-medium tabular-nums text-danger" : "tabular-nums"}>
                          {formatCount(org.orders_this_month)}
                          {org.order_limit !== null && (
                            <span className="text-text-muted"> / {formatCount(org.order_limit)}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-text-secondary">
                        {dateFormatter.format(new Date(org.created_at))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
