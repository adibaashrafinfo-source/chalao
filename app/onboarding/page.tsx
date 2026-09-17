import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.onboarding.metaTitle };

// Depends on the signed-in user; must not be prerendered at build time.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Already onboarded — don't let them create a second organization by accident.
  const membership = await getMembership();
  if (membership) redirect("/dashboard");

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-app">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 size-[420px] rounded-full bg-brand-lime/30 blur-3xl"
      />
      <header className="relative mx-auto flex w-full max-w-6xl items-center px-4 py-5 sm:px-6">
        <Link href="/" aria-label={t.common.appName}>
          <Logo />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-4 sm:px-6">
        <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg sm:p-10">
          <div className="mb-8 flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{t.onboarding.title}</h1>
            <p className="text-sm text-text-secondary">{t.onboarding.description}</p>
          </div>
          <OnboardingForm onboarding={t.onboarding} />
        </div>
      </main>
    </div>
  );
}
