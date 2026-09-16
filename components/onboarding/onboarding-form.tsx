"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { createOrganizationAction } from "@/app/onboarding/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { businessTypeValues, onboardingSchema } from "@/lib/validations/onboarding";

type Values = z.infer<typeof onboardingSchema>;

export function OnboardingForm({ onboarding }: { onboarding: Messages["onboarding"] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { organizationName: "", businessType: "fashion" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createOrganizationAction(values);
    if (result?.error) setFormError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="organizationName">{onboarding.orgName}</Label>
        <Input
          id="organizationName"
          className="h-11"
          placeholder={onboarding.orgNamePlaceholder}
          aria-invalid={errors.organizationName ? true : undefined}
          {...register("organizationName")}
        />
        {errors.organizationName && <p className="text-xs text-danger">{errors.organizationName.message}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="businessType">{onboarding.businessType}</Label>
        <select
          id="businessType"
          className="h-11 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
          {...register("businessType")}
        >
          {businessTypeValues.map((value) => (
            <option key={value} value={value}>
              {onboarding.businessTypes[value]}
            </option>
          ))}
        </select>
      </div>

      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
        {onboarding.submit}
      </Button>
    </form>
  );
}
