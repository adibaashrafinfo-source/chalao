"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// chalao-logo.png is the original artwork (white background); the -transparent variant
// is the same logo with the white knocked out and the empty margin trimmed, which is
// what the UI uses. Until the file exists, the drawn mark stands in.
const LOGO_SRC = "/chalao-logo-transparent.png";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="10" fill="var(--brand-lime)" />
      <path d="M11 8.5h11v4h-6.5v3h5.5v4h-5.5v4h-4.5z" fill="var(--brand-dark)" />
      <circle cx="23" cy="21.5" r="2" fill="var(--brand-dark)" />
    </svg>
  );
}

function Fallback({ inverted }: { inverted: boolean }) {
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

export function Logo({
  className,
  inverted = false,
  height = "h-11",
}: {
  className?: string;
  inverted?: boolean;
  /** Tailwind height class — the width follows the artwork's own proportions. */
  height?: string;
}) {
  // Probe the file first. A server-rendered <img> can fail before React attaches an
  // onError handler, which would flash the broken-image icon.
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    const probe = new Image();
    probe.src = LOGO_SRC;
    probe.onload = () => setImageReady(true);
  }, []);

  if (!imageReady) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Fallback inverted={inverted} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt="Chalao"
        className={cn(
          height,
          "w-auto",
          // The wordmark is dark green, so on the dark footer the logo is flattened to
          // a white silhouette to stay readable.
          inverted && "brightness-0 invert",
        )}
      />
    </span>
  );
}
