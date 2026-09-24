import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";

import { formatBDT, plural } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type Brief = {
  toConfirm: number;
  stuckParcels: number;
  lowStock: number;
  codOutstanding: number;
  codParcels: number;
  returnsToRecord: number;
  unreadMessages: number;
};

/**
 * The one-line version of the day, above everything else.
 *
 * The alert list below this says which product is low and which order has sat
 * too long. Nobody reads twenty rows before opening the shop; they read a
 * sentence and decide what to do first. Only what needs doing appears — an
 * empty brief says so rather than showing zeroes.
 */
export function MorningBrief({ copy, brief }: { copy: Messages["dashboard"]["home"]["brief"]; brief: Brief }) {
  const lines: { text: string; href: string }[] = [];

  if (brief.toConfirm > 0) {
    lines.push({
      text: plural(copy.toConfirm, brief.toConfirm),
      href: "/orders?status=new",
    });
  }
  if (brief.unreadMessages > 0) {
    lines.push({
      text: plural(copy.unreadMessages, brief.unreadMessages),
      href: "/inbox",
    });
  }
  if (brief.stuckParcels > 0) {
    lines.push({
      text: plural(copy.stuckParcels, brief.stuckParcels),
      href: "/orders?status=shipped",
    });
  }
  if (brief.returnsToRecord > 0) {
    lines.push({
      text: plural(copy.returnsToRecord, brief.returnsToRecord),
      href: "/returns",
    });
  }
  if (brief.codOutstanding > 0) {
    lines.push({
      text: plural(copy.codOutstanding.replace("{amount}", formatBDT(brief.codOutstanding)), brief.codParcels),
      href: "/cod",
    });
  }
  if (brief.lowStock > 0) {
    lines.push({
      text: plural(copy.lowStock, brief.lowStock),
      href: "/inventory",
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-brand-dark p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-sm font-semibold tracking-wide text-white/70">{copy.title}</h2>

      {lines.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-white">
          <CircleCheck className="size-4 shrink-0 text-brand-lime" aria-hidden="true" />
          {copy.allClear}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li key={line.href}>
              <Link
                href={line.href}
                className="group flex items-center gap-2 text-sm text-white hover:text-brand-lime"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-brand-lime" aria-hidden="true" />
                <span className="flex-1">{line.text}</span>
                <ArrowRight
                  className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-brand-lime"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
