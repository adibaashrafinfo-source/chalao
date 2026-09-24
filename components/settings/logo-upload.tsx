"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";

import { saveLogoAction } from "@/app/(dashboard)/settings/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 1_000_000;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * The logo goes to Supabase Storage straight from the browser, under a folder
 * named after the organization — the storage policy checks membership against
 * that folder, so a signed-in seller can only ever write inside their own.
 *
 * Always the same path, so replacing a logo leaves nothing behind. The URL
 * carries a version so a replaced logo does not keep showing from the cache.
 */
export function LogoUpload({
  copy,
  organizationId,
  logoUrl,
  canEdit,
}: {
  copy: Messages["settings"]["organization"];
  organizationId: string;
  logoUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onFile = async (file: File) => {
    setError(null);

    if (!ACCEPTED.includes(file.type)) {
      setError(copy.logoWrongType);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(copy.logoTooBig);
      return;
    }

    setPending(true);
    const supabase = createClient();
    const path = `${organizationId}/logo`;

    const { error: uploadError } = await supabase.storage
      .from("business-logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setPending(false);
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("business-logos").getPublicUrl(path);
    const result = await saveLogoAction(`${data.publicUrl}?v=${Date.now()}`);

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const remove = async () => {
    setPending(true);
    setError(null);
    const supabase = createClient();
    await supabase.storage.from("business-logos").remove([`${organizationId}/logo`]);
    const result = await saveLogoAction(null);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.logo}</h2>
        <p className="text-sm text-text-secondary">{copy.logoHint}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-40 items-center justify-center rounded-lg bg-surface-alt p-2">
          {logoUrl ? (
            // Unoptimised: the file lives in Supabase Storage, not in this app's
            // own images, and it is already small.
            <Image
              src={logoUrl}
              alt={copy.logo}
              width={160}
              height={80}
              unoptimized
              className="max-h-16 w-auto object-contain"
            />
          ) : (
            <span className="text-xs text-text-muted">{copy.logoNone}</span>
          )}
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>
              <ImageUp className="size-4" aria-hidden="true" />
              {pending ? copy.logoUploading : logoUrl ? copy.logoReplace : copy.logoUpload}
            </Button>
            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={remove}
                className="text-danger hover:bg-danger-tint"
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {copy.logoRemove}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}
    </div>
  );
}
