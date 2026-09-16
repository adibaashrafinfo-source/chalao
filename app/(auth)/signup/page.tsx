import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { getMessages } from "@/lib/i18n";

const t = getMessages("en");

export const metadata: Metadata = { title: t.auth.signup.metaTitle };

export default function SignupPage() {
  return (
    <AuthCard
      title={t.auth.signup.title}
      description={t.auth.signup.description}
      switchPrompt={t.auth.signup.switchPrompt}
      switchLink={t.auth.signup.switchLink}
      switchHref="/login"
    >
      <SignupForm auth={t.auth} validation={t.validation} />
    </AuthCard>
  );
}
