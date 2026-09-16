import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getCourierAdapter } from "@/lib/couriers/registry";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

// Courier status callbacks. No user session here, so the request authenticates itself
// with the per-account webhook token and everything runs with the service role.
//
// Steadfast's exact callback shape and auth header must be confirmed against the
// merchant's own API settings — the token check below is the portable version.

export const dynamic = "force-dynamic";

function tokensMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;

  let adapter;
  try {
    adapter = getCourierAdapter(provider);
  } catch {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const token =
    request.headers.get("x-webhook-token") ??
    request.nextUrl.searchParams.get("token") ??
    "";

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const admin = createAdminClient();

  const { data: accounts } = await admin
    .from("courier_accounts")
    .select("id, organization_id, webhook_token")
    .eq("provider", provider);

  const account = (accounts ?? []).find((row) =>
    tokensMatch(String(row.webhook_token ?? ""), token),
  );

  if (!account) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Couriers sometimes post a batch.
  const events = (Array.isArray(payload) ? payload : [payload])
    .map((entry) => adapter.parseWebhook(entry))
    .filter((event): event is NonNullable<typeof event> => event !== null);

  if (events.length === 0) {
    return NextResponse.json({ error: "Nothing usable in payload" }, { status: 400 });
  }

  let applied = 0;

  for (const event of events) {
    // Match on consignment id first, then fall back to our order number (the invoice).
    let shipmentQuery = admin
      .from("shipments")
      .select("id, order_id, organization_id, status")
      .eq("organization_id", account.organization_id)
      .eq("provider", provider);

    if (event.consignmentId) {
      shipmentQuery = shipmentQuery.eq("consignment_id", event.consignmentId);
    } else if (event.invoice) {
      const { data: order } = await admin
        .from("orders")
        .select("id")
        .eq("organization_id", account.organization_id)
        .eq("order_number", Number(event.invoice))
        .maybeSingle();

      if (!order) continue;
      shipmentQuery = shipmentQuery.eq("order_id", order.id);
    } else {
      continue;
    }

    const { data: shipment } = await shipmentQuery.maybeSingle();
    if (!shipment) continue;

    await admin.from("shipment_events").insert({
      organization_id: shipment.organization_id,
      shipment_id: shipment.id,
      provider_status: event.providerStatus,
      mapped_status: event.status,
      payload: event.raw as never,
      occurred_at: event.occurredAt,
    });

    await admin
      .from("shipments")
      .update({
        status: event.status,
        last_event_at: event.occurredAt,
        ...(event.trackingCode ? { tracking_code: event.trackingCode } : {}),
      })
      .eq("id", shipment.id);

    // Delivered / returned also moves the order, through the state machine.
    if (event.status === "delivered" || event.status === "returned") {
      const { error } = await admin.rpc("transition_order_status", {
        p_order_id: shipment.order_id,
        p_new_status: event.status,
        p_note: `Courier update: ${event.providerStatus ?? event.status}`,
      });

      // An invalid move (e.g. the order was already delivered) is not a webhook failure.
      if (error) console.warn("[courier webhook] status move skipped:", error.message);
    }

    applied += 1;
  }

  return NextResponse.json({ received: events.length, applied });
}
