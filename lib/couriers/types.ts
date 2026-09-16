// Courier adapter contract (Brief §7).
//
// Every courier integration implements this interface. Application code — route
// handlers, server actions, UI — always goes through getCourierAdapter() in
// registry.ts and never imports a concrete adapter directly.

export type CourierProvider = "steadfast";

/** Mirrors the shipment_status enum in the database. */
export type ShipmentStatus =
  | "pending"
  | "booked"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "partially_delivered"
  | "returned"
  | "cancelled"
  | "unknown";

export type CourierCredentials = Record<string, string>;

/** One field the seller has to fill in when connecting this courier. */
export type CredentialField = {
  key: string;
  label: string;
  help?: string;
};

export type CreateShipmentInput = {
  /** Our order number, sent as the courier's invoice reference. */
  invoice: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  weightGrams?: number | null;
  note?: string | null;
};

export type CreateShipmentResult = {
  consignmentId: string;
  trackingCode: string | null;
  status: ShipmentStatus;
  raw: unknown;
};

export type WebhookEvent = {
  consignmentId: string | null;
  invoice: string | null;
  trackingCode: string | null;
  providerStatus: string | null;
  status: ShipmentStatus;
  occurredAt: string;
  raw: unknown;
};

/** Thrown with the courier's own message, so the seller sees what really went wrong. */
export class CourierError extends Error {
  readonly status?: number;
  readonly raw?: unknown;

  constructor(message: string, options: { status?: number; raw?: unknown } = {}) {
    super(message);
    this.name = "CourierError";
    this.status = options.status;
    this.raw = options.raw;
  }
}

export interface CourierAdapter {
  readonly provider: CourierProvider;
  readonly label: string;
  /** Fields shown on the "Connect courier" form. */
  readonly credentialFields: CredentialField[];

  /** Cheap authenticated call, used by the "Test connection" button. */
  testConnection(credentials: CourierCredentials): Promise<{ ok: true; detail?: string }>;

  createShipment(credentials: CourierCredentials, input: CreateShipmentInput): Promise<CreateShipmentResult>;

  /** Maps the courier's own status string onto our shipment_status enum. */
  mapStatus(providerStatus: string | null | undefined): ShipmentStatus;

  /** Turns a webhook body into a normalised event. Returns null if it isn't usable. */
  parseWebhook(payload: unknown): WebhookEvent | null;
}
