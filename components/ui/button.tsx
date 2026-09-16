import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Brief §3.4: every button is a full pill. Use at most one `default` (lime) button per view/card.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-display font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Bright pill — primary action
        default: "bg-brand-lime text-brand-dark hover:bg-brand-lime-hover",
        // Dark pill — secondary-but-important action
        dark: "bg-brand-dark text-white hover:bg-brand-dark/90",
        outline: "border border-border-subtle bg-surface text-brand-dark hover:bg-surface-alt",
        ghost: "text-brand-dark hover:bg-surface-alt",
        destructive: "bg-danger text-white hover:bg-danger/90",
        link: "rounded-none text-brand-dark underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-8 px-4 text-xs",
        lg: "h-12 px-7 text-base",
        // Circular toolbar button (search, settings, help, notifications)
        icon: "size-10 bg-surface-alt text-brand-dark hover:bg-border-subtle",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
