"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";

import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

const MAX_BYTES = 1_000_000;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * The logo is sent to this app's own server, which saves it in the upload folder and
 * records its address. Only the owner can do this; the server checks that too.
 *
 * Always the same path per business, so replacing a logo leaves nothing behind. The URL
 * carries a version so a replaced logo does not keep showing from the cache.
 */
export function LogoUpload({
  copy,
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
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/logo", { method: "POST", body });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? copy.logoWrongType);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not upload the image. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/logo", { method: "DELETE" });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        setError(result.error ?? "Could not remove the logo.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
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
            // Unoptimised: the file is served from the upload folder and is already small.
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
