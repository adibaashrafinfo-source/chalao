"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { gateReasonFromError } from "@/lib/subscription";
import { requirePermission } from "@/lib/permissions-server";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { orderCreateSchema, orderDetailsSchema, orderItemSchema } from "@/lib/validations/order";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Totals always come from the stored items — never from numbers the browser sent. */
async function recalculateTotals(supabase: SupabaseClient, organizationId: string, orderId: string) {
  const { data: items } = await supabase
    .from("order_items")
    .select("line_total")
    .eq("order_id", orderId)
    .eq("organization_id", organizationId);

  const { data: order } = await supabase
    .from("orders")
    .select("discount, delivery_charge")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) return;

  const subtotal = (items ?? []).reduce((sum, item) => sum + Number(item.line_total), 0);
  const total = Math.max(0, subtotal - Number(order.discount) + Number(order.delivery_charge));

  await supabase
    .from("orders")
    .update({ subtotal, total })
    .eq("id", orderId)
    .eq("organization_id", organizationId);
}

export async function createOrderAction(values: unknown): Promise<ActionResult> {
  const parsed = orderCreateSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.orders.errors.invalid };

  const organizationId = await requireOrg();
  const supabase = await createClient();
  const input = parsed.data;

  // ---- customer: existing, or created from the inline fields
  let customerId = input.customerId ?? null;

  if (!customerId && input.newCustomer) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("phone", input.newCustomer.phone)
      .maybeSingle();

    if (existing) {
      customerId = existing.id as string;
    } else {
      const { data: created, error: customerError } = await supabase
        .from("customers")
        .insert({
          organization_id: organizationId,
          name: input.newCustomer.name,
          phone: input.newCustomer.phone,
          address: input.newCustomer.address,
          district: input.newCustomer.district,
        })
        .select("id")
        .single();

      if (customerError) return { error: customerError.message };
      customerId = created.id as string;
    }
  }

  if (!customerId) return { error: t.orders.errors.customerRequired };

  const { data: customer } = await supabase
    .from("customers")
    .select("id, address, district")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!customer) return { error: t.orders.errors.customerNotFound };

  // ---- items: every variant must belong to this organization
  const variantIds = input.items.map((item) => item.variantId);
  const { data: variants } = await supabase
    .from("product_variants")
    .select("id, name, selling_price, cost_price, products(name)")
    .eq("organization_id", organizationId)
    .in("id", variantIds);

  const variantMap = new Map((variants ?? []).map((variant) => [variant.id as string, variant]));
  if (variantMap.size !== new Set(variantIds).size) return { error: t.orders.errors.productNotFound };

  const subtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const total = Math.max(0, subtotal - input.discount + input.deliveryCharge);

  // Only link a conversation this organization actually owns.
  let conversationId: string | null = null;
  if (input.conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", input.conversationId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    conversationId = (conversation?.id as string | undefined) ?? null;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      conversation_id: conversationId,
      source: input.source,
      subtotal,
      discount: input.discount,
      delivery_charge: input.deliveryCharge,
      total,
      delivery_address: input.deliveryAddress ?? customer.address,
      district: input.district ?? customer.district,
      notes: input.notes,
    })
    .select("id")
    .single();

  if (orderError) {
    // The subscription trigger speaks in codes; say it in words instead.
    const reason = gateReasonFromError(orderError.message);
    if (reason) return { error: t.limits.blockedTitle[reason] };
    return { error: orderError.message };
  }

  const rows = input.items.map((item) => {
    const variant = variantMap.get(item.variantId);
    const product = variant?.products as { name: string } | { name: string }[] | null;
    const productName = (Array.isArray(product) ? product[0]?.name : product?.name) ?? "Product";
    return {
      organization_id: organizationId,
      order_id: order.id as string,
      variant_id: item.variantId,
      product_name: productName,
      variant_name: (variant?.name as string | undefined) ?? null,
      unit_price: item.unitPrice,
      // What the goods cost today, remembered now so last month's profit does not
      // change when a supplier does.
      unit_cost: Number(variant?.cost_price ?? 0),
      quantity: item.quantity,
      line_total: item.unitPrice * item.quantity,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(rows);
  if (itemsError) {
    // Don't leave an order with no lines behind.
    await supabase.from("orders").delete().eq("id", order.id).eq("organization_id", organizationId);
    return { error: itemsError.message };
  }

  // The seller's own rules decide whether this one can be confirmed without them.
  // It returns false rather than throwing when it cannot — a stock shortage must
  // not cost the seller the order they just took.
  await supabase.rpc("auto_confirm_order", { p_order_id: order.id });

  // Ordering from a conversation is the clearest possible statement of who the
  // person is, so tie the conversation to the customer if nobody has yet.
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ customer_id: customerId })
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .is("customer_id", null);
    revalidatePath("/inbox");
  }

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderDetailsAction(orderId: string, values: unknown): Promise<ActionResult> {
  const parsed = orderDetailsSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.orders.errors.invalid };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) return { error: t.orders.errors.notFound };
  if (order.status !== "new" && order.status !== "confirmed") return { error: t.orders.errors.locked };

  const { error } = await supabase
    .from("orders")
    .update({
      discount: parsed.data.discount,
      delivery_charge: parsed.data.deliveryCharge,
      source: parsed.data.source,
      delivery_address: parsed.data.deliveryAddress,
      district: parsed.data.district,
      notes: parsed.data.notes,
    })
    .eq("id", orderId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  await recalculateTotals(supabase, organizationId, orderId);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return {};
}

