import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";

import { LimitNotice } from "@/components/billing/limit-notice";
import { Topbar } from "@/components/dashboard/topbar";
import { OrderForm, type VariantOption } from "@/components/orders/order-form";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getOrderGate } from "@/lib/subscription";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.orders.newTitle };

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  selling_price: number;
  products: { name: string; is_active: boolean } | { name: string; is_active: boolean }[] | null;
};

export default async function NewOrderPage() {
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  const gate = await getOrderGate(membership?.organizationId ?? "");

  const { data } = await supabase
    .from("product_variants")
    .select("id, name, sku, stock, selling_price, products(name, is_active)")
    .eq("organization_id", membership?.organizationId ?? "")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(500);

  // Variants of a deactivated product shouldn't be sellable either.
  const variants: VariantOption[] = ((data ?? []) as VariantRow[])
    .filter((variant) => {
      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      return product?.is_active ?? true;
    })
    .map((variant) => {
      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      return {
        id: variant.id,
        productName: product?.name ?? "Product",
        variantName: variant.name,
        sku: variant.sku,
        price: Number(variant.selling_price),
        stock: Number(variant.stock),
      };
    });

  return (
    <>
      <Topbar
        title={t.orders.newTitle}
        subtitle={t.orders.newSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <Link
            href="/orders"
            className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.orders.backToList}
          </Link>

          {/* No point offering the form when the database would refuse the order. */}
          {!gate.allowed ? (
            <LimitNotice limits={t.limits} gate={gate} variant="card" />
          ) : variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-16 text-center shadow-xs">
              <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                <Package className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-semibold">{t.products.empty.title}</h2>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.products.empty.body}</p>
              <Button asChild className="mt-2">
                <Link href="/products/new">{t.products.newProduct}</Link>
              </Button>
            </div>
          ) : (
            <>
              <LimitNotice limits={t.limits} gate={gate} />
              <OrderForm orders={t.orders} variants={variants} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
