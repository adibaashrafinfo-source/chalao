"use server";

import { redirect } from "next/navigation";

import { normalizeBdPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

export type SearchHit = {
  kind: "order" | "customer" | "product";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

/**
 * The one box at the top of every screen. A seller looking something up is
 * almost always holding one of three things: an order number, a phone number,
 * or a product name.
 */
export async function globalSearchAction(term: string): Promise<SearchHit[]> {
  const query = term.trim();
  if (query.length < 2) return [];

  const membership = await getMembership();
  if (!membership) redirect("/login");
  const organizationId = membership.organizationId;

  const supabase = await createClient();
  // % and , would otherwise change the meaning of a PostgREST filter.
  const safe = query.replace(/[%,]/g, "");
  const digits = normalizeBdPhone(safe).replace(/[%,]/g, "");

  const [orders, customers, products] = await Promise.all([
    // An order number is the fastest way in, so it is matched exactly.
    /^\d+$/.test(safe)
      ? supabase
          .from("orders")
          .select("id, order_number, total, status, customers(name)")
          .eq("organization_id", organizationId)
          .eq("order_number", Number(safe))
          .limit(3)
      : Promise.resolve({ data: [] as never[] }),

    supabase
      .from("customers")
      .select("id, name, phone, district")
      .eq("organization_id", organizationId)
      // Only search the phone when the term has digits: an empty normalised
      // phone would become "%%" and match everyone.
      .or(digits ? `name.ilike.%${safe}%,phone.ilike.%${digits}%` : `name.ilike.%${safe}%`)
      .limit(5),

    supabase
      .from("products")
      .select("id, name, sku, category")
      .eq("organization_id", organizationId)
      .or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`)
      .limit(5),
  ]);

  const hits: SearchHit[] = [];

  for (const row of orders.data ?? []) {
    const joined = row.customers as { name: string } | { name: string }[] | null;
    const customer = Array.isArray(joined) ? joined[0] : joined;
    hits.push({
      kind: "order",
      id: row.id as string,
      title: `#${row.order_number}`,
      subtitle: [customer?.name, row.status].filter(Boolean).join(" · "),
      href: `/orders/${row.id}`,
    });
  }

  for (const row of customers.data ?? []) {
    hits.push({
      kind: "customer",
      id: row.id as string,
      title: row.name as string,
      subtitle: [row.phone, row.district].filter(Boolean).join(" · "),
      href: `/customers/${row.id}`,
    });
  }

  for (const row of products.data ?? []) {
    hits.push({
      kind: "product",
      id: row.id as string,
      title: row.name as string,
      subtitle: [row.sku, row.category].filter(Boolean).join(" · "),
      href: `/products/${row.id}`,
    });
  }

  return hits;
}
