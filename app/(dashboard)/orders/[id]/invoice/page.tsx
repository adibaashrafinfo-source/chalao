import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import Image from "next/image";
import { PrintButton } from "@/components/orders/print-button";
import { formatBDT } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.invoice.title };

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

type ItemRow = { id: string; product_name: string; variant_name: string | null; unit_price: number; quantity: number; line_total: number };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createClient();

  const [{ data: order }, { data: organization }, { data: itemRows }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, subtotal, discount, delivery_charge, total, delivery_address, district, notes, created_at, customers(name, phone, address, district)",
      )
      .eq("id", id)
      .eq("organization_id", membership.organizationId)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("name, phone, address, logo_url")
      .eq("id", membership.organizationId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_name, variant_name, unit_price, quantity, line_total")
      .eq("order_id", id)
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: true }),
  ]);

  if (!order) notFound();

  const joined = order.customers as
    | { name: string; phone: string; address: string | null; district: string | null }
    | { name: string; phone: string; address: string | null; district: string | null }[]
    | null;
  const customer = Array.isArray(joined) ? joined[0] : joined;
  const items = (itemRows ?? []) as ItemRow[];

  const address = (order.delivery_address as string | null) ?? customer?.address ?? "";
  const district = (order.district as string | null) ?? customer?.district ?? "";

  return (
    <main className="flex-1 bg-app p-4 sm:p-6 print:bg-white print:p-0">
      {/* Everything in this bar is for the person at the screen, not the parcel. */}
      <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 pb-4 print:hidden">
        <Link
          href={`/orders/${id}`}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t.invoice.back}
        </Link>
        <PrintButton label={t.invoice.print} />
      </div>

      <article className="mx-auto flex min-h-[297mm] max-w-[210mm] flex-col gap-6 bg-white p-8 shadow-xs print:min-h-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border-subtle pb-6">
          <div className="flex flex-col gap-2">
            {/* The seller's own mark when they have one. A customer opening a
                parcel should see the shop, not the software it uses. */}
            {organization?.logo_url ? (
              <Image
                src={organization.logo_url as string}
                alt={(organization?.name as string) ?? ""}
                width={200}
                height={80}
                unoptimized
                className="max-h-16 w-auto object-contain"
              />
            ) : null}
            <p className="font-display text-lg font-semibold text-brand-dark">{organization?.name}</p>
            {organization?.address ? (
              <p className="max-w-xs text-xs leading-relaxed text-text-secondary">{organization.address}</p>
            ) : null}
            {organization?.phone ? (
              <p className="text-xs text-text-secondary">{formatPhone(organization.phone as string)}</p>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-1">
            <p className="font-display text-2xl font-bold text-brand-dark">{t.invoice.heading}</p>
            <p className="text-sm tabular-nums text-text-secondary">
              {t.invoice.number}: #{order.order_number}
            </p>
            <p className="text-sm text-text-secondary">
              {t.invoice.date}: {dateFormatter.format(new Date(order.created_at as string))}
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-text-muted">{t.invoice.billTo}</p>
          <p className="font-medium text-brand-dark">{customer?.name}</p>
          {customer?.phone ? (
            <p className="text-sm tabular-nums text-text-secondary">{formatPhone(customer.phone)}</p>
          ) : null}
          {address ? <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{address}</p> : null}
          {district ? <p className="text-sm text-text-secondary">{district}</p> : null}
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-text-muted">
              <th className="py-2 pr-4 font-medium">{t.invoice.item}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.invoice.quantity}</th>
              <th className="py-2 pr-4 text-right font-medium">{t.invoice.unitPrice}</th>
              <th className="py-2 text-right font-medium">{t.invoice.lineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border-subtle last:border-b-0">
                <td className="py-3 pr-4">
                  {item.product_name}
                  {item.variant_name ? <span className="text-text-muted"> · {item.variant_name}</span> : null}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{item.quantity}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatBDT(item.unit_price)}</td>
                <td className="py-3 text-right tabular-nums">{formatBDT(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
          {/* A tfoot of the same table, so the figures line up under the Amount column. */}
          <tfoot>
            <tr>
              <td colSpan={2} />
              <td className="py-2 pr-4 text-right text-text-secondary">{t.invoice.subtotal}</td>
              <td className="py-2 text-right tabular-nums">{formatBDT(order.subtotal as number)}</td>
            </tr>
            {Number(order.discount) > 0 ? (
              <tr>
                <td colSpan={2} />
                <td className="py-2 pr-4 text-right text-text-secondary">{t.invoice.discount}</td>
                <td className="py-2 text-right tabular-nums">− {formatBDT(order.discount as number)}</td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={2} />
              <td className="py-2 pr-4 text-right text-text-secondary">{t.invoice.delivery}</td>
              <td className="py-2 text-right tabular-nums">{formatBDT(order.delivery_charge as number)}</td>
            </tr>
            <tr className="border-t border-border-subtle">
              <td colSpan={2} />
              <td className="py-3 pr-4 text-right font-display font-semibold text-brand-dark">
                {t.invoice.payable}
              </td>
              <td className="py-3 text-right font-display text-lg font-bold tabular-nums text-brand-dark">
                {formatBDT(order.total as number)}
              </td>
            </tr>
          </tfoot>
        </table>

        {order.notes ? (
          <section className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-wide text-text-muted">{t.invoice.note}</p>
            <p className="text-sm leading-relaxed text-text-secondary">{order.notes as string}</p>
          </section>
        ) : null}

        <footer className="mt-auto border-t border-border-subtle pt-4 text-center text-xs text-text-muted">
          {t.invoice.thanks}
        </footer>
      </article>
    </main>
  );
}
