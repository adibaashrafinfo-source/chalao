import { Badge } from "@/components/ui/badge";
import type { Messages } from "@/lib/i18n";
import { riskTone, type CustomerRisk } from "@/lib/risk/types";

/**
 * The customer's delivery record, in one line.
 *
 * It always shows the counts it was worked out from. A seller who knows the
 * customer personally should be able to see the score is wrong, rather than
 * being told a verdict with nothing behind it.
 */
export function RiskBadge({
  risk,
  messages,
  showCounts = true,
}: {
  risk: CustomerRisk | null;
  messages: Messages["risk"];
  showCounts?: boolean;
}) {
  if (!risk) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={riskTone[risk.level]}>{messages.levels[risk.level]}</Badge>

      {showCounts ? (
        risk.totalOrders === 0 ? (
          <span className="text-xs text-text-muted">{messages.noHistory}</span>
        ) : (
          <span className="text-xs text-text-secondary">
            {risk.delivered} {messages.delivered} · {risk.returned} {messages.returned} · {risk.cancelled}{" "}
            {messages.cancelled}
          </span>
        )
      ) : null}
    </div>
  );
}

/** Shown where a parcel is about to be sent out on cash on delivery. */
export function RiskWarning({ risk, messages }: { risk: CustomerRisk | null; messages: Messages["risk"] }) {
  if (risk?.level !== "high") return null;

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-danger-tint px-4 py-3">
      <p className="font-display text-sm font-semibold text-danger">{messages.warning.title}</p>
      <p className="text-xs leading-relaxed text-danger">
        {risk.returned} {messages.returned} · {risk.returnRate}% {messages.returnRate}
      </p>
      <p className="text-xs leading-relaxed text-text-secondary">{messages.warning.body}</p>
    </div>
  );
}
