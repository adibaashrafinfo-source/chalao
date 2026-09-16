import type { Metadata } from "next";
import Link from "next/link";
import { Package, Plus } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.products.listTitle };

type VariantRow = { stock: number; selling_price: number; is_active: boolean };
type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  is_active: boolean;
  low_stock_threshold: number;
  product_variants: VariantRow[];
};

function priceRange(variants: VariantRow[]): string {
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => Number(v.selling_price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatBDT(min) : `${formatBDT(min)} – ${formatBDT(max)}`;
}

export default async function ProductsPage() {
  const membership = await getMembership();
  const supabase = await createClient();
  const initials = await getUserInitials();

  // RLS already scopes this; the explicit filter is defence in depth (Brief §9).
  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, category, is_active, low_stock_threshold, product_variants(stock, selling_price, is_active)")
    .eq("organization_id", membership?.organizationId ?? "")
    .order("created_at", { ascending: false });

  const products = (data ?? []) as ProductRow[];

  return (
    <>
      <Topbar
        title={t.products.listTitle}
        subtitle={t.products.listSubtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
        action={
          <Button asChild className="ml-1">
            <Link href="/products/new">
              <Plus />
              <span className="hidden sm:inline">{t.products.newProduct}</span>
            </Link>
          </Button>
        }
      />

      <main className="flex-1 p-4 sm:p-6">
        {error ? (
          <p className="rounded-xl bg-danger-tint px-6 py-5 text-sm text-danger">{error.message}</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <Package className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{t.products.empty.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.products.empty.body}</p>
            <Button asChild className="mt-2">
              <Link href="/products/new">
                <Plus />
                {t.products.newProduct}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                  <th className="px-5 py-4 font-medium">{t.products.columns.name}</th>
                  <th className="px-5 py-4 font-medium">{t.products.columns.sku}</th>
                  <th className="px-5 py-4 font-medium">{t.products.columns.category}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.products.columns.stock}</th>
                  <th className="px-5 py-4 text-right font-medium">{t.products.columns.price}</th>
                  <th className="px-5 py-4 font-medium">{t.products.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const totalStock = product.product_variants.reduce((sum, v) => sum + Number(v.stock), 0);
                  const isLow = product.product_variants.length > 0 && totalStock < product.low_stock_threshold;
                  return (
                    <tr key={product.id} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-alt">
                      <td className="px-5 py-4">
                        <Link href={`/products/${product.id}`} className="font-medium text-brand-dark hover:underline">
                          {product.name}
                        </Link>
                        <p className="text-xs text-text-muted">
                          {formatCount(product.product_variants.length)} {t.products.variants.title.toLowerCase()}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-text-secondary">{product.sku ?? "—"}</td>
                      <td className="px-5 py-4 text-text-secondary">{product.category ?? "—"}</td>
                      <td className="px-5 py-4 text-right">
                        <span className={isLow ? "font-medium tabular-nums text-danger" : "tabular-nums"}>
                          {formatCount(totalStock)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-text-primary">
                        {priceRange(product.product_variants)}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={product.is_active ? "success" : "neutral"}>
                          {product.is_active ? t.products.status.active : t.products.status.inactive}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
