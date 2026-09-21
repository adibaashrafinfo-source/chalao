"use client";

import { useState } from "react";

import { acceptInvitationAction } from "@/app/(auth)/invite/[token]/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

export function AcceptInvitation({ copy, token }: { copy: Messages["invite"]; token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const accept = async () => {
    setPending(true);
    setError(null);
    // On success the action redirects to the dashboard, so only failures return.
    const result = await acceptInvitationAction(token);
    setPending(false);
    if (result?.error) setError(result.error);
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? <FormNotice tone="error">{error}</FormNotice> : null}
      <Button size="lg" className="w-full" disabled={pending} onClick={accept}>
        {pending ? copy.accepting : copy.accept}
      </Button>
    </div>
  );
}
