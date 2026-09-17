import Link from "next/link";
import { Building2, Check } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { demoHref, sectionIds } from "@/lib/marketing/site";
import type { PublicPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

/** Prices, names and limits come from the database so an admin can change them. */
export function Pricing({
  pricing,
  plans,
}: {
  pricing: Messages["marketing"]["pricing"];
  plans: PublicPlan[];
}) {
  const enterprise = pricing.plans.enterprise;
  // The enterprise entry has a different shape, so the lookup is deliberately loose:
  // a plan added in the database simply falls back to the shared copy below.
  const planCopy = pricing.plans as unknown as Record<string, { cta: string; extras: string[] } | undefined>;

  const featureList = (plan: PublicPlan): string[] => {
    const orders =
      plan.order_limit === null
        ? pricing.limits.ordersUnlimited
        : pricing.limits.orders.replace("{count}", formatCount(plan.order_limit));

    const users =
      plan.user_limit === null
        ? pricing.limits.usersUnlimited
        : plan.user_limit === 1
          ? pricing.limits.oneUser
          : pricing.limits.users.replace("{count}", formatCount(plan.user_limit));

    return [orders, users, ...(planCopy[plan.code]?.extras ?? [])];
  };

  return (
    <section id={sectionIds.pricing} className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24">
      <SectionHeading eyebrow={pricing.eyebrow} title={pricing.title} description={pricing.description} />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan, i) => (
          <Reveal key={plan.code} delay={i * 0.06} className="h-full">
            <article
              className={cn(
                "relative flex h-full flex-col gap-6 rounded-xl bg-surface p-6 shadow-xs",
                plan.is_featured ? "ring-2 ring-brand-lime" : "",
              )}
            >
              {plan.is_featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-brand-lime px-3 py-1 font-display text-xs font-semibold text-brand-dark">
                  {pricing.mostPopular}
                </span>
              )}

              <div className="flex flex-col gap-1.5">
                <h3 className="text-xl font-semibold">{plan.name}</h3>
                {plan.tagline && <p className="text-sm text-text-secondary">{plan.tagline}</p>}
              </div>

              <p className="flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold tabular-nums text-brand-dark">
                  {formatBDT(plan.monthly_price)}
                </span>
                <span className="text-sm text-text-secondary">{pricing.perMonth}</span>
              </p>

              <Button variant={plan.is_featured ? "default" : "outline"} className="w-full" asChild>
                <Link href={`/signup?plan=${plan.code}`}>{planCopy[plan.code]?.cta ?? pricing.plans.free.cta}</Link>
              </Button>

              <ul className="flex flex-col gap-3 border-t border-border-subtle pt-6">
                {featureList(plan).map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-text-primary">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-lime-tint">
                      <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1} className="mt-4 lg:mt-6">
        <article className="flex flex-col gap-5 rounded-xl bg-surface p-6 shadow-xs sm:flex-row sm:items-center sm:gap-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <h3 className="text-xl font-semibold">
              {enterprise.name} <span className="font-medium text-text-secondary">· {enterprise.price}</span>
            </h3>
            <p className="text-pretty text-sm leading-relaxed text-text-secondary">{enterprise.tagline}</p>
          </div>
          <Button variant="dark" className="w-full sm:w-auto" asChild>
            <Link href={demoHref}>{enterprise.cta}</Link>
          </Button>
        </article>
      </Reveal>
    </section>
  );
}
