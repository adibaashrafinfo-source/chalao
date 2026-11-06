"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getChannelAdapter } from "@/lib/channels/registry";
import { getMessages } from "@/lib/i18n";
import { createAdminClient, hasServiceRoleKey } from "@/lib/db/server";
import { createClient } from "@/lib/db/server";
import { getMembership } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

/**
 * A reply is stored first and sent second, on purpose. If the provider is down,
 * the seller still sees what they wrote and why it did not go out, instead of
 * the text disappearing.
 */
export async function sendReplyAction(conversationId: string, body: string): Promise<ActionResult> {
  const text = body.trim();
  if (!text) return { error: t.inbox.errors.empty };

  const organizationId = await requireOrg();
  const db = await createClient();

  const { data: conversation } = await db
    .from("conversations")
    .select("id, status, external_id, channel_connection_id, channel_connections(provider, is_active)")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!conversation) return { error: t.inbox.errors.notFound };

  // PostgREST returns the joined row as an object or a single-element array.
  const joined = conversation.channel_connections as
    | { provider: string; is_active: boolean }
    | { provider: string; is_active: boolean }[]
    | null;
  const connection = Array.isArray(joined) ? joined[0] : joined;

  let adapter;
  try {
    adapter = getChannelAdapter(connection?.provider ?? "");
  } catch {
    return { error: t.channels.errors.unknownProvider };
  }

  const { data: messageId, error: storeError } = await db.rpc("record_outbound_message", {
    p_conversation_id: conversationId,
    p_body: text,
    p_author: "agent",
  });

  if (storeError || !messageId) return { error: storeError?.message ?? t.inbox.errors.generic };

  // Replying to a finished conversation opens it again.
  if (conversation.status === "closed" || conversation.status === "snoozed") {
    await db
      .from("conversations")
      .update({ status: "open", snoozed_until: null })
      .eq("id", conversationId)
      .eq("organization_id", organizationId);
  }

  let sendError: string | null = null;

  try {
    // Credentials are readable by the server only, so they are fetched with the
    // service role — and only for channels that actually need them.
    let credentials: Record<string, string> = {};
    if (adapter.credentialFields.length > 0) {
      if (!hasServiceRoleKey()) throw new Error("Sending is not configured on this server.");
      const admin = createAdminClient();
      const { data } = await admin.rpc("get_channel_credentials", {
        p_connection_id: conversation.channel_connection_id,
      });
      credentials = (data ?? {}) as Record<string, string>;
    }

    const result = await adapter.sendMessage(credentials, {
      threadId: conversation.external_id,
      body: text,
    });

    await db.rpc("update_message_delivery", {
      p_message_id: messageId,
      p_delivery: "sent",
      p_external_id: result.externalId,
      p_error: null,
    });
  } catch (error) {
    sendError = error instanceof Error ? error.message : t.inbox.errors.sendFailed;
    await db.rpc("update_message_delivery", {
      p_message_id: messageId,
      p_delivery: "failed",
      p_external_id: null,
      p_error: sendError,
    });
  }

  revalidatePath("/inbox");
  return sendError ? { error: t.inbox.errors.sendFailed } : {};
}

export async function setConversationStatusAction(
  conversationId: string,
  status: "open" | "pending" | "closed",
): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const db = await createClient();

  const { error } = await db
    .from("conversations")
    .update({ status, snoozed_until: null })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/inbox");
  return {};
}

export async function assignConversationAction(
  conversationId: string,
  assignToMe: boolean,
): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const db = await createClient();

  const { error } = await db
    .from("conversations")
    .update({ assigned_to: assignToMe ? user.id : null })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/inbox");
  return {};
}

/** Ties a conversation to a customer record, so orders and history line up. */
export async function linkCustomerAction(
  conversationId: string,
  customerId: string | null,
): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const db = await createClient();

  if (customerId) {
    const { data: customer } = await db
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!customer) return { error: t.inbox.errors.generic };
  }

  const { error } = await db
    .from("conversations")
    .update({ customer_id: customerId })
    .eq("id", conversationId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/inbox");
  return {};
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await requireOrg();
  const db = await createClient();
  await db.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  revalidatePath("/inbox");
}
