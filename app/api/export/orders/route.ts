import { NextResponse, type NextRequest } from "next/server";

import { formatPhone, normalizeBdPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

// The orders a seller is looking at, as a file their accountant can open.
// The same filters as the screen, so what downloads is what they can see.

export const dynamic = "force-dynamic";

/** Quotes a field the way a spreadsheet expects, and defuses formula injection. */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const membership = await getMembership();
  if (!membership) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(
      "order_number, status, source, subtotal, discount, delivery_charge, total, district, delivery_address, created_at, delivered_at, customers(name, phone)",
    )
    .eq("organization_id", membership.organizationId)
    .order("created_at", { ascending: false })
    .limit(5000);

  const statuses = (params.get("status") ?? "").split(",").filter(Boolean);
  if (statuses.length > 0) query = query.in("status", statuses);
  if (params.get("from")) query = query.gte("created_at", `${params.get("from")}T00:00:00`);
  if (params.get("to")) query = query.lte("created_at", `${params.get("to")}T23:59:59`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];

  // The list screen filters the search term here too, for the same reason:
  // PostgREST cannot filter on an embedded table without dropping rows.
  const term = params.get("q")?.trim();
  if (term) {
    const lower = term.toLowerCase();
    const phoneTerm = normalizeBdPhone(term);
    rows = rows.filter((order) => {
      const joined = order.customers as { name: string; phone: string } | { name: string; phone: string }[] | null;
      const customer = Array.isArray(joined) ? joined[0] : joined;
      const name = customer?.name?.toLowerCase() ?? "";
      const phone = customer?.phone ?? "";
      return name.includes(lower) || (phoneTerm.length > 0 && phone.includes(phoneTerm));
    });
  }

  const header = [
    "Order", "Customer", "Phone", "Status", "Source",
    "Subtotal", "Discount", "Delivery charge", "Total",
    "District", "Address", "Created", "Delivered",
  ];

  const lines = [header.map(cell).join(",")];

  for (const order of rows) {
    const joined = order.customers as { name: string; phone: string } | { name: string; phone: string }[] | null;
    const customer = Array.isArray(joined) ? joined[0] : joined;
    lines.push(
      [
        order.order_number,
        customer?.name ?? "",
        customer?.phone ? formatPhone(customer.phone) : "",
        order.status,
        order.source,
        order.subtotal,
        order.discount,
        order.delivery_charge,
        order.total,
        order.district ?? "",
        order.delivery_address ?? "",
        order.created_at,
        order.delivered_at ?? "",
      ]
        .map(cell)
        .join(","),
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  // The BOM is what makes Excel read Bangla names correctly.
  return new NextResponse(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${today}.csv"`,
    },
  });
}
