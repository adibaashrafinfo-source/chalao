"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { signUpAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { makeSignupSchema, type SignupValues } from "@/lib/validations/auth";

export function SignupForm({
  auth,
  validation,
  next,
}: {
  auth: Messages["auth"];
  validation: Messages["validation"];
  /** An invitation link to return to after signing up. */
  next?: string;
}) {
  const schema = useMemo(() => makeSignupSchema(validation), [validation]);
  const [result, setResult] = useState<{ error?: string; notice?: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  // On success the server action redirects to /onboarding, so nothing comes back here.
  const onSubmit = handleSubmit(async (values) => {
    setResult(null);
    setResult((await signUpAction(values, next)) ?? null);
  });

  return (
    // method="post" so a submit before JavaScript loads never puts the password in the URL.
    <form onSubmit={onSubmit} method="post" noValidate className="flex flex-col gap-5">
      <FormField
        label={auth.fields.fullName}
        autoComplete="name"
        registration={register("fullName")}
        error={errors.fullName}
      />
      <FormField
        label={auth.fields.email}
        type="email"
        autoComplete="email"
        registration={register("email")}
        error={errors.email}
      />
      <FormField
        label={auth.fields.password}
        type="password"
        autoComplete="new-password"
        hint={auth.fields.passwordHint}
        registration={register("password")}
        error={errors.password}
        passwordToggleLabels={{ show: auth.fields.showPassword, hide: auth.fields.hidePassword }}
      />
      {result?.error && <FormNotice tone="error">{result.error}</FormNotice>}
      {result?.notice && <FormNotice>{result.notice}</FormNotice>}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
        {auth.signup.submit}
      </Button>
    </form>
  );
}
