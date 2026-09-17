import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import type { OrderGate } from "@/lib/subscription";

/**
 * Explains a blocked or nearly blocked plan. Renders nothing when there is nothing
 * to say, so screens can drop it in without a condition of their own.
 */
export function LimitNotice({
  limits,
  gate,
  periodEnd,
  graceDays = 3,
  variant = "banner",
}: {
  limits: Messages["limits"];
  gate: OrderGate;
  periodEnd?: string | null;
  graceDays?: number;
  variant?: "banner" | "card";
}) {
  const blocked = !gate.allowed && gate.reason;

  if (blocked) {
    const title = limits.blockedTitle[gate.reason as keyof typeof limits.blockedTitle];
    const body = limits.blockedBody[gate.reason as keyof typeof limits.blockedBody]
      .replace("{limit}", formatCount(gate.order_limit ?? 0))
      .replace("{used}", formatCount(gate.orders_this_month));

    if (variant === "card") {
      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-16 text-center shadow-xs">
          <span className="flex size-12 items-center justify-center rounded-full bg-danger-tint text-danger">
            <CircleAlert className="size-5" aria-hidden="true" />
          </span>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="max-w-md text-sm leading-relaxed text-text-secondary">{body}</p>
          <Button asChild className="mt-2">
            <Link href="/settings/billing">{limits.goToBilling}</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-tint px-4 py-3 text-sm text-danger">
        <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{title}.</span> {body}
        </span>
        <Button size="sm" variant="outline" asChild>
          <Link href="/settings/billing">{limits.goToBilling}</Link>
        </Button>
      </div>
    );
  }

  // Still working, but worth a word: in grace, or close to the monthly allowance.
  const graceUntil =
    gate.state === "grace" && periodEnd
      ? new Date(new Date(periodEnd).getTime() + graceDays * 86_400_000)
      : null;

  const left = gate.order_limit === null ? null : Math.max(0, gate.order_limit - gate.orders_this_month);
  const nearLimit = left !== null && left > 0 && left <= 10;

  if (!graceUntil && !nearLimit) return null;

  const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning-tint px-4 py-3 text-sm text-warning">
      <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        {graceUntil
          ? limits.graceWarning.replace("{date}", dateFormatter.format(graceUntil))
          : limits.nearLimit
              .replace("{left}", formatCount(left ?? 0))
              .replace("{limit}", formatCount(gate.order_limit ?? 0))}
      </span>
      <Button size="sm" variant="outline" asChild>
        <Link href="/settings/billing">{limits.goToBilling}</Link>
      </Button>
    </div>
  );
}
