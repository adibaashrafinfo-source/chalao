import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="10" fill="var(--brand-lime)" />
      <path d="M11 8.5h11v4h-6.5v3h5.5v4h-5.5v4h-4.5z" fill="var(--brand-dark)" />
      <circle cx="23" cy="21.5" r="2" fill="var(--brand-dark)" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span
        className={cn(
          "font-display text-lg font-bold tracking-tight",
          inverted ? "text-white" : "text-brand-dark",
        )}
      >
        F-Commerce OS
      </span>
    </span>
  );
}
