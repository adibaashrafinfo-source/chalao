import { BarChart3, Boxes, ClipboardList, Truck, Users, Wallet, type LucideIcon } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import type { Messages } from "@/lib/i18n";
import { sectionIds } from "@/lib/marketing/site";

// Same order as messages.marketing.features.items
const icons: LucideIcon[] = [ClipboardList, Users, Boxes, Truck, Wallet, BarChart3];

export function Features({ features }: { features: Messages["marketing"]["features"] }) {
  return (
    <section id={sectionIds.features} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
      <SectionHeading eyebrow={features.eyebrow} title={features.title} description={features.description} />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {features.items.map((item, i) => {
          const Icon = icons[i] ?? ClipboardList;
          return (
            <Reveal key={item.title} delay={(i % 3) * 0.06} className="h-full">
              <article className="flex h-full flex-col gap-4 rounded-xl bg-surface p-6 shadow-xs sm:p-7">
                <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="text-pretty text-sm leading-relaxed text-text-secondary sm:text-base">{item.description}</p>
              </article>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
