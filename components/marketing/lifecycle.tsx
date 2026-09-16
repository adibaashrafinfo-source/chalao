import {
  Banknote,
  Boxes,
  CircleCheck,
  MessageCircle,
  PackageCheck,
  ShoppingBag,
  TrendingUp,
  Truck,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Same order as messages.marketing.lifecycle.steps
const icons: LucideIcon[] = [MessageCircle, ShoppingBag, CircleCheck, Boxes, Truck, PackageCheck, Banknote, TrendingUp];

export function Lifecycle({ lifecycle }: { lifecycle: Messages["marketing"]["lifecycle"] }) {
  const lastIndex = lifecycle.steps.length - 1;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <SectionHeading eyebrow={lifecycle.eyebrow} title={lifecycle.title} description={lifecycle.description} />

      <Reveal delay={0.1} className="mt-12">
        <ol className="relative grid grid-cols-2 gap-x-4 gap-y-8 rounded-2xl bg-surface p-6 shadow-xs sm:grid-cols-4 sm:p-10 lg:grid-cols-8 lg:gap-2">
          {/* Connector line, desktop only */}
          <span
            aria-hidden="true"
            className="absolute left-[calc(6.25%+2.5rem)] right-[calc(6.25%+2.5rem)] top-[4.25rem] hidden border-t-2 border-dashed border-border-subtle lg:block"
          />
          {lifecycle.steps.map((step, i) => {
            const Icon = icons[i] ?? CircleCheck;
            const isLast = i === lastIndex;
            return (
              <li key={step.label} className="relative flex flex-col items-center gap-3 text-center">
                <span
                  className={cn(
                    "flex size-14 items-center justify-center rounded-full ring-8 ring-surface",
                    isLast ? "bg-brand-lime text-brand-dark" : "bg-surface-alt text-brand-dark",
                  )}
                >
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-display text-sm font-semibold text-brand-dark">{step.label}</span>
                  <span className="text-xs text-text-secondary">{step.caption}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Reveal>
    </section>
  );
}
