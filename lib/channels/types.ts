// Channel adapter contract.
//
// A "channel" is anywhere a customer can talk to a seller: a Facebook page, an
// Instagram account, or the sandbox used to build and test the inbox. Every
// integration implements this interface, and application code always goes
// through getChannelAdapter() in registry.ts — never a concrete adapter.
//
// This mirrors the courier adapter in lib/couriers, for the same reason: adding
// a provider must not mean editing the inbox.

export type ChannelProvider = "mock" | "facebook" | "instagram";

export type ChannelCredentials = Record<string, string>;

/** One field the seller fills in when connecting this channel. */
export type CredentialField = {
  key: string;
  label: string;
  help?: string;
  optional?: boolean;
};

export type MessageAttachment = {
  type: "image" | "video" | "audio" | "file";
  url: string;
  name?: string;
};

export type SendMessageInput = {
  /** The person's id at the provider (PSID / IGSID), our conversation.external_id. */
  threadId: string;
  body: string;
};

export type SendMessageResult = {
  /** The provider's id for the message, when it gives one. */
  externalId: string | null;
};

/** One inbound message, normalised out of whatever the provider posted. */
export type InboundEvent = {
  /** The page/account the message was addressed to, used to find the connection. */
  connectionExternalId: string | null;
  threadId: string;
  externalId: string | null;
  body: string | null;
  attachments: MessageAttachment[];
  contactName: string | null;
  contactHandle: string | null;
  sentAt: string;
  raw: unknown;
};

/** Thrown with the provider's own message, so the seller sees what really went wrong. */
export class ChannelError extends Error {
  readonly status?: number;
  readonly raw?: unknown;

  constructor(message: string, options: { status?: number; raw?: unknown } = {}) {
    super(message);
    this.name = "ChannelError";
    this.status = options.status;
    this.raw = options.raw;
  }
}

export interface ChannelAdapter {
  readonly provider: ChannelProvider;
  readonly label: string;
  readonly description: string;
  /** Fields shown on the "Connect channel" form. */
  readonly credentialFields: CredentialField[];
  /**
   * False while a provider still needs something we cannot do from inside the
   * app — Meta, for instance, needs an approved app and page tokens. The UI
   * lists the channel and says what is missing instead of pretending it works.
   */
  readonly available: boolean;

  /** Cheap authenticated call behind the "Test connection" button. */
  testConnection(credentials: ChannelCredentials): Promise<{ ok: true; detail?: string }>;

  sendMessage(credentials: ChannelCredentials, input: SendMessageInput): Promise<SendMessageResult>;

  /** Turns a webhook body into normalised events. An unusable payload gives []. */
  parseWebhook(payload: unknown): InboundEvent[];
}
