"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateOrganizationAction } from "@/app/(dashboard)/settings/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { businessTypeValues, type BusinessType } from "@/lib/validations/onboarding";

export function OrganizationForm({
  copy,
  businessTypeLabels,
  defaults,
  canEdit,
}: {
  copy: Messages["settings"]["organization"];
  businessTypeLabels: Messages["onboarding"]["businessTypes"];
  defaults: { name: string; businessType: BusinessType };
  canEdit: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaults.name);
  const [businessType, setBusinessType] = useState<BusinessType>(defaults.businessType);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateOrganizationAction({ name, businessType });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">{copy.name}</Label>
        <Input
          id="org-name"
          value={name}
          disabled={!canEdit}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-type">{copy.businessType}</Label>
        <select
          id="org-type"
          value={businessType}
          disabled={!canEdit}
          onChange={(event) => setBusinessType(event.target.value as BusinessType)}
          className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30 disabled:opacity-60"
        >
          {businessTypeValues.map((value) => (
            <option key={value} value={value}>
              {businessTypeLabels[value]}
            </option>
          ))}
        </select>
      </div>

      {!canEdit && <p className="text-sm text-text-secondary">{copy.ownerOnly}</p>}
      {error && <FormNotice tone="error">{error}</FormNotice>}

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {copy.save}
          </Button>
          {saved && <span className="text-sm text-success">{copy.saved}</span>}
        </div>
      )}
    </form>
  );
}
