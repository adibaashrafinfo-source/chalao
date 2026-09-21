"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Info, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { signInAction } from "@/app/(auth)/actions";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { makeLoginSchema, type LoginValues } from "@/lib/validations/auth";

export function LoginForm({
  auth,
  validation,
  next,
}: {
  auth: Messages["auth"];
  validation: Messages["validation"];
  /** An invitation link to return to after signing in. */
  next?: string;
}) {
  const schema = useMemo(() => makeLoginSchema(validation), [validation]);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  // On success the server action redirects, so nothing comes back here.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signInAction(values, next);
    if (result?.error) setFormError(result.error);
  });

  return (
    // method="post": if someone submits before the page's JavaScript has loaded,
    // the browser falls back to a plain form submit. Without this it would be a
    // GET, putting the password in the URL, the history and the server logs.
    <form onSubmit={onSubmit} method="post" noValidate className="flex flex-col gap-5">
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
        autoComplete="current-password"
        registration={register("password")}
        error={errors.password}
        passwordToggleLabels={{ show: auth.fields.showPassword, hide: auth.fields.hidePassword }}
      />
      {formError && <FormNotice tone="error">{formError}</FormNotice>}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
        {auth.login.submit}
      </Button>
    </form>
  );
}

export function FormNotice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" }) {
  const isError = tone === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md px-4 py-3 text-sm",
        isError ? "bg-danger-tint text-danger" : "bg-surface-alt text-text-primary",
      )}
    >
      {isError ? (
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
      )}
      {children}
    </p>
  );
}
