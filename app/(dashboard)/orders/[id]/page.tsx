import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessagesSquare } from "lucide-react";

import { BookShipment, type CourierChoice } from "@/components/couriers/book-shipment";
import { Topbar } from "@/components/dashboard/topbar";
import { RiskBadge } from "@/components/risk/risk-badge";
import { ConfirmationPanel } from "@/components/orders/confirmation-panel";
import { OrderDetailsForm } from "@/components/orders/order-details-form";
import { OrderItems, type OrderItemRow } from "@/components/orders/order-items";
import type { VariantOption } from "@/components/orders/order-form";
import { StatusActions } from "@/components/orders/status-actions";
import { Badge } from "@/components/ui/badge";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { getConfirmationDecision } from "@/lib/orders/confirmation";
import { getCustomerRisk } from "@/lib/risk/queries";
import {
  areItemsEditable,
  isOrderEditable,
  orderSourceLabel,
  orderStatusLabel,
  orderStatusTone,
} from "@/lib/orders/status";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.orders.listTitle };

type HistoryRow = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
};

type ShipmentRow = {
  id: string;
  provider: string;
  consignment_id: string | null;
  tracking_code: string | null;
  status: string;
  cod_amount: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  created_at: string;
};

type ShipmentEventRow = {
  id: string;
  provider_status: string | null;
  mapped_status: string;
  occurred_at: string;
};

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  selling_price: number;
  products: { name: string } | { name: string }[] | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMembership();
  const organizationId = membership?.organizationId ?? "";
  const supabase = await createClient();
  const initials = await getUserInitials();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, source, subtotal, discount, delivery_charge, total, delivery_address, district, notes, created_at, conversation_id, customers(id, name, phone, address, district)",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) notFound();

  const customerData = order.customers as
    | { id: string; name: string; phone: string; address: string | null; district: string | null }
    | { id: string; name: string; phone: string; address: string | null; district: string | null }[]
    | null;
  const customer = Array.isArray(customerData) ? customerData[0] : customerData;

  // How this customer's past parcels ended, and what the seller's own rules say
  // to do about it — both worth knowing before a parcel goes out on COD.
  const [risk, decision] = await Promise.all([
    customer ? getCustomerRisk(customer.id) : Promise.resolve(null),
    getConfirmationDecision(id),
  ]);

  const [{ data: itemRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_name, variant_name, unit_price, quantity, line_total")
      .eq("order_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_status_history")
      .select("id, from_status, to_status, note, created_at")
      .eq("order_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const items = (itemRows ?? []) as OrderItemRow[];
  const history = (historyRows ?? []) as HistoryRow[];
  const status = order.status as string;
  const itemsEditable = areItemsEditable(status);
  const detailsEditable = isOrderEditable(status);

  // Shipment for this order, plus the courier updates that came in for it.
  const { data: shipmentRow } = await supabase
    .from("shipments")
    .select(
      "id, provider, consignment_id, tracking_code, status, cod_amount, recipient_name, recipient_phone, recipient_address, created_at",
    )
    .eq("order_id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  const shipment = shipmentRow as ShipmentRow | null;

  let shipmentEvents: ShipmentEventRow[] = [];
  if (shipment) {
    const { data } = await supabase
      .from("shipment_events")
      .select("id, provider_status, mapped_status, occurred_at")
      .eq("shipment_id", shipment.id)
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false });
    shipmentEvents = (data ?? []) as ShipmentEventRow[];
  }

  // Courier choices, only needed when the order is waiting to be booked.
  let courierAccounts: CourierChoice[] = [];
  if (status === "ready_to_ship") {
    const { data } = await supabase
      .from("courier_accounts")
      .select("id, provider, label")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    courierAccounts = (data ?? []).map((account) => ({
      id: account.id as string,
      label: account.label as string,
      providerLabel: (account.provider as string) === "steadfast" ? "Steadfast" : (account.provider as string),
    }));
  }

  // Only needed while items can still change.
  let variants: VariantOption[] = [];
  if (itemsEditable) {
    const { data } = await supabase
      .from("product_variants")
      .select("id, name, sku, stock, selling_price, products(name)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .limit(500);

    variants = ((data ?? []) as VariantRow[]).map((variant) => {
      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      return {
        id: variant.id,
        productName: product?.name ?? "Product",
        variantName: variant.name,
        sku: variant.sku,
        price: Number(variant.selling_price),
        stock: Number(variant.stock),
      };
    });
  }

  return (
    <>
      <Topbar
        title={`Order #${order.order_number}`}
        subtitle={t.orders.detailSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/orders"
              className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t.orders.backToList}
            </Link>
            <div className="flex items-center gap-2">
              <Badge variant={orderStatusTone(status)}>{orderStatusLabel(status)}</Badge>
              <span className="text-sm text-text-secondary">{orderSourceLabel(order.source as string)}</span>
            </div>
          </div>

          {/* ---- customer ---- */}
          <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
            <h2 className="font-display text-base font-semibold text-brand-dark">{t.orders.customer.title}</h2>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                {customer && (
                  <Link
                    href={`/customers/${customer.id}`}
                    className="font-medium text-brand-dark hover:underline"
                  >
                    {customer.name}
                  </Link>
                )}
                <span className="text-sm tabular-nums text-text-secondary">
                  {customer?.phone ? formatPhone(customer.phone) : "—"}
                </span>
                <RiskBadge risk={risk} messages={t.risk} />
              </div>
              <div className="flex max-w-sm flex-col gap-1 text-sm text-text-secondary sm:text-right">
                <span>{(order.delivery_address as string | null) ?? customer?.address ?? "—"}</span>
                <span>{(order.district as string | null) ?? customer?.district ?? ""}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              {dateTimeFormatter.format(new Date(order.created_at as string))}
            </p>

            {order.conversation_id ? (
              <Link
                href={`/inbox?c=${order.conversation_id as string}`}
                className="flex w-fit items-center gap-1.5 text-xs text-text-secondary hover:text-brand-dark"
              >
                <MessagesSquare className="size-3.5" aria-hidden="true" />
                {t.orders.fromConversation}
              </Link>
            ) : null}
          </section>

          <OrderItems
            orders={t.orders}
            orderId={order.id as string}
            items={items}
            variants={variants}
            editable={itemsEditable}
          />

          {detailsEditable ? (
            <OrderDetailsForm
              orders={t.orders}
              orderId={order.id as string}
              subtotal={Number(order.subtotal)}
              defaults={{
                discount: Number(order.discount),
                deliveryCharge: Number(order.delivery_charge),
                source: order.source as string,
                deliveryAddress: (order.delivery_address as string | null) ?? "",
                district: (order.district as string | null) ?? "",
                notes: (order.notes as string | null) ?? "",
              }}
            />
          ) : (
            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="font-display text-base font-semibold text-brand-dark">{t.orders.charges.title}</h2>
              <p className="flex items-start gap-2 rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-secondary">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {t.orders.statusActions.lockedNotice}
              </p>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-text-secondary">{t.orders.charges.subtotal}</dt>
                  <dd className="tabular-nums">{formatBDT(order.subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-secondary">{t.orders.charges.discount}</dt>
                  <dd className="tabular-nums">−{formatBDT(order.discount)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-secondary">{t.orders.charges.deliveryCharge}</dt>
                  <dd className="tabular-nums">{formatBDT(order.delivery_charge)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border-subtle pt-2">
                  <dt className="font-display font-semibold text-brand-dark">{t.orders.charges.total}</dt>
                  <dd className="font-display text-lg font-bold tabular-nums text-brand-dark">
                    {formatBDT(order.total)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {/* Booking replaces the missing "mark shipped" step (Brief §6.7). */}
          {status === "ready_to_ship" && (
            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="font-display text-base font-semibold text-brand-dark">{t.couriers.booking.title}</h2>
              <BookShipment
                couriers={t.couriers}
                orderId={order.id as string}
                courierAccounts={courierAccounts}
                defaults={{
                  recipientName: customer?.name ?? "",
                  recipientPhone: customer?.phone ?? "",
                  recipientAddress:
                    (order.delivery_address as string | null) ?? customer?.address ?? "",
                  district: (order.district as string | null) ?? customer?.district ?? "",
                  codAmount: Number(order.total),
                }}
              />
            </section>
          )}

          {shipment && (
            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-brand-dark">{t.couriers.shipment.title}</h2>
                <Badge variant={shipment.status === "delivered" ? "success" : "brand"}>
                  {(t.couriers.statuses as Record<string, string>)[shipment.status] ?? shipment.status}
                </Badge>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex flex-col">
                  <dt className="text-text-secondary">{t.couriers.shipment.consignment}</dt>
                  <dd className="tabular-nums text-text-primary">{shipment.consignment_id ?? "—"}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-secondary">{t.couriers.shipment.tracking}</dt>
                  <dd className="tabular-nums text-text-primary">{shipment.tracking_code ?? "—"}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-secondary">{t.couriers.shipment.cod}</dt>
                  <dd className="tabular-nums text-text-primary">{formatBDT(shipment.cod_amount)}</dd>
                </div>
                <div className="flex flex-col">
                  <dt className="text-text-secondary">{t.couriers.booking.recipientPhone}</dt>
                  <dd className="tabular-nums text-text-primary">{formatPhone(shipment.recipient_phone)}</dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
                <h3 className="font-display text-sm font-semibold text-brand-dark">
                  {t.couriers.shipment.events}
                </h3>
                {shipmentEvents.length === 0 ? (
                  <p className="text-sm text-text-secondary">{t.couriers.shipment.noEvents}</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {shipmentEvents.map((event) => (
                      <li key={event.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="tabular-nums text-text-muted">
                          {dateTimeFormatter.format(new Date(event.occurred_at))}
                        </span>
                        <Badge variant="neutral">
                          {(t.couriers.statuses as Record<string, string>)[event.mapped_status] ??
                            event.mapped_status}
                        </Badge>
                        {event.provider_status && (
                          <span className="text-text-secondary">· {event.provider_status}</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          )}

          {/* Said before the buttons, not after: this is the moment the seller decides. */}
          <ConfirmationPanel copy={t.confirmation} riskCopy={t.risk} decision={decision} />

          <StatusActions canCancel={can(membership?.role, "cancel_order")} orders={t.orders} orderId={order.id as string} status={status} />

          {history.length > 0 && (
            <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
              <h2 className="font-display text-base font-semibold text-brand-dark">
                {t.orders.statusActions.history}
              </h2>
              <ol className="flex flex-col gap-3">
                {history.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular-nums text-text-muted">
                      {dateTimeFormatter.format(new Date(entry.created_at))}
                    </span>
                    {entry.from_status && (
                      <>
                        <Badge variant={orderStatusTone(entry.from_status)}>
                          {orderStatusLabel(entry.from_status)}
                        </Badge>
                        <span className="text-text-muted">→</span>
                      </>
                    )}
                    <Badge variant={orderStatusTone(entry.to_status)}>{orderStatusLabel(entry.to_status)}</Badge>
                    {entry.note && <span className="text-text-secondary">· {entry.note}</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
