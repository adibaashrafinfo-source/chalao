import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { CustomerSearch } from "@/components/customers/customer-search";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { formatPhone, normalizeBdPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.customers.listTitle };

type OrderSummary = { total: number; status: string; created_at: string };
type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  district: string | null;
  created_at: string;
  orders: OrderSummary[];
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  let query = supabase
    .from("customers")
    .select("id, name, phone, district, created_at, orders(total, status, created_at)")
    .eq("organization_id", membership?.organizationId ?? "")
    .order("created_at", { ascending: false })
    .limit(200);

  const term = q?.trim();
  if (term) {
    const safe = term.replace(/[%,]/g, "");
    // Only match on phone when the term actually contains digits — otherwise the
    // normalised phone is empty and "%%" would match every customer.
    const phoneTerm = normalizeBdPhone(safe).replace(/[%,]/g, "");
    const clauses = [`name.ilike.%${safe}%`];
    if (phoneTerm) clauses.push(`phone.ilike.%${phoneTerm}%`);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  const customers = (data ?? []) as CustomerRow[];

  return (
    <>
      <Topbar
        title={t.customers.listTitle}
        subtitle={t.customers.listSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
        action={
          <Button asChild className="ml-1">
            <Link href="/customers/new">
              <Plus />
              <span className="hidden sm:inline">{t.customers.newCustomer}</span>
            </Link>
          </Button>
        }
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <CustomerSearch customers={t.customers} />

        {error ? (
          <p className="rounded-xl bg-danger-tint px-6 py-5 text-sm text-danger">{error.message}</p>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <Users className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{term ? t.customers.empty.noResults : t.customers.empty.title}</h2>
            {!term && <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.customers.empty.body}</p>}
            {!term && (
              <Button asChild className="mt-2">
                <Link href="/customers/new">
                  <Plus />
                  {t.customers.newCustomer}
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                  <th className="px-5 py-4 font-medium">{t.customers.columns.name}</th>
                  <th className="px-5 py-4 font-medium">{t.customers.columns.phone}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.customers.columns.orders}</th>
                  <th className="px-5 py-4 font-medium">{t.customers.columns.lastOrder}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.customers.columns.lifetimeValue}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const orders = customer.orders ?? [];
                  const lastOrder = orders
                    .map((order) => order.created_at)
                    .sort()
                    .at(-1);
                  const lifetimeValue = orders
                    .filter((order) => order.status === "delivered")
                    .reduce((sum, order) => sum + Number(order.total), 0);

                  return (
                    <tr key={customer.id} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-alt">
                      <td className="px-5 py-4">
                        <Link href={`/customers/${customer.id}`} className="font-medium text-brand-dark hover:underline">
                          {customer.name}
                        </Link>
                        {customer.district && <p className="text-xs text-text-muted">{customer.district}</p>}
                      </td>
                      <td className="px-5 py-4 tabular-nums text-text-secondary">{formatPhone(customer.phone)}</td>
                      <td className="px-5 py-4 text-right tabular-nums">{formatCount(orders.length)}</td>
                      <td className="px-5 py-4 text-text-secondary">
                        {lastOrder ? dateFormatter.format(new Date(lastOrder)) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-text-primary">
                        {formatBDT(lifetimeValue)}
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
