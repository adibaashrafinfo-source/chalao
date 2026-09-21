import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");

export const metadata: Metadata = { title: t.auth.login.metaTitle };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Set when someone arrives from an invitation link. The action checks it again
  // before redirecting, so passing it through here trusts nothing.
  const { next } = await searchParams;

  return (
    <AuthCard
      title={t.auth.login.title}
      description={t.auth.login.description}
      switchPrompt={t.auth.login.switchPrompt}
      switchLink={t.auth.login.switchLink}
      switchHref={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
    >
      <LoginForm auth={t.auth} validation={t.validation} next={next} />
    </AuthCard>
  );
}
