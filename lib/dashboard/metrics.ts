import "server-only";

import { createClient } from "@/lib/supabase/server";

// All windows are computed in the server's local timezone, which for this product is
// Bangladesh time. Timestamps are stored as timestamptz, so the comparison is exact.

export type Range = "today" | "7d" | "30d";

export type ChartPoint = { label: string; revenue: number; orders: number };

export type Stats = {
  revenueToday: number;
  revenueYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  deliveredToday: number;
  deliveredYesterday: number;
  pending: number;
};

export type AlertItem = {
  kind: "low_stock" | "out_of_stock" | "stuck_order" | "stale_shipment";
  title: string;
  href: string;
  count?: number;
  threshold?: number;
  hours?: number;
};

const PENDING_STATUSES = ["new", "confirmed", "processing", "ready_to_ship"];
const CANCELLED_STATUSES = ["cancelled", "refunded"];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

type OrderRow = { total: number; status: string; created_at: string; delivered_at: string | null };

export async function getDashboardData(organizationId: string, range: Range) {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = addDays(todayStart, -1);
  // 30 days of history covers every range the toggle offers.
  const windowStart = addDays(todayStart, -29);

  const [{ data: orderRows }, { data: pendingRows }] = await Promise.all([
    supabase
      .from("orders")
      .select("total, status, created_at, delivered_at")
      .eq("organization_id", organizationId)
      .gte("created_at", windowStart.toISOString())
      .limit(5000),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: false })
      .eq("organization_id", organizationId)
      .in("status", PENDING_STATUSES)
      .limit(5000),
  ]);

  const orders = (orderRows ?? []) as OrderRow[];

  // Delivered counts read delivered_at, which the state machine stamps, so an order
  // delivered today still counts even if it was placed last week.
  const { data: deliveredRows } = await supabase
    .from("orders")
    .select("delivered_at")
    .eq("organization_id", organizationId)
    .not("delivered_at", "is", null)
    .gte("delivered_at", yesterdayStart.toISOString())
    .limit(5000);

  const inDay = (value: string | null, start: Date) => {
    if (!value) return false;
    const date = new Date(value);
    return date >= start && date < addDays(start, 1);
  };

  const countsFor = (start: Date) => {
    const dayOrders = orders.filter(
      (order) => inDay(order.created_at, start) && !CANCELLED_STATUSES.includes(order.status),
    );
    return {
      revenue: dayOrders.reduce((sum, order) => sum + Number(order.total), 0),
      orders: dayOrders.length,
    };
  };

  const today = countsFor(todayStart);
  const yesterday = countsFor(yesterdayStart);

  const delivered = (deliveredRows ?? []) as { delivered_at: string }[];
  const stats: Stats = {
    revenueToday: today.revenue,
    revenueYesterday: yesterday.revenue,
    ordersToday: today.orders,
    ordersYesterday: yesterday.orders,
    deliveredToday: delivered.filter((row) => inDay(row.delivered_at, todayStart)).length,
    deliveredYesterday: delivered.filter((row) => inDay(row.delivered_at, yesterdayStart)).length,
    pending: (pendingRows ?? []).length,
  };

  const chart = buildChart(orders, range, todayStart, now);

  return { stats, chart };
}

function buildChart(orders: OrderRow[], range: Range, todayStart: Date, now: Date): ChartPoint[] {
  const live = orders.filter((order) => !CANCELLED_STATUSES.includes(order.status));

  if (range === "today") {
    // Two-hour buckets keep the bars readable on a phone.
    const buckets: ChartPoint[] = [];
    for (let hour = 0; hour <= now.getHours(); hour += 2) {
      buckets.push({ label: `${String(hour).padStart(2, "0")}:00`, revenue: 0, orders: 0 });
    }

    for (const order of live) {
      const date = new Date(order.created_at);
      if (date < todayStart) continue;
      const index = Math.floor(date.getHours() / 2);
      const bucket = buckets[index];
      if (!bucket) continue;
      bucket.revenue += Number(order.total);
      bucket.orders += 1;
    }

    return buckets;
  }

  const days = range === "7d" ? 7 : 30;
  const formatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
  const buckets = new Map<string, ChartPoint>();

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = addDays(todayStart, -offset);
    buckets.set(day.toDateString(), { label: formatter.format(day), revenue: 0, orders: 0 });
  }

  for (const order of live) {
    const key = startOfDay(new Date(order.created_at)).toDateString();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(order.total);
    bucket.orders += 1;
  }

  return [...buckets.values()];
}

type VariantAlertRow = {
  id: string;
  name: string;
  stock: number;
  products: { id: string; name: string; low_stock_threshold: number } | { id: string; name: string; low_stock_threshold: number }[] | null;
};

export async function getAlerts(organizationId: string): Promise<AlertItem[]> {
  const supabase = await createClient();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(now - 48 * 60 * 60 * 1000).toISOString();

  const [{ data: variantRows }, { data: stuckOrders }, { data: shipmentRows }] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id, name, stock, products(id, name, low_stock_threshold)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("stock", { ascending: true })
      .limit(200),
    supabase
      .from("orders")
      .select("id, order_number, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "new")
      .lt("created_at", dayAgo)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("shipments")
      .select("id, order_id, consignment_id, status, last_event_at, created_at")
      .eq("organization_id", organizationId)
      .not("status", "in", "(delivered,returned,cancelled)")
      .limit(50),
  ]);

  const alerts: AlertItem[] = [];

  for (const row of (variantRows ?? []) as VariantAlertRow[]) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    if (!product) continue;
    const stock = Number(row.stock);
    if (stock === 0) {
      alerts.push({
        kind: "out_of_stock",
        title: `${product.name} · ${row.name}`,
        href: `/products/${product.id}`,
        count: 0,
        threshold: product.low_stock_threshold,
      });
    } else if (stock < product.low_stock_threshold) {
      alerts.push({
        kind: "low_stock",
        title: `${product.name} · ${row.name}`,
        href: `/products/${product.id}`,
        count: stock,
        threshold: product.low_stock_threshold,
      });
    }
  }

  for (const order of stuckOrders ?? []) {
    const hours = Math.floor((now - new Date(order.created_at as string).getTime()) / 3_600_000);
    alerts.push({
      kind: "stuck_order",
      title: `Order #${order.order_number}`,
      href: `/orders/${order.id}`,
      hours,
    });
  }

  for (const shipment of shipmentRows ?? []) {
    const last = (shipment.last_event_at as string | null) ?? (shipment.created_at as string);
    if (last > twoDaysAgo) continue;
    const hours = Math.floor((now - new Date(last).getTime()) / 3_600_000);
    alerts.push({
      kind: "stale_shipment",
      title: `Shipment ${shipment.consignment_id ?? ""}`.trim(),
      href: `/orders/${shipment.order_id}`,
      hours,
    });
  }

  return alerts;
}
