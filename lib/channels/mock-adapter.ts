import { randomUUID } from "node:crypto";

import type {
  ChannelAdapter,
  InboundEvent,
  MessageAttachment,
  SendMessageInput,
  SendMessageResult,
} from "@/lib/channels/types";

/**
 * The sandbox channel.
 *
 * Meta needs an approved app and page tokens before a single real message can be
 * received, which takes weeks. This channel lets the inbox be built, used and
 * tested before then: messages arrive through the same webhook route, are stored
 * by the same database functions, and are read by the same screens.
 *
 * It is not a stand-in for business logic — everything downstream of it is real.
 * The only thing it stands in for is the provider, and it says so: an outbound
 * message is accepted and given an id, but nothing leaves the server.
 */

function pick(source: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function parseAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const url = pick(row, "url");
    if (!url) return [];
    const type = pick(row, "type") ?? "file";
    const allowed: MessageAttachment["type"][] = ["image", "video", "audio", "file"];
    return [
      {
        type: (allowed as string[]).includes(type) ? (type as MessageAttachment["type"]) : "file",
        url,
        ...(pick(row, "name") ? { name: pick(row, "name") as string } : {}),
      },
    ];
  });
}

function parseOne(entry: unknown): InboundEvent | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;

  const threadId = pick(row, "thread_id", "threadId", "sender_id", "psid", "from");
  if (!threadId) return null;

  const body = pick(row, "text", "body", "message");
  const attachments = parseAttachments(row.attachments);
  if (!body && attachments.length === 0) return null;

  const sentAt = pick(row, "sent_at", "sentAt", "timestamp");

  return {
    connectionExternalId: pick(row, "page_id", "pageId", "recipient_id", "account_id"),
    threadId,
    externalId: pick(row, "message_id", "messageId", "mid"),
    body,
    attachments,
    contactName: pick(row, "name", "sender_name", "contact_name"),
    contactHandle: pick(row, "handle", "username"),
    sentAt: sentAt && !Number.isNaN(Date.parse(sentAt)) ? new Date(sentAt).toISOString() : new Date().toISOString(),
    raw: entry,
  };
}

export const mockChannelAdapter: ChannelAdapter = {
  provider: "mock",
  label: "Sandbox",
  description:
    "A test channel for trying the inbox without Facebook. Messages posted to its webhook behave exactly like real ones.",
  credentialFields: [],
  available: true,

  async testConnection() {
    return { ok: true, detail: "Sandbox channel is always reachable." };
  },

  async sendMessage(_credentials, input: SendMessageInput): Promise<SendMessageResult> {
    // Nothing to call: for the sandbox, we are the provider. The message is
    // stored and marked sent, which is what makes the thread readable end to end.
    if (!input.body.trim()) {
      return { externalId: null };
    }
    return { externalId: `mock-out-${randomUUID()}` };
  },

  parseWebhook(payload: unknown): InboundEvent[] {
    const entries = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { messages?: unknown }).messages)
        ? ((payload as { messages: unknown[] }).messages)
        : [payload];

    return entries
      .map(parseOne)
      .filter((event): event is InboundEvent => event !== null);
  },
};
