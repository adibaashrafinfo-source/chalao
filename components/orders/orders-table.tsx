"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

import { bulkTransitionAction } from "@/app/(dashboard)/orders/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBDT, plural } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { orderSourceLabel, orderStatusLabel, orderStatusTone } from "@/lib/orders/status";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export type OrderListRow = {
  id: string;
  orderNumber: number;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  status: string;
  source: string;
  createdAt: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * The orders list, with the ability to move several at once.
 *
 * At two hundred orders a day, opening each one to press Confirm is the whole
 * morning. Each order still goes through the same state machine one at a time —
 * nothing is forced through in bulk — and any that cannot move are named.
 */
export function OrdersTable({ copy, orders }: { copy: Messages["orders"]; orders: OrderListRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const ids = orders.filter((order) => selected[order.id]).map((order) => order.id);
  const allTicked = orders.length > 0 && ids.length === orders.length;

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    if (value) for (const order of orders) next[order.id] = true;
    setSelected(next);
  };

  const run = async (status: string) => {
    setPending(status);
    setNotice(null);

    const result = await bulkTransitionAction(ids, status);

    setPending(null);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    // Say what moved and, just as plainly, what did not.
    const parts = [plural(copy.bulk.moved, result.moved ?? 0)];
    if (result.failed && result.failed.length > 0) {
      parts.push(`${plural(copy.bulk.skipped, result.failed.length)}: ${result.failed.join(", ")}`);
    }

    setNotice({ tone: result.failed && result.failed.length > 0 ? "error" : "info", text: parts.join(" · ") });
    setSelected({});
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      {notice ? <FormNotice tone={notice.tone}>{notice.text}</FormNotice> : null}

      {ids.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-dark px-4 py-3">
          <span className="flex-1 text-sm text-white">{plural(copy.bulk.selected, ids.length)}</span>
          {(["confirmed", "processing", "ready_to_ship"] as const).map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={status === "confirmed" ? "default" : "outline"}
              disabled={pending !== null}
              onClick={() => run(status)}
            >
              {pending === status ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {(copy.statusActions as Record<string, string>)[status] ?? status}
            </Button>
          ))}
          <Button type="button" size="sm" variant="ghost" className="text-white" onClick={() => setAll(false)}>
            {copy.bulk.clear}
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl bg-surface shadow-xs">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
              <th className="px-5 py-4">
                <input
                  type="checkbox"
                  checked={allTicked}
                  aria-label={copy.bulk.selectAll}
                  onChange={(event) => setAll(event.target.checked)}
                  className="size-4 accent-brand-dark"
                />
              </th>
              <th className="px-5 py-4 font-medium">{copy.columns.order}</th>
              <th className="px-5 py-4 font-medium">{copy.columns.customer}</th>
              <th className="px-5 py-4 font-medium">{copy.columns.phone}</th>
              <th className="px-5 py-4 text-right font-medium">{copy.columns.total}</th>
              <th className="px-5 py-4 font-medium">{copy.columns.status}</th>
              <th className="px-5 py-4 font-medium">{copy.columns.source}</th>
              <th className="px-5 py-4 font-medium">{copy.columns.created}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr
                key={order.id}
                className={cn(
                  "border-b border-border-subtle last:border-b-0 hover:bg-surface-alt",
                  selected[order.id] && "bg-surface-alt",
                )}
              >
                <td className="px-5 py-4">
                  <input
                    type="checkbox"
                    checked={Boolean(selected[order.id])}
                    aria-label={`#${order.orderNumber}`}
                    onChange={(event) => setSelected({ ...selected, [order.id]: event.target.checked })}
                    className="size-4 accent-brand-dark"
                  />
                </td>
                <td className="px-5 py-4">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium tabular-nums text-brand-dark hover:underline"
                  >
                    #{order.orderNumber}
                  </Link>
                </td>
                <td className="px-5 py-4 text-text-primary">{order.customerName ?? "—"}</td>
                <td className="px-5 py-4 tabular-nums text-text-secondary">
                  {order.customerPhone ? formatPhone(order.customerPhone) : "—"}
                </td>
                <td className="px-5 py-4 text-right tabular-nums">{formatBDT(order.total)}</td>
                <td className="px-5 py-4">
                  <Badge variant={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
                </td>
                <td className="px-5 py-4 text-text-secondary">{orderSourceLabel(order.source)}</td>
                <td className="px-5 py-4 text-text-secondary">
                  {dateFormatter.format(new Date(order.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
