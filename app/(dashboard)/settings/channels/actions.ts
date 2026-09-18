"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findChannelAdapter } from "@/lib/channels/registry";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

export async function createChannelAction(values: {
  provider: string;
  label: string;
  externalId?: string;
}): Promise<ActionResult> {
  const adapter = findChannelAdapter(values.provider);
  if (!adapter || !adapter.available) return { error: t.channels.errors.unknownProvider };

  const label = values.label.trim() || adapter.label;
  // A sandbox channel has no page to point at, so it gets its own id.
  const externalId = values.externalId?.trim() || `sandbox-${randomBytes(4).toString("hex")}`;

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.from("channel_connections").insert({
    organization_id: organizationId,
    provider: adapter.provider,
    label,
    external_id: externalId,
  });

  if (error) {
    // 23505: the unique index on (provider, external_id).
    if (error.code === "23505") return { error: t.channels.errors.duplicate };
    return { error: error.message };
  }

  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
  return {};
}

export async function setChannelActiveAction(connectionId: string, isActive: boolean): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("channel_connections")
    .update({ is_active: isActive })
    .eq("id", connectionId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
  return {};
}

/**
 * Removing a channel takes its conversations with it, so it is only allowed
 * while there are none. Otherwise the seller is told to disconnect instead.
 */
export async function deleteChannelAction(connectionId: string): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("channel_connection_id", connectionId);

  if ((count ?? 0) > 0) return { error: t.channels.errors.hasConversations };

  const { error } = await supabase
    .from("channel_connections")
    .delete()
    .eq("id", connectionId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
  return {};
}

/**
 * Posts a message into the inbox through the same function the webhook uses, so
 * what the seller sees here is exactly what a real message does.
 */
export async function simulateInboundAction(values: {
  connectionId: string;
  threadId: string;
  name: string;
  body: string;
}): Promise<ActionResult> {
  const body = values.body.trim();
  const threadId = values.threadId.trim();
  if (!body || !threadId) return { error: t.channels.errors.invalid };

  await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase.rpc("record_inbound_message", {
    p_connection_id: values.connectionId,
    p_thread_id: threadId,
    p_body: body,
    p_external_id: `sim-${randomBytes(8).toString("hex")}`,
    p_attachments: [],
    p_contact_name: values.name.trim() || null,
    p_contact_handle: null,
    p_sent_at: new Date().toISOString(),
    p_payload: null,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/channels");
  revalidatePath("/inbox");
  return {};
}
