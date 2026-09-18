import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { legal } from "@/lib/marketing/legal";

/**
 * Shell for the privacy policy, terms and data deletion pages.
 *
 * These are written in English rather than Bangla, unlike the rest of the
 * marketing site: Meta's app reviewers read them during app review, and a
 * lawyer will read them before launch.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-14 sm:px-6" lang="en">
      <div className="flex flex-col gap-3">
        <Link
          href="/"
          className="flex w-fit items-center gap-1.5 text-sm text-text-secondary hover:text-brand-dark"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>
        <h1 className="font-display text-3xl font-bold text-brand-dark sm:text-4xl">{title}</h1>
        <p className="text-base leading-relaxed text-text-secondary">{intro}</p>
        <p className="text-sm text-text-muted">Last updated: {legal.lastUpdated}</p>
      </div>

      <div className="flex flex-col gap-8">{children}</div>

      <section className="flex flex-col gap-2 rounded-xl bg-surface p-5 shadow-xs">
        <h2 className="font-display text-base font-semibold text-brand-dark">Contact</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          {legal.businessName}
          <br />
          {legal.address}
          <br />
          {legal.contactEmail}
        </p>
      </section>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold text-brand-dark">{heading}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-text-secondary [&_a]:text-brand-dark [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-brand-dark [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2">
        {children}
      </div>
    </section>
  );
}
