import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Lock } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { MovementFilters } from "@/components/inventory/movement-filters";
import { StockFilters } from "@/components/inventory/stock-filters";
import { Badge } from "@/components/ui/badge";
import { getUserInitials } from "@/lib/dashboard/user";
import { formatBDT, formatCount } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.inventory.title };

const MOVEMENT_LIMIT = 200;

type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  cost_price: number;
  products: { id: string; name: string; low_stock_threshold: number } | { id: string; name: string; low_stock_threshold: number }[] | null;
};

type MovementRow = {
  id: string;
  movement_type: string;
  quantity_change: number;
  stock_after: number;
  note: string | null;
  created_at: string;
  created_by: string | null;
  // PostgREST returns embedded rows as an object or a single-element array.
  product_variants:
    | { name: string; products: { name: string } | { name: string }[] | null }
    | { name: string; products: { name: string } | { name: string }[] | null }[]
    | null;
  orders: { id: string; order_number: number } | { id: string; order_number: number }[] | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; low?: string; type?: string; from?: string; to?: string }>;
}) {
  const { tab, q, low, type, from, to } = await searchParams;
  const membership = await getMembership();
  const organizationId = membership?.organizationId ?? "";
  const supabase = await createClient();
  const initials = await getUserInitials();

  const activeTab = tab === "movements" ? "movements" : "levels";

  return (
    <>
      <Topbar
        title={t.inventory.title}
        subtitle={t.inventory.subtitle}
        nav={t.dashboard.nav}
        userInitials={initials}
      />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <InventoryTabs inventory={t.inventory} active={activeTab} />

        {activeTab === "levels" ? (
          <StockLevels organizationId={organizationId} supabase={supabase} search={q} lowOnly={low === "1"} />
        ) : (
          <MovementLog
            organizationId={organizationId}
            supabase={supabase}
            types={(type ?? "").split(",").filter(Boolean)}
            from={from}
            to={to}
          />
        )}
      </main>
    </>
  );
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function StockLevels({
  organizationId,
  supabase,
  search,
  lowOnly,
}: {
  organizationId: string;
  supabase: SupabaseClient;
  search?: string;
  lowOnly: boolean;
}) {
  const { data } = await supabase
    .from("product_variants")
    .select("id, name, sku, stock, cost_price, products(id, name, low_stock_threshold)")
    .eq("organization_id", organizationId)
    .order("stock", { ascending: true })
    .limit(500);

  let rows = (data ?? []) as VariantRow[];
  const hasFilters = Boolean(search?.trim()) || lowOnly;

  const term = search?.trim().toLowerCase();
  if (term) {
    rows = rows.filter((row) => {
      const product = first(row.products);
      return (
        product?.name.toLowerCase().includes(term) ||
        row.name.toLowerCase().includes(term) ||
        (row.sku ?? "").toLowerCase().includes(term)
      );
    });
  }

  if (lowOnly) {
    rows = rows.filter((row) => Number(row.stock) < (first(row.products)?.low_stock_threshold ?? 0));
  }

  const totalValue = rows.reduce((sum, row) => sum + Number(row.stock) * Number(row.cost_price), 0);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
          <Boxes className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">
          {hasFilters ? t.inventory.levels.noResults : t.inventory.levels.empty}
        </h2>
      </div>
    );
  }

  return (
    <>
      <StockFilters inventory={t.inventory} />

      <div className="flex w-fit flex-col gap-1 rounded-xl bg-brand-lime px-5 py-4 shadow-xs">
        <p className="text-xs text-brand-dark/70">{t.inventory.levels.totalValue}</p>
        <p className="font-display text-2xl font-bold tabular-nums text-brand-dark">{formatBDT(totalValue)}</p>
        <p className="text-xs text-brand-dark/60">{t.inventory.levels.totalValueHint}</p>
      </div>

      <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
              <th className="px-5 py-4 font-medium">{t.inventory.levels.columns.product}</th>
              <th className="px-5 py-4 font-medium">{t.inventory.levels.columns.variant}</th>
              <th className="px-5 py-4 font-medium">{t.inventory.levels.columns.sku}</th>
              <th className="px-5 py-4 text-right font-medium">{t.inventory.levels.columns.stock}</th>
              <th className="px-5 py-4 text-right font-medium">{t.inventory.levels.columns.threshold}</th>
              <th className="px-5 py-4 text-right font-medium">{t.inventory.levels.columns.value}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const product = first(row.products);
              const threshold = product?.low_stock_threshold ?? 0;
              const stock = Number(row.stock);
              const isOut = stock === 0;
              const isLow = !isOut && stock < threshold;

              return (
                <tr key={row.id} className="border-b border-border-subtle last:border-b-0 hover:bg-surface-alt">
                  <td className="px-5 py-4">
                    {product ? (
                      <Link href={`/products/${product.id}`} className="font-medium text-brand-dark hover:underline">
                        {product.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{row.name}</td>
                  <td className="px-5 py-4 text-text-secondary">{row.sku ?? "—"}</td>
                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex items-center gap-2">
                      {isOut && <Badge variant="danger">{t.inventory.levels.out}</Badge>}
                      {isLow && <Badge variant="warning">{t.inventory.levels.low}</Badge>}
                      <span className="tabular-nums">{formatCount(stock)}</span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-text-muted">{formatCount(threshold)}</td>
                  <td className="px-5 py-4 text-right tabular-nums text-text-primary">
                    {formatBDT(stock * Number(row.cost_price))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function MovementLog({
  organizationId,
  supabase,
  types,
  from,
  to,
}: {
  organizationId: string;
  supabase: SupabaseClient;
  types: string[];
  from?: string;
  to?: string;
}) {
  let query = supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, quantity_change, stock_after, note, created_at, created_by, product_variants(name, products(name)), orders(id, order_number)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(MOVEMENT_LIMIT);

  if (types.length > 0) query = query.in("movement_type", types);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) query = query.lte("created_at", `${to}T23:59:59`);

  const { data } = await query;
  const rows = (data ?? []) as MovementRow[];

  // created_by points at auth.users, which PostgREST can't embed — look the names up separately.
  const userIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) names.set(profile.id as string, profile.full_name as string);
    }
  }

  const hasFilters = types.length > 0 || Boolean(from) || Boolean(to);

  return (
    <>
      <MovementFilters inventory={t.inventory} />

      <p className="flex items-start gap-2 rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary shadow-xs">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t.inventory.movements.readOnly}
      </p>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">
            {hasFilters ? t.inventory.movements.noResults : t.inventory.movements.empty}
          </h2>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.date}</th>
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.product}</th>
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.type}</th>
                <th className="px-5 py-4 text-right font-medium">{t.inventory.movements.columns.change}</th>
                <th className="px-5 py-4 text-right font-medium">{t.inventory.movements.columns.stockAfter}</th>
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.order}</th>
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.note}</th>
                <th className="px-5 py-4 font-medium">{t.inventory.movements.columns.who}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const variant = first(row.product_variants);
                const product = first(variant?.products ?? null);
                const order = first(row.orders);
                const change = Number(row.quantity_change);
                const typeLabels = t.inventory.types as Record<string, string>;

                return (
                  <tr key={row.id} className="border-b border-border-subtle last:border-b-0">
                    <td className="px-5 py-4 tabular-nums text-text-secondary">
                      {dateTimeFormatter.format(new Date(row.created_at))}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-medium text-text-primary">{product?.name ?? "—"}</span>
                      {variant?.name && <span className="text-text-secondary"> · {variant.name}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={change > 0 ? "success" : "neutral"}>
                        {typeLabels[row.movement_type] ?? row.movement_type}
                      </Badge>
                    </td>
                    <td
                      className={`px-5 py-4 text-right font-medium tabular-nums ${
                        change > 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {change > 0 ? "+" : "−"}
                      {formatCount(Math.abs(change))}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">{formatCount(row.stock_after)}</td>
                    <td className="px-5 py-4">
                      {order ? (
                        <Link
                          href={`/orders/${order.id}`}
                          className="tabular-nums text-brand-dark hover:underline"
                        >
                          #{order.order_number}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-text-secondary">{row.note ?? "—"}</td>
                    <td className="px-5 py-4 text-text-secondary">
                      {row.created_by ? names.get(row.created_by) ?? "—" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === MOVEMENT_LIMIT && (
        <p className="text-xs text-text-muted">
          {t.inventory.movements.showing.replace("{count}", String(MOVEMENT_LIMIT))}
        </p>
      )}
    </>
  );
}
