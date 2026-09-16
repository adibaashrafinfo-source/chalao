import { TrendingDown, TrendingUp } from "lucide-react";

import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One card per number. `hero` gives the single most important figure the bright
 * lime treatment — at most one per view (Brief §3.4).
 */
export function StatCard({
  label,
  hint,
  value,
  today,
  yesterday,
  stats,
  hero = false,
}: {
  label: string;
  hint: string;
  value: string;
  today?: number;
  yesterday?: number;
  stats: Messages["dashboard"]["home"]["stats"];
  hero?: boolean;
}) {
  // A percentage against zero is meaningless, so only compare when yesterday had something.
  const comparable = today !== undefined && yesterday !== undefined && yesterday > 0;
  const delta = comparable ? today - yesterday : 0;
  const up = delta >= 0;
  const deltaText = comparable ? `${up ? "+" : "−"}${Math.abs(Math.round((delta / yesterday) * 100))}%` : null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl p-5 shadow-xs",
        hero ? "bg-brand-lime" : "bg-surface",
      )}
    >
      <p className={cn("text-xs", hero ? "text-brand-dark/70" : "text-text-secondary")}>{label}</p>
      <p className="font-display text-2xl font-bold tabular-nums text-brand-dark sm:text-3xl">{value}</p>

      {deltaText ? (
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            hero ? "text-brand-dark/80" : up ? "text-success" : "text-danger",
          )}
        >
          {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
          {deltaText}
          <span className={cn("font-normal", hero ? "text-brand-dark/60" : "text-text-muted")}>
            {stats.vsYesterday}
          </span>
        </p>
      ) : (
        <p className={cn("text-xs", hero ? "text-brand-dark/60" : "text-text-muted")}>{hint}</p>
      )}
    </div>
  );
}
