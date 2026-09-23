import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { DeleteCustomerButton } from "@/components/customers/delete-customer-button";
import { RiskBadge } from "@/components/risk/risk-badge";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { orderSourceLabel, orderStatusLabel, orderStatusTone } from "@/lib/orders/status";
import { getCustomerRisk } from "@/lib/risk/queries";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.customers.listTitle };

type OrderRow = {
  id: string;
  order_number: number;
  total: number;
  status: string;
  source: string;
  created_at: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();
  const organizationId = membership?.organizationId ?? "";

  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, alt_phone, email, address, district, notes")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!customer) notFound();

  const { data: orderRows } = await supabase
    .from("orders")
    .select("id, order_number, total, status, source, created_at")
    .eq("customer_id", id)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const orders = (orderRows ?? []) as OrderRow[];

  // Computed from real orders — no placeholder numbers (Brief §6.4).
  const countBy = (status: string) => orders.filter((order) => order.status === status).length;
  const lifetimeValue = orders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + Number(order.total), 0);

  const risk = await getCustomerRisk(customer.id as string);

  const stats = [
    { label: t.customers.stats.totalOrders, value: formatCount(orders.length) },
    { label: t.customers.stats.delivered, value: formatCount(countBy("delivered")) },
    { label: t.customers.stats.cancelled, value: formatCount(countBy("cancelled")) },
    { label: t.customers.stats.returned, value: formatCount(countBy("returned")) },
  ];

  return (
    <>
      <Topbar
        title={customer.name as string}
        subtitle={t.customers.profileSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/customers"
              className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t.customers.backToList}
            </Link>
            <DeleteCustomerButton canDelete={can(membership?.role, "delete_records")} customers={t.customers} customerId={customer.id as string} />
          </div>

          <RiskBadge risk={risk} messages={t.risk} />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex flex-col gap-1.5 rounded-xl bg-brand-lime p-5 shadow-xs">
              <p className="text-xs text-brand-dark/70">{t.customers.stats.lifetimeValue}</p>
              <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">
                {formatBDT(lifetimeValue)}
              </p>
              <p className="text-xs text-brand-dark/60">{t.customers.stats.lifetimeValueHint}</p>
            </div>
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1.5 rounded-xl bg-surface p-5 shadow-xs">
                <p className="text-xs text-text-secondary">{stat.label}</p>
                <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{stat.value}</p>
              </div>
            ))}
          </div>

          <CustomerForm
            customers={t.customers}
            customerId={customer.id as string}
            defaults={{
              name: customer.name as string,
              phone: customer.phone as string,
              altPhone: (customer.alt_phone as string | null) ?? "",
              email: (customer.email as string | null) ?? "",
              address: (customer.address as string | null) ?? "",
              district: (customer.district as string | null) ?? "",
              notes: (customer.notes as string | null) ?? "",
            }}
          />

          <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="font-display text-base font-semibold text-brand-dark">{t.customers.orderHistory.title}</h2>

            {orders.length === 0 ? (
              <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-text-secondary">
                {t.customers.orderHistory.empty}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                      <th className="py-3 pr-4 font-medium">{t.customers.orderHistory.columns.order}</th>
                      <th className="py-3 pr-4 font-medium">{t.customers.orderHistory.columns.date}</th>
                      <th className="py-3 pr-4 text-right font-medium">{t.customers.orderHistory.columns.total}</th>
                      <th className="py-3 pr-4 font-medium">{t.customers.orderHistory.columns.status}</th>
                      <th className="py-3 font-medium">{t.customers.orderHistory.columns.source}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border-subtle last:border-b-0">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-medium tabular-nums text-brand-dark hover:underline"
                          >
                            #{order.order_number}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">
                          {dateFormatter.format(new Date(order.created_at))}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(order.total)}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
                        </td>
                        <td className="py-3 text-text-secondary">{orderSourceLabel(order.source)}</td>
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
