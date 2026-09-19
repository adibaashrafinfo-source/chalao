import { CheckCircle2, TriangleAlert } from "lucide-react";

import type { Messages } from "@/lib/i18n";
import type { ConfirmationDecision } from "@/lib/orders/confirmation-types";

/**
 * What the software decided about this order, and why — shown directly above the
 * confirm button, because that is the moment the seller decides.
 *
 * The reasons are always listed. A rule that cannot be questioned is a rule the
 * seller will stop trusting the first time it is wrong.
 */
export function ConfirmationPanel({
  copy,
  riskCopy,
  decision,
}: {
  copy: Messages["confirmation"];
  riskCopy: Messages["risk"];
  decision: ConfirmationDecision | null;
}) {
  // Only an order still waiting has a decision worth showing.
  if (!decision || decision.status !== "new") return null;

  const urgent = decision.advice.includes("take_advance");
  const hasAdvice = decision.advice.length > 0;
  // "Automatic confirmation is off" on every order would be noise, so the
  // reasons are only worth listing to a seller who switched it on.
  const blockers = decision.blockers.filter((code) => code !== "auto_off");
  const autoOff = decision.blockers.includes("auto_off");

  if (!hasAdvice && (autoOff || blockers.length === 0)) return null;

  return (
    <section
      className={`flex flex-col gap-3 rounded-xl p-5 shadow-xs sm:p-6 ${
        urgent ? "bg-danger-tint" : hasAdvice ? "bg-warning-tint" : "bg-surface"
      }`}
    >
      <h2
        className={`flex items-center gap-2 font-display text-base font-semibold ${
          urgent ? "text-danger" : "text-brand-dark"
        }`}
      >
        {hasAdvice ? (
          <TriangleAlert className="size-4" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        )}
        {copy.decision.title}
      </h2>

      {hasAdvice ? (
        <div className="flex flex-col gap-2">
          <p className={`text-xs font-medium ${urgent ? "text-danger" : "text-text-secondary"}`}>
            {copy.decision.adviceTitle}
          </p>
          <ul className="flex flex-col gap-1.5">
            {decision.advice.map((code) => (
              <li key={code} className={`text-sm leading-relaxed ${urgent ? "text-danger" : "text-text-primary"}`}>
                {copy.advice[code]}
              </li>
            ))}
          </ul>

          {/* The numbers behind the advice, so it can be judged rather than obeyed. */}
          {decision.risk && decision.risk.settled > 0 && decision.riskLevel !== "good" ? (
            <p className={`text-xs ${urgent ? "text-danger" : "text-text-secondary"}`}>
              {decision.risk.returned} {riskCopy.returned} · {decision.risk.returnRate}% {riskCopy.returnRate}
            </p>
          ) : null}
        </div>
      ) : null}

      {blockers.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <p className="text-xs font-medium text-text-secondary">{copy.decision.whyTitle}</p>
          <ul className="flex flex-col gap-1.5">
            {blockers.map((code) => (
              <li key={code} className="text-sm leading-relaxed text-text-secondary">
                {copy.blockers[code]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
