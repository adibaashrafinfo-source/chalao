import "server-only";

import type { CodSummary, Payout, PayoutItem, UnsettledShipment } from "@/lib/cod/types";
import { createClient } from "@/lib/supabase/server";

export async function getCodSummary(organizationId: string): Promise<CodSummary> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("cod_summary", { p_organization_id: organizationId });

  const row = (data ?? {}) as Record<string, number>;
  return {
    outstandingCount: Number(row.outstanding_count ?? 0),
    outstandingAmount: Number(row.outstanding_amount ?? 0),
    expectedTotal: Number(row.expected_total ?? 0),
    receivedTotal: Number(row.received_total ?? 0),
    difference: Number(row.difference ?? 0),
  };
}

/** Delivered parcels the courier has not paid for yet, oldest first. */
export async function listUnsettledShipments(organizationId: string): Promise<UnsettledShipment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cod_unsettled_shipments")
    .select(
      "shipment_id, order_id, order_number, provider, courier_account_id, consignment_id, cod_amount, recipient_name, district, last_event_at",
    )
    .eq("organization_id", organizationId)
    .order("last_event_at", { ascending: true, nullsFirst: true })
    .limit(500);

  return (data ?? []).map((row) => ({
    shipmentId: row.shipment_id as string,
    orderId: row.order_id as string,
    orderNumber: Number(row.order_number),
    provider: row.provider as string,
    courierAccountId: (row.courier_account_id as string | null) ?? null,
    consignmentId: (row.consignment_id as string | null) ?? null,
    codAmount: Number(row.cod_amount),
    recipientName: row.recipient_name as string,
    district: (row.district as string | null) ?? null,
    deliveredAt: (row.last_event_at as string | null) ?? null,
  }));
}

type PayoutItemRow = {
  id: string;
  cod_amount: number;
  delivery_charge: number;
  cod_fee: number;
  adjustment: number;
  net_amount: number;
  orders: { order_number: number } | { order_number: number }[] | null;
  shipments:
    | { consignment_id: string | null; recipient_name: string }
    | { consignment_id: string | null; recipient_name: string }[]
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  // PostgREST returns a joined row as an object or a single-element array.
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listPayouts(organizationId: string): Promise<Payout[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("courier_payouts")
    .select(
      `id, provider, reference, paid_on, amount_received, method, note,
       courier_accounts(label),
       courier_payout_items(id, cod_amount, delivery_charge, cod_fee, adjustment, net_amount,
         orders(order_number), shipments(consignment_id, recipient_name))`,
    )
    .eq("organization_id", organizationId)
    .order("paid_on", { ascending: false })
    .limit(100);

  return (data ?? []).map((row) => {
    const itemRows = (row.courier_payout_items ?? []) as PayoutItemRow[];

    const items: PayoutItem[] = itemRows.map((item) => {
      const order = one(item.orders);
      const shipment = one(item.shipments);
      return {
        id: item.id,
        orderNumber: order ? Number(order.order_number) : null,
        consignmentId: shipment?.consignment_id ?? null,
        recipientName: shipment?.recipient_name ?? null,
        codAmount: Number(item.cod_amount),
        deliveryCharge: Number(item.delivery_charge),
        codFee: Number(item.cod_fee),
        adjustment: Number(item.adjustment),
        netAmount: Number(item.net_amount),
      };
    });

    const expected = items.reduce((sum, item) => sum + item.netAmount, 0);
    const amountReceived = Number(row.amount_received);
    const courier = one(row.courier_accounts as { label: string } | { label: string }[] | null);

    return {
      id: row.id as string,
      provider: row.provider as string,
      courierLabel: courier?.label ?? null,
      reference: (row.reference as string | null) ?? null,
      paidOn: row.paid_on as string,
      amountReceived,
      method: row.method as string,
      note: (row.note as string | null) ?? null,
      parcelCount: items.length,
      expected,
      difference: amountReceived - expected,
      items,
    };
  });
}
