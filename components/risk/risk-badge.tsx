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
