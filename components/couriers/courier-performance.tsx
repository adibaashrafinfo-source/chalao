import { Badge } from "@/components/ui/badge";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type CourierStats = {
  label: string;
  provider: string;
  sent: number;
  delivered: number;
  returned: number;
  inFlight: number;
  returnRate: number;
  avgDays: number | null;
  codCollected: number;
  charges: number;
};

/**
 * How each courier actually performed. A rate card says what a parcel costs;
 * this says what it cost after the ones that came back.
 */
export function CourierPerformance({
  copy,
  rows,
}: {
  copy: Messages["couriers"]["performance"];
  rows: CourierStats[];
}) {
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.title}</h2>
        <p className="text-sm text-text-secondary">{copy.subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-text-muted">
              <th className="py-3 pr-4 font-medium">{copy.courier}</th>
              <th className="py-3 pr-4 text-right font-medium">{copy.sent}</th>
              <th className="py-3 pr-4 text-right font-medium">{copy.delivered}</th>
              <th className="py-3 pr-4 text-right font-medium">{copy.returned}</th>
              <th className="py-3 pr-4 text-right font-medium">{copy.returnRate}</th>
              <th className="py-3 pr-4 text-right font-medium">{copy.avgDays}</th>
              <th className="py-3 text-right font-medium">{copy.charges}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.label}-${row.provider}`} className="border-b border-border-subtle last:border-b-0">
                <td className="py-3 pr-4">
                  <span className="font-medium text-brand-dark">{row.label}</span>
                  {row.inFlight > 0 ? (
                    <span className="block text-xs text-text-muted">
                      {copy.inFlight.replace("{count}", formatCount(row.inFlight))}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCount(row.sent)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCount(row.delivered)}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCount(row.returned)}</td>
                <td className="py-3 pr-4 text-right">
                  {/* The number that decides which courier to use next. */}
                  <Badge variant={row.returnRate >= 20 ? "danger" : row.returnRate >= 10 ? "warning" : "success"}>
                    {row.returnRate}%
                  </Badge>
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">
                  {row.avgDays === null ? "—" : copy.days.replace("{days}", String(row.avgDays))}
                </td>
                <td className="py-3 text-right tabular-nums text-text-secondary">{formatBDT(row.charges)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-text-muted">{copy.note}</p>
    </section>
  );
}
