"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { productSchema, stockAdjustmentSchema, variantSchema } from "@/lib/validations/product";

const t = getMessages("en");

export type ActionResult = { error?: string };

async function requireOrg() {
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");
  return membership.organizationId;
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid details";
}

// ---------------------------------------------------------------- products

export async function createProductAction(values: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
      sku: parsed.data.sku,
      category: parsed.data.category,
      description: parsed.data.description,
      low_stock_threshold: parsed.data.lowStockThreshold,
      is_active: parsed.data.isActive,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/products");
  redirect(`/products/${data.id}`);
}

export async function updateProductAction(productId: string, values: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      sku: parsed.data.sku,
      category: parsed.data.category,
      description: parsed.data.description,
      low_stock_threshold: parsed.data.lowStockThreshold,
      is_active: parsed.data.isActive,
    })
    .eq("id", productId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {};
}

export async function toggleProductActiveAction(productId: string, isActive: boolean): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", productId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {};
}

export async function deleteProductAction(productId: string): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", organizationId);

  // 23503 = the inventory ledger still references a variant of this product.
  if (error) return { error: error.code === "23503" ? t.products.errors.hasHistory : error.message };

  revalidatePath("/products");
  redirect("/products");
}

// ---------------------------------------------------------------- variants

export async function createVariantAction(productId: string, values: unknown): Promise<ActionResult> {
  const parsed = variantSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  // Confirm the product belongs to this organization before attaching anything to it.
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!product) return { error: t.products.errors.notFound };

  const { data: variant, error } = await supabase
    .from("product_variants")
    .insert({
      organization_id: organizationId,
      product_id: productId,
      name: parsed.data.name,
      sku: parsed.data.sku,
      cost_price: parsed.data.costPrice,
      selling_price: parsed.data.sellingPrice,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Opening stock goes through the ledger like every other stock change.
  if (parsed.data.initialStock > 0) {
    const { error: movementError } = await supabase.rpc("apply_inventory_movement", {
      p_variant_id: variant.id,
      p_movement_type: "purchase",
      p_quantity_change: parsed.data.initialStock,
      p_note: "Opening stock",
    });
    if (movementError) return { error: movementError.message };
  }

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {};
}

export async function updateVariantAction(
  productId: string,
  variantId: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = variantSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  // Stock is deliberately not updatable here — only apply_inventory_movement() may change it.
  const { error } = await supabase
    .from("product_variants")
    .update({
      name: parsed.data.name,
      sku: parsed.data.sku,
      cost_price: parsed.data.costPrice,
      selling_price: parsed.data.sellingPrice,
    })
    .eq("id", variantId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {};
}

export async function deleteVariantAction(productId: string, variantId: string): Promise<ActionResult> {
  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId)
    .eq("organization_id", organizationId);

  if (error) return { error: error.code === "23503" ? t.products.errors.hasHistory : error.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {};
}

export async function adjustStockAction(productId: string, values: unknown): Promise<ActionResult> {
  const parsed = stockAdjustmentSchema.safeParse(values);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const organizationId = await requireOrg();
  const supabase = await createClient();

  const { data: variant } = await supabase
    .from("product_variants")
    .select("id, stock")
    .eq("id", parsed.data.variantId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!variant) return { error: t.products.errors.notFound };

  const delta = parsed.data.newStock - (variant.stock as number);
  if (delta === 0) return {};

  const { error } = await supabase.rpc("apply_inventory_movement", {
    p_variant_id: parsed.data.variantId,
    p_movement_type: "manual_adjustment",
    p_quantity_change: delta,
    p_note: parsed.data.note,
  });

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  revalidatePath("/products");
  return {};
}
