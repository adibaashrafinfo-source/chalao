"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Drop the artwork at public/chalao-logo.png (or .svg and change this path) and it
// appears everywhere. Until then — or if the file ever goes missing — the drawn mark
// below is used instead, so the header never renders a broken image.
const LOGO_SRC = "/chalao-logo.png";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="10" fill="var(--brand-lime)" />
      <path d="M11 8.5h11v4h-6.5v3h5.5v4h-5.5v4h-4.5z" fill="var(--brand-dark)" />
      <circle cx="23" cy="21.5" r="2" fill="var(--brand-dark)" />
    </svg>
  );
}

function Wordmark({ inverted }: { inverted: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span
        className={cn(
          "font-display text-lg font-bold tracking-tight",
          inverted ? "text-white" : "text-brand-dark",
        )}
      >
        Chalao
      </span>
    </span>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  // Start with the drawn mark and only swap in the artwork once it has actually loaded.
  // Probing first avoids the broken-image icon an onError fallback would flash, because
  // the server-rendered <img> can fail before React has attached its handler.
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    if (inverted) return;

    const probe = new Image();
    probe.src = LOGO_SRC;
    probe.onload = () => setImageReady(true);
  }, [inverted]);

  // The artwork is dark green, so it would disappear on the dark footer — those places
  // keep the drawn mark with white text.
  return (
    <span className={cn("inline-flex items-center", className)}>
      {imageReady && !inverted ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_SRC} alt="Chalao" className="h-9 w-auto" />
      ) : (
        <Wordmark inverted={inverted} />
      )}
    </span>
  );
}
