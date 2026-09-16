"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatBDT, formatCount } from "@/lib/format";
import type { ChartPoint } from "@/lib/dashboard/metrics";
import type { Messages } from "@/lib/i18n";

// Two-tone, per the design system: dark green = revenue, lime = order count.
export function RevenueChart({
  chart,
  data,
}: {
  chart: Messages["dashboard"]["home"]["chart"];
  data: ChartPoint[];
}) {
  const hasData = data.some((point) => point.revenue > 0 || point.orders > 0);

  if (!hasData) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg bg-surface-alt text-sm text-text-secondary">
        {chart.empty}
      </div>
    );
  }

  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            yAxisId="revenue"
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)}k` : String(value))}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-surface-alt)" }}
            // Recharts types the custom renderer loosely; we only read what we pass in.
            content={((props: TooltipRenderProps) => <ChartTooltip chart={chart} {...props} />) as never}
          />
          <Bar yAxisId="revenue" dataKey="revenue" fill="var(--brand-dark)" radius={[999, 999, 999, 999]} maxBarSize={14} />
          <Bar yAxisId="orders" dataKey="orders" fill="var(--brand-lime)" radius={[999, 999, 999, 999]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipRenderProps = {
  active?: boolean;
  label?: string;
  payload?: { payload?: ChartPoint }[];
};

function ChartTooltip({
  chart,
  active,
  payload,
  label,
}: TooltipRenderProps & { chart: Messages["dashboard"]["home"]["chart"] }) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-display font-semibold text-brand-dark">{label}</p>
      <p className="flex items-center gap-1.5 text-text-secondary">
        <span className="size-2 rounded-full bg-brand-dark" />
        {chart.revenue}: <span className="tabular-nums text-text-primary">{formatBDT(point.revenue)}</span>
      </p>
      <p className="flex items-center gap-1.5 text-text-secondary">
        <span className="size-2 rounded-full bg-brand-lime" />
        {chart.orders}: <span className="tabular-nums text-text-primary">{formatCount(point.orders)}</span>
      </p>
    </div>
  );
}
