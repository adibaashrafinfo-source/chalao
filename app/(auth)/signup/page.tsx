import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");

export const metadata: Metadata = { title: t.auth.signup.metaTitle };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Set when someone arrives from an invitation link. The action checks it again
  // before redirecting, so passing it through here trusts nothing.
  const { next } = await searchParams;

  return (
    <AuthCard
      title={t.auth.signup.title}
      description={t.auth.signup.description}
      switchPrompt={t.auth.signup.switchPrompt}
      switchLink={t.auth.signup.switchLink}
      switchHref={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
    >
      <SignupForm auth={t.auth} validation={t.validation} next={next} />
    </AuthCard>
  );
}
