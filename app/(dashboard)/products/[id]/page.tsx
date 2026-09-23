import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ProductForm } from "@/components/products/product-form";
import { VariantsEditor, type VariantRow } from "@/components/products/variants-editor";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.products.listTitle };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  const { data: product } = await supabase
    .from("products")
    .select("id, name, sku, category, description, low_stock_threshold, is_active")
    .eq("id", id)
    .eq("organization_id", membership?.organizationId ?? "")
    .maybeSingle();

  if (!product) notFound();

  const { data: variantRows } = await supabase
    .from("product_variants")
    .select("id, name, sku, stock, cost_price, selling_price")
    .eq("product_id", id)
    .eq("organization_id", membership?.organizationId ?? "")
    .order("created_at", { ascending: true });

  const variants = (variantRows ?? []) as VariantRow[];

  return (
    <>
      <Topbar
        title={product.name as string}
        subtitle={t.products.editSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/products"
              className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              {t.products.backToList}
            </Link>
            <DeleteProductButton canDelete={can(membership?.role, "delete_records")} products={t.products} productId={product.id as string} />
          </div>

          <ProductForm
            products={t.products}
            productId={product.id as string}
            defaults={{
              name: product.name as string,
              sku: (product.sku as string | null) ?? "",
              category: (product.category as string | null) ?? "",
              description: (product.description as string | null) ?? "",
              lowStockThreshold: product.low_stock_threshold as number,
              isActive: product.is_active as boolean,
            }}
          />

          <VariantsEditor
            products={t.products}
            productId={product.id as string}
            variants={variants}
            lowStockThreshold={product.low_stock_threshold as number}
          />
        </div>
      </main>
    </>
  );
}
