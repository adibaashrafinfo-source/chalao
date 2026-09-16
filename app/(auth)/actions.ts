"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMessages } from "@/lib/i18n";
import { makeLoginSchema, makeSignupSchema } from "@/lib/validations/auth";

export type AuthResult = { error?: string; notice?: string };

const t = getMessages("en");

export async function signInAction(values: unknown): Promise<AuthResult> {
  const parsed = makeLoginSchema(t.validation).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.auth.genericError };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUpAction(values: unknown): Promise<AuthResult> {
  const parsed = makeSignupSchema(t.validation).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.auth.genericError };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/confirm`,
    },
  });

  if (error) return { error: error.message };

  // No session means email confirmation is switched on for this project.
  if (!data.session) return { notice: t.auth.checkEmail };

  redirect("/onboarding");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
