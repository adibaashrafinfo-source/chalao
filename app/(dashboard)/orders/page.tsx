import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus, ShoppingBag } from "lucide-react";

import { LimitNotice } from "@/components/billing/limit-notice";
import { Topbar } from "@/components/dashboard/topbar";
import { OrderFilters } from "@/components/orders/order-filters";
import { OrdersTable } from "@/components/orders/orders-table";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/locale";
import { normalizeBdPhone } from "@/lib/phone";
import { getOrderGate } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

// Page titles are read once per server, so they stay in English.
const tEn = getMessages("en");

export const metadata: Metadata = { title: tEn.orders.listTitle };

type OrderRow = {
  id: string;
  order_number: number;
  total: number;
  status: string;
  source: string;
  created_at: string;
  customers: { name: string; phone: string } | { name: string; phone: string }[] | null;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  // The dictionary is fetched here, not at module level: it is per person.
  const t = await getDictionary();
  const { q, status, from, to } = await searchParams;
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  let query = supabase
    .from("orders")
    .select("id, order_number, total, status, source, created_at, customers(name, phone)")
    .eq("organization_id", membership?.organizationId ?? "")
    .order("created_at", { ascending: false })
    .limit(200);

  const selectedStatuses = (status ?? "").split(",").filter(Boolean);
  if (selectedStatuses.length > 0) query = query.in("status", selectedStatuses);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

  const [{ data, error }, gate] = await Promise.all([query, getOrderGate(membership?.organizationId ?? "")]);
  let rows = (data ?? []) as OrderRow[];

  // Search matches the customer's name or phone; PostgREST can't filter on an
  // embedded table without dropping rows, so it happens here.
  const term = q?.trim();
  if (term) {
    const lower = term.toLowerCase();
    const phoneTerm = normalizeBdPhone(term);
    rows = rows.filter((order) => {
      const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
      const name = customer?.name?.toLowerCase() ?? "";
      const phone = customer?.phone ?? "";
      return name.includes(lower) || (phoneTerm.length > 0 && phone.includes(phoneTerm));
    });
  }

  const hasFilters = Boolean(term || selectedStatuses.length || from || to);

  return (
    <>
      <Topbar
        title={t.orders.listTitle}
        subtitle={t.orders.listSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
        action={
          <Button asChild className="ml-1">
            <Link href="/orders/new">
              <Plus />
              <span className="hidden sm:inline">{t.orders.newOrder}</span>
            </Link>
          </Button>
        }
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <LimitNotice limits={t.limits} gate={gate} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <OrderFilters orders={t.orders} />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/orders?${new URLSearchParams({ ...(term ? { q: term } : {}), ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}`}>
              <Download className="size-4" aria-hidden="true" />
              {t.orders.export}
            </a>
          </Button>
        </div>

        {error ? (
          <p className="rounded-xl bg-danger-tint px-6 py-5 text-sm text-danger">{error.message}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">
              {hasFilters ? t.orders.empty.noResults : t.orders.empty.title}
            </h2>
            {!hasFilters && (
              <>
                <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.orders.empty.body}</p>
                <Button asChild className="mt-2">
                  <Link href="/orders/new">
                    <Plus />
                    {t.orders.newOrder}
                  </Link>
                </Button>
              </>
            )}
          </div>
        ) : (
          <OrdersTable
            copy={t.orders}
            orders={rows.map((order) => {
              const customer = Array.isArray(order.customers) ? order.customers[0] : order.customers;
              return {
                id: order.id,
                orderNumber: order.order_number,
                customerName: customer?.name ?? null,
                customerPhone: customer?.phone ?? null,
                total: Number(order.total),
                status: order.status,
                source: order.source,
                createdAt: order.created_at,
              };
            })}
          />
        )}
      </main>
    </>
  );
}
