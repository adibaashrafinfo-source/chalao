import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");

export const metadata: Metadata = { title: t.auth.login.metaTitle };

export default function LoginPage() {
  return (
    <AuthCard
      title={t.auth.login.title}
      description={t.auth.login.description}
      switchPrompt={t.auth.login.switchPrompt}
      switchLink={t.auth.login.switchLink}
      switchHref="/signup"
    >
      <LoginForm auth={t.auth} validation={t.validation} />
    </AuthCard>
  );
}
