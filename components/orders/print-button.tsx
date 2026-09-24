"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/** The browser's own print dialogue, which is also how a PDF gets saved. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </Button>
  );
}
