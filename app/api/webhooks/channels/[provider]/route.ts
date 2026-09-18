import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { getChannelAdapter } from "@/lib/channels/registry";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";

// Incoming messages from a channel. There is no user session here, so the request
// authenticates itself with the per-connection webhook token and everything runs
// with the service role — the same shape as the courier webhook.
//
// Storing the message is left to record_inbound_message(), which also owns the
// conversation counters and the duplicate check.

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
    adapter = getChannelAdapter(provider);
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

  const { data: connections } = await admin
    .from("channel_connections")
    .select("id, organization_id, external_id, is_active, webhook_token")
    .eq("provider", provider);

  const connection = (connections ?? []).find((row) => tokensMatch(String(row.webhook_token ?? ""), token));

  if (!connection) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  if (!connection.is_active) return NextResponse.json({ error: "Channel is disconnected" }, { status: 409 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = adapter.parseWebhook(payload);

  if (events.length === 0) {
    return NextResponse.json({ error: "Nothing usable in payload" }, { status: 400 });
  }

  let stored = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const event of events) {
    // A payload that names a different page than this token belongs to is not ours.
    if (event.connectionExternalId && event.connectionExternalId !== connection.external_id) {
      skipped += 1;
      continue;
    }

    const { data, error } = await admin.rpc("record_inbound_message", {
      p_connection_id: connection.id,
      p_thread_id: event.threadId,
      p_body: event.body,
      p_external_id: event.externalId,
      p_attachments: event.attachments,
      p_contact_name: event.contactName,
      p_contact_handle: event.contactHandle,
      p_sent_at: event.sentAt,
      p_payload: event.raw as never,
    });

    if (error) {
      // One bad message must not make the provider retry the whole batch.
      console.warn("[channel webhook] message skipped:", error.message);
      skipped += 1;
      continue;
    }

    if ((data as { duplicate?: boolean } | null)?.duplicate) duplicates += 1;
    else stored += 1;
  }

  return NextResponse.json({ received: events.length, stored, duplicates, skipped });
}
