"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FormField({
  label,
  hint,
  error,
  registration,
  type = "text",
  autoComplete,
  passwordToggleLabels,
}: {
  label: string;
  hint?: string;
  error?: FieldError;
  registration: UseFormRegisterReturn;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  passwordToggleLabels?: { show: string; hide: string };
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={isPassword && revealed ? "text" : type}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={isPassword ? "h-11 pr-12" : "h-11"}
          {...registration}
        />
        {isPassword && passwordToggleLabels && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? passwordToggleLabels.hide : passwordToggleLabels.show}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary hover:bg-border-subtle hover:text-brand-dark"
          >
            {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
