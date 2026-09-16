import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none transition-[color,box-shadow,border-color]",
        "placeholder:text-text-muted focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30",
        "aria-invalid:border-danger aria-invalid:ring-danger/20 disabled:cursor-not-allowed disabled:opacity-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