export async function addOrderItemAction(orderId: string, values: unknown): Promise<ActionResult> {
  const parsed = orderItemSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.orders.errors.invalid };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) return { error: t.orders.errors.notFound };
  // Items are frozen once the order is confirmed, because stock has moved by then.
  if (order.status !== "new") return { error: t.orders.errors.itemsLocked };

  const { data: variant } = await supabase
    .from("product_variants")
    .select("id, name, cost_price, products(name)")
    .eq("id", parsed.data.variantId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!variant) return { error: t.orders.errors.productNotFound };

  const product = variant.products as { name: string } | { name: string }[] | null;
  const productName = (Array.isArray(product) ? product[0]?.name : product?.name) ?? "Product";

  const { error } = await supabase.from("order_items").insert({
    organization_id: organizationId,
    order_id: orderId,
    variant_id: variant.id as string,
    product_name: productName,
    variant_name: variant.name as string,
    unit_price: parsed.data.unitPrice,
    unit_cost: Number(variant.cost_price ?? 0),
    quantity: parsed.data.quantity,
    line_total: parsed.data.unitPrice * parsed.data.quantity,
  });

  if (error) return { error: error.message };

  await recalculateTotals(supabase, organizationId, orderId);
  revalidatePath(`/orders/${orderId}`);
  return {};
}

export async function removeOrderItemAction(orderId: string, itemId: string): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!order) return { error: t.orders.errors.notFound };
  if (order.status !== "new") return { error: t.orders.errors.itemsLocked };

  const { count } = await supabase
    .from("order_items")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("organization_id", organizationId);

  if ((count ?? 0) <= 1) return { error: t.orders.errors.lastItem };

  const { error } = await supabase
    .from("order_items")
    .delete()
    .eq("id", itemId)
    .eq("order_id", orderId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  await recalculateTotals(supabase, organizationId, orderId);
  revalidatePath(`/orders/${orderId}`);
  return {};
}

export async function transitionOrderStatusAction(
  orderId: string,
  newStatus: string,
  note?: string,
): Promise<ActionResult> {
  await requireOrg();

  // Cancelling is the one move staff cannot make: stock comes back and the sale
  // is lost. Every other transition is their day-to-day work.
  if (newStatus === "cancelled") {
    const allowed = await requirePermission("cancel_order");
    if (allowed.error) return { error: allowed.error };
  }

  const supabase = await createClient();

  // The database validates the move, writes order_status_history and moves stock.
  const { error } = await supabase.rpc("transition_order_status", {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_note: note && note.trim() ? note.trim() : null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/products");
  return {};
}
