import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { demoHref } from "@/lib/marketing/site";
import { cn } from "@/lib/utils";

// Above the fold: CSS-only entrance so the hero is visible before JS hydrates (slow mobile ad traffic).
const enter = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both motion-reduce:animate-none";

export function Hero({ common, hero }: { common: Messages["common"]; hero: Messages["marketing"]["hero"] }) {
  return (
    // Pulled up under the sticky header so the glow has no hard edge at the top.
    <section className="relative -mt-16 overflow-hidden pt-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-brand-lime/25 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-20 lg:pb-24">
        <div className={cn(enter, "flex flex-col items-center gap-6")}>
          <span className="rounded-full border border-border-subtle bg-surface px-4 py-1.5 font-display text-xs font-semibold text-brand-dark sm:text-sm">
            {hero.eyebrow}
          </span>

          <h1 className="max-w-4xl text-balance text-3xl font-bold leading-[1.3] sm:text-5xl sm:leading-[1.25]">
            {hero.titleBefore}
            <span className="relative isolate whitespace-nowrap">
              <span
                aria-hidden="true"
                className="absolute inset-x-[-0.15em] bottom-[0.12em] -z-10 h-[0.45em] rounded-full bg-brand-lime"
              />
              {hero.titleHighlight}
            </span>
            {hero.titleAfter}
          </h1>

          <p className="max-w-2xl text-pretty text-base leading-relaxed text-text-secondary sm:text-xl" lang="en">
            {hero.subtitle}
          </p>
        </div>

        <div className={cn(enter, "mt-8 flex w-full flex-col items-center gap-4 delay-100")}>
          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                {common.startFree}
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="dark" asChild>
              <Link href={demoHref}>{common.bookDemo}</Link>
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-text-secondary">
            <Check className="size-4 text-success" aria-hidden="true" />
            {hero.note}
          </p>
        </div>

        <div className={cn(enter, "mt-14 w-full max-w-5xl text-left delay-200")}>
          <DashboardPreview label={hero.previewLabel} />
        </div>
      </div>
    </section>
  );
}
