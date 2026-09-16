"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updateSiteSettingsAction } from "@/app/(dashboard)/settings/actions";
import { FormNotice } from "@/components/auth/login-form";
import { SocialLinks } from "@/components/marketing/social-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import type { SiteSettings, SocialKey } from "@/lib/site-settings";

const fields: { key: SocialKey; placeholder: string }[] = [
  { key: "facebook", placeholder: "https://facebook.com/yourpage" },
  { key: "instagram", placeholder: "https://instagram.com/yourpage" },
  { key: "youtube", placeholder: "https://youtube.com/@yourchannel" },
  { key: "tiktok", placeholder: "https://tiktok.com/@yourpage" },
  { key: "linkedin", placeholder: "https://linkedin.com/company/yourpage" },
  { key: "whatsapp", placeholder: "https://wa.me/8801XXXXXXXXX" },
];

export function SiteSettingsForm({
  settings: initial,
  copy,
}: {
  settings: SiteSettings;
  copy: Messages["settings"]["site"];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<SocialKey, string>>({
    facebook: initial.facebook ?? "",
    instagram: initial.instagram ?? "",
    youtube: initial.youtube ?? "",
    tiktok: initial.tiktok ?? "",
    linkedin: initial.linkedin ?? "",
    whatsapp: initial.whatsapp ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  // What the footer will show, live as you type.
  const preview: SiteSettings = {
    facebook: values.facebook || null,
    instagram: values.instagram || null,
    youtube: values.youtube || null,
    tiktok: values.tiktok || null,
    linkedin: values.linkedin || null,
    whatsapp: values.whatsapp || null,
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateSiteSettingsAction(values);

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
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.socialTitle}</h2>
        <p className="text-sm text-text-secondary">{copy.socialBody}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <Label htmlFor={`social-${field.key}`}>{copy[field.key]}</Label>
            <Input
              id={`social-${field.key}`}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.key]: event.target.value }))
              }
            />
            {field.key === "whatsapp" && <p className="text-xs text-text-muted">{copy.whatsappHint}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-lg bg-brand-dark p-4">
        <p className="font-display text-sm font-semibold text-white">{copy.preview}</p>
        <SocialLinks settings={preview} />
      </div>

      {error && <FormNotice tone="error">{error}</FormNotice>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {copy.save}
        </Button>
        {saved && <span className="text-sm text-success">{copy.saved}</span>}
      </div>
    </form>
  );
}
