"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Languages } from "lucide-react";

import { setLanguageAction } from "@/app/(dashboard)/settings/actions";
import { FormNotice } from "@/components/auth/login-form";
import type { Messages } from "@/lib/i18n";

/**
 * Switching language reloads every screen, because the dictionary is read per
 * request. There is no Save button on purpose: choosing is the action.
 */
export function LanguagePicker({
  copy,
  current,
}: {
  copy: Messages["settings"]["language"];
  current: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const choose = async (language: string) => {
    if (language === current) return;
    setPending(true);
    setError(null);
    const result = await setLanguageAction(language);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-brand-dark">
          <Languages className="size-4" aria-hidden="true" />
          {copy.title}
        </h2>
        <p className="text-sm text-text-secondary">{copy.hint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["en", "bn"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={pending}
            onClick={() => choose(value)}
            className={`rounded-full px-4 py-2 font-display text-sm font-semibold transition-colors ${
              value === current
                ? "bg-brand-dark text-white"
                : "bg-surface-alt text-text-secondary hover:text-brand-dark"
            }`}
          >
            {copy[value]}
          </button>
        ))}
      </div>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}
    </section>
  );
}
