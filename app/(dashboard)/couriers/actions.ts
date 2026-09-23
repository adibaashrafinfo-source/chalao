"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getCourierAdapter } from "@/lib/couriers/registry";
import { CourierError } from "@/lib/couriers/types";
import { getMessages } from "@/lib/i18n";
import { normalizeBdPhone } from "@/lib/phone";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export type ActionResult = { error?: string; detail?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

const connectSchema = z.object({
  provider: z.literal("steadfast"),
  label: z.string().trim().min(1).max(60).default("Default"),
  credentials: z.record(z.string(), z.string().trim().min(1, "All credential fields are required")),
});

const bookingSchema = z.object({
  orderId: z.string().uuid(),
  courierAccountId: z.string().uuid(),
  recipientName: z.string().trim().min(1, "Recipient name is required").max(120),
  recipientPhone: z.string().trim().min(1, "Phone number is required").transform(normalizeBdPhone),
  recipientAddress: z.string().trim().min(1, "Address is required").max(400),
  district: z.string().trim().max(60).optional(),
  codAmount: z.coerce.number().min(0).max(99_999_999),
  weightGrams: z.coerce.number().int().min(1).max(100_000).optional(),
  note: z.string().trim().max(300).optional(),
});

/** Credentials are readable only with the service role, so booking needs that key. */
async function readCredentials(courierAccountId: string) {
  if (!hasServiceRoleKey()) throw new CourierError(t.couriers.errors.noServiceKey);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_courier_credentials", { p_account_id: courierAccountId });

  if (error) throw new CourierError(error.message);
  if (!data) throw new CourierError(t.couriers.errors.noCredentials);

  return data as Record<string, string>;
}

export async function connectCourierAction(values: unknown): Promise<ActionResult> {
  const parsed = connectSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.couriers.errors.invalid };

  const allowed = await requirePermission("manage_couriers");
  if (allowed.error) return { error: allowed.error };
  const organizationId = allowed.organizationId;
  const supabase = await createClient();
  const adapter = getCourierAdapter(parsed.data.provider);

  // Test the credentials before storing them (Brief §6.7).
  try {
    await adapter.testConnection(parsed.data.credentials);
  } catch (error) {
    return { error: error instanceof CourierError ? error.message : t.couriers.errors.testFailed };
  }

  const { data: account, error } = await supabase
    .from("courier_accounts")
    .insert({
      organization_id: organizationId,
      provider: parsed.data.provider,
      label: parsed.data.label,
      last_tested_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.code === "23505" ? t.couriers.errors.duplicateLabel : error.message };
  }

  // Straight into Vault — the credentials never touch a normal column.
  const { error: vaultError } = await supabase.rpc("set_courier_credentials", {
    p_account_id: account.id,
    p_credentials: parsed.data.credentials,
  });

  if (vaultError) {
    await supabase.from("courier_accounts").delete().eq("id", account.id).eq("organization_id", organizationId);
    return { error: vaultError.message };
  }

  revalidatePath("/couriers");
  return {};
}

export async function testCourierAction(courierAccountId: string): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("courier_accounts")
    .select("id, provider")
    .eq("id", courierAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!account) return { error: t.couriers.errors.notFound };

  try {
    const adapter = getCourierAdapter(account.provider as string);
    const credentials = await readCredentials(courierAccountId);
    const result = await adapter.testConnection(credentials);

    await supabase
      .from("courier_accounts")
      .update({ last_tested_at: new Date().toISOString() })
      .eq("id", courierAccountId)
      .eq("organization_id", organizationId);

    revalidatePath("/couriers");
    return { detail: result.detail };
  } catch (error) {
    return { error: error instanceof CourierError ? error.message : t.couriers.errors.testFailed };
  }
}

export async function setCourierActiveAction(courierAccountId: string, isActive: boolean): Promise<ActionResult> {
  const allowed = await requirePermission("manage_couriers");
  if (allowed.error) return { error: allowed.error };
  const organizationId = allowed.organizationId;
  const supabase = await createClient();

  const { error } = await supabase
    .from("courier_accounts")
    .update({ is_active: isActive })
    .eq("id", courierAccountId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/couriers");
  return {};
}

export async function deleteCourierAction(courierAccountId: string): Promise<ActionResult> {
  const allowed = await requirePermission("manage_couriers");
  if (allowed.error) return { error: allowed.error };
  const organizationId = allowed.organizationId;
  const supabase = await createClient();

  const { error } = await supabase
    .from("courier_accounts")
    .delete()
    .eq("id", courierAccountId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.code === "23503" ? t.couriers.errors.hasShipments : error.message };

  revalidatePath("/couriers");
  return {};
}

/**
 * Books a parcel for an order. On success: shipment row + order moves to `shipped`.
 * On failure: the courier's own message is shown and the order is left untouched.
 */
export async function bookShipmentAction(values: unknown): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.couriers.errors.invalid };

  const organizationId = await requireOrg();
  const supabase = await createClient();
  const input = parsed.data;

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status")
    .eq("id", input.orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) return { error: t.orders.errors.notFound };
  if (order.status !== "ready_to_ship") return { error: t.couriers.errors.notReady };

  const { data: account } = await supabase
    .from("courier_accounts")
    .select("id, provider, is_active")
    .eq("id", input.courierAccountId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!account || !account.is_active) return { error: t.couriers.errors.notFound };

  let booking;
  try {
    const adapter = getCourierAdapter(account.provider as string);
    const credentials = await readCredentials(account.id as string);
    booking = await adapter.createShipment(credentials, {
      invoice: String(order.order_number),
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      recipientAddress: input.recipientAddress,
      codAmount: input.codAmount,
      weightGrams: input.weightGrams ?? null,
      note: input.note ?? null,
    });
  } catch (error) {
    // Surface the courier's real error; leave the order status alone.
    return { error: error instanceof CourierError ? error.message : t.couriers.errors.bookingFailed };
  }

  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments")
    .insert({
      organization_id: organizationId,
      order_id: input.orderId,
      courier_account_id: account.id,
      provider: account.provider,
      consignment_id: booking.consignmentId,
      tracking_code: booking.trackingCode,
      status: booking.status,
      cod_amount: input.codAmount,
      weight_grams: input.weightGrams ?? null,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      district: input.district || null,
    })
    .select("id")
    .single();

  if (shipmentError) return { error: shipmentError.message };

  const { error: statusError } = await supabase.rpc("transition_order_status", {
    p_order_id: input.orderId,
    p_new_status: "shipped",
    p_note: `Booked with ${account.provider} · ${booking.consignmentId}`,
  });

  if (statusError) {
    // The parcel is booked; only the status move failed. Say so instead of pretending.
    return { error: `${t.couriers.errors.bookedButStatus} (${statusError.message})` };
  }

  await supabase.from("shipment_events").insert({
    organization_id: organizationId,
    shipment_id: shipment.id,
    provider_status: "booked",
    mapped_status: booking.status,
    payload: booking.raw as never,
  });

  revalidatePath(`/orders/${input.orderId}`);
  revalidatePath("/orders");
  return {};
}
