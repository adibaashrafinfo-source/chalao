import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";

import { AdminTabs } from "@/components/admin/admin-shell";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { listSubmissions } from "@/lib/admin/queries";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { isPlatformAdmin } from "@/lib/site-settings";
import { cn } from "@/lib/utils";

const t = getMessages("en");

export const metadata: Metadata = { title: t.admin.payments.title };

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const filters = [
  { key: "pending", label: t.admin.payments.pending },
  { key: "approved", label: t.admin.payments.approved },
  { key: "rejected", label: t.admin.payments.rejected },
  { key: "all", label: t.admin.payments.all },
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = filters.some((filter) => filter.key === status) ? (status as string) : "pending";

  const initials = await getUserInitials();
  if (!(await isPlatformAdmin())) notFound();

  const [submissions, pending] = await Promise.all([
    listSubmissions(active),
    active === "pending" ? Promise.resolve(null) : listSubmissions("pending"),
  ]);

  const pendingCount = pending ? pending.length : submissions.filter((row) => row.status === "pending").length;

  return (
    <>
      <Topbar
        title={t.admin.payments.title}
        subtitle={t.admin.payments.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <AdminTabs admin={t.admin} active="payments" pendingCount={pendingCount} />

        <div className="flex w-fit items-center gap-1 rounded-full bg-surface p-1 shadow-xs">
          {filters.map((filter) => (
            <Link
              key={filter.key}
              href={`/admin/payments?status=${filter.key}`}
              aria-current={active === filter.key ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active === filter.key
                  ? "bg-brand-lime font-semibold text-brand-dark"
                  : "text-text-secondary hover:text-brand-dark",
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <CreditCard className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{t.admin.payments.empty}</h2>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.business}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.plan}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.admin.payments.columns.amount}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.method}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.trx}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.sender}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.submitted}</th>
                  <th className="px-5 py-4 font-medium">{t.admin.payments.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((row) => (
                  <tr key={row.id} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-alt">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/${row.organization_id}`}
                        className="font-medium text-brand-dark hover:underline"
                      >
                        {row.organization_name}
                      </Link>
                      <p className="text-xs text-text-muted">{row.owner_email ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4 capitalize text-text-primary">
                      {row.plan_code}
                      <span className="text-text-muted"> · {formatCount(row.months)}m</span>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{formatBDT(row.amount)}</td>
                    <td className="px-5 py-4 uppercase text-text-secondary">{row.method}</td>
                    <td className="px-5 py-4 tabular-nums text-text-primary">{row.transaction_id}</td>
                    <td className="px-5 py-4 tabular-nums text-text-secondary">{row.sender_number ?? "—"}</td>
                    <td className="px-5 py-4 text-text-secondary">
                      {dateTimeFormatter.format(new Date(row.created_at))}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant={
                          row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"
                        }
                      >
                        {t.admin.payments[row.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
