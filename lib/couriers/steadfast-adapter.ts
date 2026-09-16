import {
  CourierError,
  type CourierAdapter,
  type CourierCredentials,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type ShipmentStatus,
  type WebhookEvent,
} from "@/lib/couriers/types";

// Steadfast Courier (portal.packzy.com) public API v1.
// Docs: https://steadfast.com.bd/user/api-doc — verify endpoint names and the webhook
// payload against the merchant's own account before going live.
const BASE_URL = process.env.STEADFAST_API_URL ?? "https://portal.packzy.com/api/v1";

function headers(credentials: CourierCredentials) {
  return {
    "Api-Key": credentials.apiKey ?? "",
    "Secret-Key": credentials.secretKey ?? "",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// `auth` rather than `credentials`, which would collide with RequestInit.credentials.
async function call(path: string, init: { method: string; body?: string; auth: CourierCredentials }) {
  const { auth, ...rest } = init;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: headers(auth),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new CourierError(
      error instanceof Error ? `Could not reach Steadfast: ${error.message}` : "Could not reach Steadfast",
    );
  }

  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep the raw text — some errors come back as HTML.
  }

  if (!response.ok) {
    const record = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
    const message =
      (typeof record.message === "string" && record.message) ||
      (typeof record.error === "string" && record.error) ||
      `Steadfast returned ${response.status}`;
    throw new CourierError(message, { status: response.status, raw: body });
  }

  return body;
}

const STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: "pending",
  in_review: "pending",
  hold: "pending",
  approved: "booked",
  confirmed: "booked",
  delivered: "delivered",
  partial_delivered: "partially_delivered",
  partial_delivery: "partially_delivered",
  cancelled: "cancelled",
  cancel: "cancelled",
  returned: "returned",
  return: "returned",
  unknown: "unknown",
  // Steadfast delivery_status values seen in transit
  delivering: "in_transit",
  in_transit: "in_transit",
  shipped: "in_transit",
  picked: "picked_up",
  picked_up: "picked_up",
};

export const steadfastAdapter: CourierAdapter = {
  provider: "steadfast",
  label: "Steadfast",

  credentialFields: [
    { key: "apiKey", label: "API Key", help: "Steadfast merchant panel → API settings" },
    { key: "secretKey", label: "Secret Key" },
  ],

  async testConnection(credentials) {
    const body = await call("/get_balance", { method: "GET", auth: credentials });
    const record = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
    const balance = record.current_balance;
    return { ok: true, detail: balance !== undefined ? `Current balance: ${String(balance)}` : undefined };
  },

  async createShipment(credentials, input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const body = await call("/create_order", {
      method: "POST",
      auth: credentials,
      body: JSON.stringify({
        invoice: input.invoice,
        recipient_name: input.recipientName,
        recipient_phone: input.recipientPhone,
        recipient_address: input.recipientAddress,
        cod_amount: input.codAmount,
        note: input.note ?? "",
      }),
    });

    const record = typeof body === "object" && body ? (body as Record<string, unknown>) : {};
    const consignment = (record.consignment ?? record) as Record<string, unknown>;
    const consignmentId = consignment.consignment_id ?? consignment.id;

    if (consignmentId === undefined || consignmentId === null) {
      const message = typeof record.message === "string" ? record.message : "Steadfast did not return a consignment id";
      throw new CourierError(message, { raw: body });
    }

    return {
      consignmentId: String(consignmentId),
      trackingCode: typeof consignment.tracking_code === "string" ? consignment.tracking_code : null,
      status: steadfastAdapter.mapStatus(
        typeof consignment.status === "string" ? consignment.status : "approved",
      ),
      raw: body,
    };
  },

  mapStatus(providerStatus) {
    if (!providerStatus) return "unknown";
    return STATUS_MAP[providerStatus.toLowerCase().trim()] ?? "unknown";
  },

  parseWebhook(payload): WebhookEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const record = payload as Record<string, unknown>;

    const consignmentId = record.consignment_id ?? record.cid;
    const invoice = record.invoice;
    const providerStatus =
      (typeof record.delivery_status === "string" && record.delivery_status) ||
      (typeof record.status === "string" && record.status) ||
      null;

    if (consignmentId === undefined && invoice === undefined) return null;

    return {
      consignmentId: consignmentId === undefined || consignmentId === null ? null : String(consignmentId),
      invoice: typeof invoice === "string" || typeof invoice === "number" ? String(invoice) : null,
      trackingCode: typeof record.tracking_code === "string" ? record.tracking_code : null,
      providerStatus,
      status: steadfastAdapter.mapStatus(providerStatus),
      occurredAt: typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
      raw: payload,
    };
  },
};
